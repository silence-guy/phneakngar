import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// Hoisted mocks - must be defined before imports
const mockGetCloudflareContext = vi.hoisted(() => vi.fn());
const mockGetDb = vi.hoisted(() => vi.fn());
const mockCreateAuth = vi.hoisted(() => vi.fn());
const mockBindCacheKV = vi.hoisted(() => vi.fn());
const mockGetMachineTokenByToken = vi.hoisted(() => vi.fn());
const mockUpdateMachineTokenLastUsed = vi.hoisted(() => vi.fn());

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: mockGetCloudflareContext,
}));

vi.mock("@/lib/db", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/lib/auth", () => ({
  createAuth: mockCreateAuth,
}));

vi.mock("@phneakngar/shared", () => ({
  queries: {
    machineToken: {
      getMachineTokenByToken: mockGetMachineTokenByToken,
      updateMachineTokenLastUsed: mockUpdateMachineTokenLastUsed,
    },
  },
}));

vi.mock("@/lib/cache", () => ({
  cached: vi.fn((key, ttl, fn) => fn()),
  cacheKeys: {
    machineToken: (token: string) => `mt:${token}`,
    machineTokenLastUsed: (token: string) => `mt_lu:${token}`,
  },
  bindCacheKV: mockBindCacheKV,
  throttled: vi.fn((key, ttl, fn) => fn()),
}));

import { withAuth, AuthContext } from "./auth";

// Helper to create a mock env
function createMockEnv(overrides: Record<string, unknown> = {}) {
  const db = { kind: "mock-db" };
  const env = {
    DB: db,
    CACHE_KV: null,
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "https://test.example.com",
    ...overrides,
  };
  return { env, db };
}

// Helper to create a mock machine token
function createMockMachineToken(overrides: Partial<{
  id: string;
  token: string;
  userId: string;
  userEmail: string;
  workspaceId: string;
  status: "active" | "inactive" | "revoked";
}> = {}) {
  return {
    id: "mt-123",
    token: "al_abc123token",
    userId: "user-456",
    userEmail: "test@example.com",
    workspaceId: "ws-789",
    status: "active" as const,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    ...overrides,
  };
}

// Helper to create a mock session response
function createMockSession(user: { id: string; email: string }) {
  return {
    headers: new Headers(),
    response: { user },
  };
}

