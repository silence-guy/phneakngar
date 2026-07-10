import { beforeEach, describe, expect, it, vi } from "vitest";

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
    ...overrides,
  };
  return { env, first, prepare, emailFetch, wsFetch };
}

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
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

  it("returns 503 when a dependency is unavailable", async () => {
    const fixture = createEnv();
    fixture.wsFetch.mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
    mockGetCloudflareContext.mockReturnValue({ env: fixture.env });

    const response = await GET();
    const body = await response.json() as any;

    expect(response.status).toBe(503);
    expect(body.checks.websocket_worker.status).toBe("error");
  });
});
