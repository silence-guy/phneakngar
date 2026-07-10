import { getCloudflareContext } from "@opennextjs/cloudflare";

const HEALTH_TIMEOUT_MS = 2_000;

interface ComponentHealth {
  status: "ok" | "error";
  latency_ms: number;
}

function requiredConfigurationPresent(env: Env): boolean {
  const required = [
    env.BETTER_AUTH_SECRET,
    env.BETTER_AUTH_URL,
    env.ENCRYPTION_KEY,
    env.EMAIL_NOTIFY_SECRET,
    env.WS_SERVICE_SECRET,
  ];
  if (required.some((value) => !value?.trim())) return false;

  try {
    const authUrl = new URL(env.BETTER_AUTH_URL);
    if (process.env.NODE_ENV === "production" && authUrl.protocol !== "https:") return false;
  } catch {
    return false;
  }

  return true;
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

async function checkService(fetcher: Fetcher): Promise<ComponentHealth> {
  const startedAt = performance.now();
  try {
    const response = await fetcher.fetch("http://internal/health", {
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

  const [database, emailWorker, websocketWorker] = await Promise.all([
    checkD1(cfEnv),
    checkService(cfEnv.EMAIL_WORKER),
    checkService(cfEnv.WS_DO_WORKER),
  ]);

  const configuration = requiredConfigurationPresent(cfEnv) ? "ok" : "error";
  const healthy = configuration === "ok"
    && database.status === "ok"
    && emailWorker.status === "ok"
    && websocketWorker.status === "ok";

  return Response.json(
    {
      status: healthy ? "ok" : "degraded",
      checks: {
        configuration: { status: configuration },
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