describe("withAuth middleware", () => {
  let mockEnv: ReturnType<typeof createMockEnv>;
  let mockAuthApi: { getSession: ReturnType<typeof vi.fn> };
  let testHandler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default env
    mockEnv = createMockEnv();
    mockGetCloudflareContext.mockResolvedValue({ env: mockEnv.env });
    mockGetDb.mockReturnValue(mockEnv.db);
    mockGetMachineTokenByToken.mockResolvedValue(null);
    mockUpdateMachineTokenLastUsed.mockResolvedValue(undefined);

    // Default auth mock
    mockAuthApi = { getSession: vi.fn() };
    mockCreateAuth.mockReturnValue({ api: mockAuthApi });

    // Test handler that returns a simple response
    testHandler = vi.fn(async (_req, ctx: AuthContext) => {
      return NextResponse.json({
        userId: ctx.userId,
        email: ctx.email,
        authType: ctx.authType,
        workspaceId: ctx.workspaceId,
      });
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe("Machine token authentication", () => {
    it("returns context with workspaceId and authType='machine' for valid token", async () => {
      const machineToken = createMockMachineToken();
      mockGetMachineTokenByToken.mockResolvedValueOnce(machineToken);

      const req = new NextRequest("http://localhost/api/test", {
        headers: { Authorization: "Bearer al_abc123token" },
      });

      const wrapped = withAuth(testHandler);
      const response = await wrapped(req);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.userId).toBe(machineToken.userId);
      expect(body.email).toBe(machineToken.userEmail);
      expect(body.authType).toBe("machine");
      expect(body.workspaceId).toBe(machineToken.workspaceId);

      // Verify handler was called with correct context
      expect(testHandler).toHaveBeenCalledWith(
        req,
        expect.objectContaining({
          userId: machineToken.userId,
          email: machineToken.userEmail,
          authType: "machine",
          workspaceId: machineToken.workspaceId,
        }),
      );
      expect(mockGetMachineTokenByToken).toHaveBeenCalledWith(mockEnv.db, "al_abc123token");
    });

    it("returns 401 for invalid machine token (not found)", async () => {
      mockGetMachineTokenByToken.mockResolvedValueOnce(null);

      const req = new NextRequest("http://localhost/api/test", {
        headers: { Authorization: "Bearer al_invalid_token" },
      });

      const wrapped = withAuth(testHandler);
      const response = await wrapped(req);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe("invalid token");
      expect(testHandler).not.toHaveBeenCalled();
    });

    it("returns 401 for inactive machine token", async () => {
      const machineToken = createMockMachineToken({ status: "inactive" });
      mockGetMachineTokenByToken.mockResolvedValueOnce(machineToken);

      const req = new NextRequest("http://localhost/api/test", {
        headers: { Authorization: "Bearer al_abc123token" },
      });

      const wrapped = withAuth(testHandler);
      const response = await wrapped(req);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe("invalid token");
      expect(testHandler).not.toHaveBeenCalled();
    });

    it("returns 401 for revoked machine token", async () => {
      const machineToken = createMockMachineToken({ status: "revoked" });
      mockGetMachineTokenByToken.mockResolvedValueOnce(machineToken);

      const req = new NextRequest("http://localhost/api/test", {
        headers: { Authorization: "Bearer al_abc123token" },
      });

      const wrapped = withAuth(testHandler);
      const response = await wrapped(req);

      expect(response.status).toBe(401);
      expect(testHandler).not.toHaveBeenCalled();
    });

    it("returns 401 for machine token without workspaceId", async () => {
      const machineToken = createMockMachineToken({ workspaceId: "" });
      mockGetMachineTokenByToken.mockResolvedValueOnce(machineToken);

      const req = new NextRequest("http://localhost/api/test", {
        headers: { Authorization: "Bearer al_abc123token" },
      });

      const wrapped = withAuth(testHandler);
      const response = await wrapped(req);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe("invalid token");
      expect(testHandler).not.toHaveBeenCalled();
    });

    it("returns 401 when token query throws an error", async () => {
      mockGetMachineTokenByToken.mockRejectedValueOnce(new Error("DB error"));

      const req = new NextRequest("http://localhost/api/test", {
        headers: { Authorization: "Bearer al_abc123token" },
      });

      const wrapped = withAuth(testHandler);
      const response = await wrapped(req);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe("invalid token");
      expect(testHandler).not.toHaveBeenCalled();
    });

    it("does not process Bearer tokens that do not start with al_", async () => {
      // This token doesn't start with al_, so it should fall through to session auth
      mockAuthApi.getSession.mockResolvedValueOnce(createMockSession({ id: "user-123", email: "user@test.com" }));

      const req = new NextRequest("http://localhost/api/test", {
        headers: { Authorization: "Bearer some_other_token" },
      });

      const wrapped = withAuth(testHandler);
      const response = await wrapped(req);

      // Should fall through to session auth and succeed
      expect(response.status).toBe(200);
      expect(testHandler).toHaveBeenCalledWith(
        req,
        expect.objectContaining({
          authType: "user",
          userId: "user-123",
        }),
      );
    });
  });

  describe("User session authentication (fallback)", () => {
    it("returns context with userId, email, authType='user' for valid session", async () => {
      const setCookies = new Headers();
      setCookies.append("set-cookie", "session=abc123; Path=/");
      mockAuthApi.getSession.mockResolvedValueOnce({
        headers: setCookies,
        response: { user: { id: "user-789", email: "user@example.com" } },
      });

      const req = new NextRequest("http://localhost/api/test", {
        headers: { "Cookie": "session_data=abc" },
      });

      const wrapped = withAuth(testHandler);
      const response = await wrapped(req);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.userId).toBe("user-789");
      expect(body.email).toBe("user@example.com");
      expect(body.authType).toBe("user");
      expect(body.workspaceId).toBeUndefined();

      expect(testHandler).toHaveBeenCalledWith(
        req,
        expect.objectContaining({
          userId: "user-789",
          email: "user@example.com",
          authType: "user",
        }),
      );
    });

    it("returns 401 when no session exists", async () => {
      mockAuthApi.getSession.mockResolvedValueOnce({
        headers: new Headers(),
        response: null,
      });

      const req = new NextRequest("http://localhost/api/test");

      const wrapped = withAuth(testHandler);
      const response = await wrapped(req);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe("unauthorized");
      expect(testHandler).not.toHaveBeenCalled();
    });

    it("returns 503 when session validation throws", async () => {
      // withAuth retries getSession once; both attempts must fail for 503
      mockAuthApi.getSession
        .mockRejectedValueOnce(new Error("Session validation error"))
        .mockRejectedValueOnce(new Error("Session validation error"));

      const req = new NextRequest("http://localhost/api/test");

      const wrapped = withAuth(testHandler);
      const response = await wrapped(req);

      expect(response.status).toBe(503);
      const body = await response.json();
      expect(body.error).toBe("session validation failed");
      expect(testHandler).not.toHaveBeenCalled();
    });

    it("retries session validation once on failure", async () => {
      // First call fails, second succeeds
      mockAuthApi.getSession
        .mockRejectedValueOnce(new Error("Transient error"))
        .mockResolvedValueOnce(createMockSession({ id: "user-retry", email: "retry@test.com" }));

      const req = new NextRequest("http://localhost/api/test");

      const wrapped = withAuth(testHandler);
      const response = await wrapped(req);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.userId).toBe("user-retry");
      expect(mockAuthApi.getSession).toHaveBeenCalledTimes(2);
    });

    it("returns 503 when both session validation attempts fail", async () => {
      mockAuthApi.getSession
        .mockRejectedValueOnce(new Error("Error 1"))
        .mockRejectedValueOnce(new Error("Error 2"));

      const req = new NextRequest("http://localhost/api/test");

      const wrapped = withAuth(testHandler);
      const response = await wrapped(req);

      expect(response.status).toBe(503);
      expect(mockAuthApi.getSession).toHaveBeenCalledTimes(2);
      expect(testHandler).not.toHaveBeenCalled();
    });
  });

  describe("No Authorization header", () => {
    it("falls back to session check when no Authorization header is present", async () => {
      mockAuthApi.getSession.mockResolvedValueOnce(createMockSession({ id: "user-fallback", email: "fallback@test.com" }));

      const req = new NextRequest("http://localhost/api/test");

      const wrapped = withAuth(testHandler);
      const response = await wrapped(req);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.authType).toBe("user");
      expect(body.userId).toBe("user-fallback");
    });

    it("returns 401 when no Authorization header and no valid session", async () => {
      mockAuthApi.getSession.mockResolvedValueOnce({
        headers: new Headers(),
        response: null,
      });

      const req = new NextRequest("http://localhost/api/test");

      const wrapped = withAuth(testHandler);
      const response = await wrapped(req);

      expect(response.status).toBe(401);
      expect(testHandler).not.toHaveBeenCalled();
    });
  });

  describe("Cookie forwarding", () => {
    it("forwards Set-Cookie headers from Better Auth to the response", async () => {
      const setCookies = new Headers();
      setCookies.append("set-cookie", "session_refresh=xyz; Path=/; HttpOnly");
      setCookies.append("set-cookie", "another_cookie=value; Path=/");
      mockAuthApi.getSession.mockResolvedValueOnce({
        headers: setCookies,
        response: { user: { id: "user-cookie", email: "cookie@test.com" } },
      });

      const req = new NextRequest("http://localhost/api/test");

      const wrapped = withAuth(testHandler);
      const response = await wrapped(req);

      expect(response.status).toBe(200);
      const setCookieHeaders = response.headers.getSetCookie();
      expect(setCookieHeaders).toContain("session_refresh=xyz; Path=/; HttpOnly");
      expect(setCookieHeaders).toContain("another_cookie=value; Path=/");
    });

    it("does not add Set-Cookie header when no cookies are returned", async () => {
      mockAuthApi.getSession.mockResolvedValueOnce({
        headers: new Headers(),
        response: { user: { id: "user-no-cookie", email: "nocookie@test.com" } },
      });

      const req = new NextRequest("http://localhost/api/test");

      const wrapped = withAuth(testHandler);
      const response = await wrapped(req);

      expect(response.status).toBe(200);
      expect(response.headers.getSetCookie()).toHaveLength(0);
    });
  });

  describe("Context params passthrough", () => {
    it("passes through resolved params to the handler", async () => {
      mockAuthApi.getSession.mockResolvedValueOnce(createMockSession({ id: "user-params", email: "params@test.com" }));

      const req = new NextRequest("http://localhost/api/test");

      const wrapped = withAuth(testHandler);
      const response = await wrapped(req, { params: { workspaceId: "ws-test" } });

      expect(response.status).toBe(200);
      expect(testHandler).toHaveBeenCalledWith(
        req,
        expect.objectContaining({
          params: { workspaceId: "ws-test" },
        }),
      );
    });

    it("handles async params (Promise)", async () => {
      mockAuthApi.getSession.mockResolvedValueOnce(createMockSession({ id: "user-async", email: "async@test.com" }));

      const req = new NextRequest("http://localhost/api/test");

      const wrapped = withAuth(testHandler);
      const response = await wrapped(req, { params: Promise.resolve({ id: "123" }) });

      expect(response.status).toBe(200);
      expect(testHandler).toHaveBeenCalledWith(
        req,
        expect.objectContaining({
          params: { id: "123" },
        }),
      );
    });

    it("works without params", async () => {
      mockAuthApi.getSession.mockResolvedValueOnce(createMockSession({ id: "user-no-params", email: "noparams@test.com" }));

      const req = new NextRequest("http://localhost/api/test");

      const wrapped = withAuth(testHandler);
      const response = await wrapped(req);

      expect(response.status).toBe(200);
      expect(testHandler).toHaveBeenCalledWith(
        req,
        expect.not.objectContaining({ params: expect.anything() }),
      );
    });
  });

  describe("Env binding", () => {
    it("binds cache KV with the provided env", async () => {
      const kvNamespace = {} as KVNamespace;
      const env = createMockEnv({ CACHE_KV: kvNamespace }).env;
      mockGetCloudflareContext.mockReturnValue({ env });

      mockAuthApi.getSession.mockResolvedValueOnce(createMockSession({ id: "user-env", email: "env@test.com" }));

      const req = new NextRequest("http://localhost/api/test");

      const wrapped = withAuth(testHandler);
      await wrapped(req);

      expect(mockBindCacheKV).toHaveBeenCalledWith(kvNamespace);
    });

    it("binds null to cache KV when not provided", async () => {
      const env = createMockEnv().env;
      mockGetCloudflareContext.mockReturnValue({ env });

      mockAuthApi.getSession.mockResolvedValueOnce(createMockSession({ id: "user-env2", email: "env2@test.com" }));

      const req = new NextRequest("http://localhost/api/test");

      const wrapped = withAuth(testHandler);
      await wrapped(req);

      expect(mockBindCacheKV).toHaveBeenCalledWith(null);
    });
  });
});
