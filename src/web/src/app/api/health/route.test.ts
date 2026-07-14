import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetCloudflareContext = vi.hoisted(() => vi.fn());

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: mockGetCloudflareContext,
}));

import { GET } from "./route";

function createEnv(overrides: Record<string, unknown> = {}) {
  const first = vi.fn().mockResolvedValue({ ok: 1 });
  const prepare = vi.fn(() => ({ first }));
  const emailFetch = vi.fn().mockResolvedValue(Response.json({ status: "ok" }));
  const wsFetch = vi.fn().mockResolvedValue(Response.json({ status: "ok" }));

  const env = {
    DB: { prepare },
    EMAIL_WORKER: { fetch: emailFetch },
    WS_DO_WORKER: { fetch: wsFetch },
    BETTER_AUTH_SECRET: "auth-secret",
    BETTER_AUTH_URL: "https://app.example.com",
    ENCRYPTION_KEY: "encryption-key",
    EMAIL_NOTIFY_SECRET: "email-secret",
    WS_SERVICE_SECRET: "ws-secret",
    PHNEAKNGAR_DOMAIN: "agents.example",
    NEXT_PUBLIC_PHNEAKNGAR_DOMAIN: "agents.example",
    ...overrides,
  };
  return { env, first, prepare, emailFetch, wsFetch };
}

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns healthy only when configuration, D1, and both service bindings respond", async () => {
    const fixture = createEnv();
    mockGetCloudflareContext.mockReturnValue({ env: fixture.env });

    const response = await GET();
    const body = await response.json() as any;

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body.status).toBe("ok");
    expect(body.checks.configuration.status).toBe("ok");
    expect(body.checks.database.status).toBe("ok");
    expect(body.checks.email_worker.status).toBe("ok");
    expect(body.checks.websocket_worker.status).toBe("ok");
    expect(fixture.prepare).toHaveBeenCalledWith("SELECT 1 AS ok");
    expect(fixture.emailFetch).toHaveBeenCalledWith(
      "http://internal/health",
      expect.objectContaining({
        headers: { "X-Phneakngar-Expected-Email-Domain": "agents.example" },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("returns 503 without identifying which secret is missing", async () => {
    const fixture = createEnv({ WS_SERVICE_SECRET: "" });
    mockGetCloudflareContext.mockReturnValue({ env: fixture.env });

    const response = await GET();
    const text = await response.text();
    const body = JSON.parse(text);

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.checks.configuration.status).toBe("error");
    expect(text).not.toContain("WS_SERVICE_SECRET");
    expect(text).not.toContain("ws-secret");
  });

  it.each([
    { PHNEAKNGAR_DOMAIN: undefined, NEXT_PUBLIC_PHNEAKNGAR_DOMAIN: "agents.example" },
    { PHNEAKNGAR_DOMAIN: "https://private.example/path", NEXT_PUBLIC_PHNEAKNGAR_DOMAIN: "agents.example" },
    { PHNEAKNGAR_DOMAIN: "agents.example", NEXT_PUBLIC_PHNEAKNGAR_DOMAIN: "other.example" },
    { PHNEAKNGAR_DOMAIN: "phneakngar.invalid", NEXT_PUBLIC_PHNEAKNGAR_DOMAIN: "phneakngar.invalid" },
  ])("returns a generic 503 for invalid production domain configuration", async (overrides) => {
    vi.stubEnv("NODE_ENV", "production");
    const fixture = createEnv(overrides);
    mockGetCloudflareContext.mockReturnValue({ env: fixture.env });

    const response = await GET();
    const text = await response.text();
    const body = JSON.parse(text);

    expect(response.status).toBe(503);
    expect(body.checks.configuration.status).toBe("error");
    expect(text).not.toContain("PHNEAKNGAR_DOMAIN");
    expect(text).not.toContain("private.example");
    expect(text).not.toContain("other.example");
    expect(text).not.toContain("phneakngar.invalid");
  });

  it("returns 503 when the email Worker rejects the expected domain", async () => {
    const fixture = createEnv();
    fixture.emailFetch.mockResolvedValueOnce(new Response("mismatch", { status: 503 }));
    mockGetCloudflareContext.mockReturnValue({ env: fixture.env });

    const response = await GET();
    const body = await response.json() as any;

    expect(response.status).toBe(503);
    expect(body.checks.email_worker.status).toBe("error");
  });

  it("returns 503 when a dependency is unavailable", async () => {
    const fixture = createEnv();
    fixture.wsFetch.mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
    mockGetCloudflareContext.mockReturnValue({ env: fixture.env });

    const response = await GET();
    const body = await response.json() as any;

    expect(response.status).toBe(503);
    expect(body.checks.websocket_worker.status).toBe("error");
  });

  it("uses an explicit local Worker URL when a development binding is unavailable", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_WS_DO_URL", "http://127.0.0.1:18789");
    const fixture = createEnv();
    fixture.wsFetch.mockRejectedValueOnce(new Error("binding unavailable"));
    const fallbackFetch = vi.fn().mockResolvedValue(Response.json({ status: "ok" }));
    vi.stubGlobal("fetch", fallbackFetch);
    mockGetCloudflareContext.mockReturnValue({ env: fixture.env });

    const response = await GET();
    const body = await response.json() as any;

    expect(response.status).toBe(200);
    expect(body.checks.websocket_worker.status).toBe("ok");
    expect(fallbackFetch).toHaveBeenCalledWith(
      new URL("http://127.0.0.1:18789/health"),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("does not use local fallback URLs in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEV_WS_DO_URL", "http://127.0.0.1:18789");
    const fixture = createEnv();
    fixture.wsFetch.mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
    const fallbackFetch = vi.fn();
    vi.stubGlobal("fetch", fallbackFetch);
    mockGetCloudflareContext.mockReturnValue({ env: fixture.env });

    const response = await GET();
    const body = await response.json() as any;

    expect(response.status).toBe(503);
    expect(body.checks.websocket_worker.status).toBe("error");
    expect(fallbackFetch).not.toHaveBeenCalled();
  });
});
