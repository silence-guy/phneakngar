interface HealthPayload {
  status?: unknown;
  checks?: unknown;
}

export default async function setupE2eEnvironment() {
  const configuredAppUrl = process.env.APP_URL?.trim();
  if (!configuredAppUrl) {
    throw new Error(
      "APP_URL is required for E2E tests. Start the project services and run, for example, "
      + "APP_URL=http://localhost:15210 pnpm test:e2e",
    );
  }

  const appUrl = new URL(configuredAppUrl);
  if (
    (appUrl.protocol !== "http:" && appUrl.protocol !== "https:")
    || appUrl.pathname !== "/"
    || appUrl.search
    || appUrl.hash
  ) {
    throw new Error("APP_URL must be an http(s) origin without a path, query, or fragment");
  }
  process.env.APP_URL = appUrl.origin;

  const healthUrl = new URL("/api/health", appUrl);
  let response: Response;
  try {
    response = await fetch(healthUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw new Error(
      `E2E target is not reachable at ${appUrl.origin}. Start the web, email, and WebSocket services first.`,
      { cause: error },
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      `E2E target ${appUrl.origin} is not ភ្នាក់ងារ: /api/health returned ${response.status} ${contentType || "without a content type"}`,
    );
  }

  let payload: HealthPayload;
  try {
    payload = await response.json() as HealthPayload;
  } catch (error) {
    throw new Error(`E2E target ${appUrl.origin} returned invalid health JSON`, { cause: error });
  }

  if (!response.ok || payload.status !== "ok" || !payload.checks) {
    throw new Error(
      `E2E target ${appUrl.origin} is not ready: /api/health returned ${response.status} with status ${String(payload.status)}`,
    );
  }
}
