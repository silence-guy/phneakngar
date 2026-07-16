import { getCloudflareContext } from "@opennextjs/cloudflare";
import { EMAIL_DOMAIN_EXPECTATION_HEADER } from "@phneakngar/shared";
import { resolvePublicEmailDomain, resolveServerEmailDomain } from "@/lib/email-domain";

const HEALTH_TIMEOUT_MS = 2_000;

interface ComponentHealth {
  status: "ok" | "error";
  latency_ms: number;
}

function configuredEmailDomain(env: Env): string | null {
  try {
    const serverDomain = resolveServerEmailDomain(env);
    const publicDomain = resolvePublicEmailDomain(
      env.NEXT_PUBLIC_PHNEAKNGAR_DOMAIN,
      env.NEXT_PUBLIC_PHNEAKNGAR_ENVIRONMENT ?? env.NODE_ENV ?? process.env.NODE_ENV,
    );
    return serverDomain === publicDomain ? serverDomain : null;
  } catch {
    return null;
  }
}

function requiredConfigurationPresent(env: Env, emailDomain: string | null): boolean {
  const required = [
    env.BETTER_AUTH_SECRET,
    env.BETTER_AUTH_URL,
    env.ENCRYPTION_KEY,
    env.EMAIL_NOTIFY_SECRET,
    env.WS_SERVICE_SECRET,
  ];
  if (required.some((value) => !value?.trim()) || !emailDomain) return false;

  try {
    const authUrl = new URL(env.BETTER_AUTH_URL);
    if (process.env.NODE_ENV === "production" && authUrl.protocol !== "https:") return false;
  } catch {
    return false;
  }

  return true;
}

/**
 * Dry-config only: when GATEWAY_TEAM_MAP is set, GATEWAY_WEBHOOK_SECRET is required
 * (webhook path fail-closed with 503). No live provider probes.
 */
function gatewayWebhookConfigPresent(env: Env): boolean {
  const mapConfigured = Boolean(env.GATEWAY_TEAM_MAP?.trim());
  if (!mapConfigured) return true;
  return Boolean(env.GATEWAY_WEBHOOK_SECRET?.trim());
}

async function checkD1(env: Env): Promise<ComponentHealth> {
  const startedAt = performance.now();
  try {
    const result = await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    return {
      status: result?.ok === 1 ? "ok" : "error",
      latency_ms: Math.round(performance.now() - startedAt),
    };
  } catch {
    return { status: "error", latency_ms: Math.round(performance.now() - startedAt) };
  }
}

async function checkService(
  fetcher: Fetcher,
  developmentFallbackUrl?: string,
  headers?: HeadersInit,
): Promise<ComponentHealth> {
  const startedAt = performance.now();
  try {
    const response = await fetcher.fetch("http://internal/health", {
      headers,
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    if (response.ok || process.env.NODE_ENV === "production" || !developmentFallbackUrl) {
      return {
        status: response.ok ? "ok" : "error",
        latency_ms: Math.round(performance.now() - startedAt),
      };
    }
  } catch {
    if (process.env.NODE_ENV === "production" || !developmentFallbackUrl) {
      return { status: "error", latency_ms: Math.round(performance.now() - startedAt) };
    }
  }

  try {
    const healthUrl = new URL("/health", developmentFallbackUrl);
    const response = await fetch(healthUrl, {
      headers,
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    return {
      status: response.ok ? "ok" : "error",
      latency_ms: Math.round(performance.now() - startedAt),
    };
  } catch {
    return { status: "error", latency_ms: Math.round(performance.now() - startedAt) };
  }
}

export async function GET() {
  const { env } = getCloudflareContext();
  const cfEnv = env as Env;

  const emailDomain = configuredEmailDomain(cfEnv);
  const emailHeaders = emailDomain
    ? { [EMAIL_DOMAIN_EXPECTATION_HEADER]: emailDomain }
    : undefined;
  const [database, emailWorker, websocketWorker] = await Promise.all([
    checkD1(cfEnv),
    checkService(cfEnv.EMAIL_WORKER, process.env.DEV_EMAIL_WORKER_URL, emailHeaders),
    checkService(cfEnv.WS_DO_WORKER, process.env.DEV_WS_DO_URL),
  ]);

  const configuration = requiredConfigurationPresent(cfEnv, emailDomain) ? "ok" : "error";
  const gatewayWebhook = gatewayWebhookConfigPresent(cfEnv) ? "ok" : "error";
  const healthy = configuration === "ok"
    && gatewayWebhook === "ok"
    && database.status === "ok"
    && emailWorker.status === "ok"
    && websocketWorker.status === "ok";

  return Response.json(
    {
      status: healthy ? "ok" : "degraded",
      checks: {
        configuration: { status: configuration },
        /** Dry-config fail-closed signal for map-without-secret; no live probes. */
        gateway_webhook: { status: gatewayWebhook },
        database,
        email_worker: emailWorker,
        websocket_worker: websocketWorker,
      },
      timestamp: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
