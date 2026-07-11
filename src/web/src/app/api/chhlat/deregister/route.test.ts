import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as sharedMock from "@/test/shared-mock";

const mockSetMachineLastSeenNull = vi.fn();
const mockGetMachineByChhlat = vi.fn();
const mockBroadcastToUser = vi.fn();

function sharedMocks() {
  const shared = sharedMock as unknown as Record<string, unknown>;
  return {
    "@opennextjs/cloudflare": {
      getCloudflareContext: vi.fn(() => ({ env: { DB: {} } })),
    },
    "@phneakngar/shared": () => ({
      ...shared,
      createDb: vi.fn(() => ({})),
      queries: {
        machine: {
          getMachineByChhlat: (...a: any[]) => mockGetMachineByChhlat(...a),
          setMachineLastSeenNull: (...a: any[]) => mockSetMachineLastSeenNull(...a),
        },
      },
      DeregisterRequestSchema: shared.DeregisterRequestSchema,
    }),
    "@/lib/broadcast": {
      broadcastToUser: (...a: any[]) => mockBroadcastToUser(...a),
    },
  };
}

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/chhlat/deregister", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/chhlat/deregister", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMachineByChhlat.mockResolvedValue(null);
  });

  async function loadRoute(authCtx: Record<string, unknown>) {
    vi.resetModules();

    const mocks = sharedMocks();

    vi.doMock("@opennextjs/cloudflare", () => mocks["@opennextjs/cloudflare"]);
    vi.doMock("@phneakngar/shared", mocks["@phneakngar/shared"]);
    vi.doMock("@/lib/db", () => ({
      getDb: vi.fn(() => ({})),
      withD1Retry: vi.fn((fn: () => Promise<any>) => fn()),
    }));
    vi.doMock("@/lib/broadcast", () => mocks["@/lib/broadcast"]);
    vi.doMock("@/lib/logger", () => ({
      log: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
    }));
    vi.doMock("@/lib/middleware/auth", () => ({
      withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => {
        const params =
          ctx?.params instanceof Promise ? await ctx.params : ctx?.params;
        return handler(req, { ...authCtx, params });
      }),
    }));
    vi.doMock("@/lib/middleware/helpers", async () => {
      return await import("@/lib/middleware/helpers");
    });

    const { POST } = await import("./route");
    return POST;
  }

  const chhlatAuth = { env: {}, userId: "u1", email: "u@t.com", authType: "machine" as const, workspaceId: "w1" };
  const jwtAuth = { env: {}, userId: "u1", email: "u@t.com" };

  it("sets machine last_seen_at to null", async () => {
    const POST = await loadRoute(chhlatAuth);

    mockSetMachineLastSeenNull.mockResolvedValue(undefined);
    mockBroadcastToUser.mockResolvedValue(undefined);

    const res = await POST(makeReq({ chhlat_id: "d1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ status: "ok" });
    // Single machine write instead of N runtime writes
    expect(mockSetMachineLastSeenNull).toHaveBeenCalledTimes(1);
    expect(mockSetMachineLastSeenNull).toHaveBeenCalledWith({}, "d1", "w1");
  });

  it("sends single broadcast with chhlatId and workspaceId", async () => {
    const POST = await loadRoute(chhlatAuth);

    mockSetMachineLastSeenNull.mockResolvedValue(undefined);
    mockBroadcastToUser.mockResolvedValue(undefined);

    await POST(makeReq({ chhlat_id: "d1" }));

    expect(mockBroadcastToUser).toHaveBeenCalledTimes(1);
    expect(mockBroadcastToUser).toHaveBeenCalledWith("u1", {
      type: "runtime.status",
      chhlatId: "d1",
      workspaceId: "w1",
      status: "offline",
    });
  });

  it("returns 403 when called without workspaceId", async () => {
    const POST = await loadRoute(jwtAuth);

    const res = await POST(makeReq({ chhlat_id: "d1" }));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toContain("machine token required");
  });

  it("still returns ok when setMachineLastSeenNull fails (D1 transient error)", async () => {
    const POST = await loadRoute(chhlatAuth);

    mockSetMachineLastSeenNull.mockRejectedValue(new Error("D1 timeout"));
    mockBroadcastToUser.mockResolvedValue(undefined);

    const res = await POST(makeReq({ chhlat_id: "d1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ status: "ok" });
  });
});
