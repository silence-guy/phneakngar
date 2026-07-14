import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as sharedMock from "@/test/shared-mock";

const mockGetMachineTokenByToken = vi.fn();
const mockClaimMachineTokenActivation = vi.fn();
const mockFinalizeMachineTokenActivation = vi.fn();
const mockUpsertMachineForActivation = vi.fn();
const mockUpsertAgentRuntime = vi.fn();
const mockListAgentRuntimesByChhlat = vi.fn();
const mockListAgentRuntimesByChhlatProviders = vi.fn();
const mockBroadcastToUser = vi.fn();
const mockBindCacheKV = vi.fn();
const mockInvalidateMany = vi.fn();

function sharedMocks() {
  const shared = sharedMock as unknown as Record<string, unknown>;
  return {
    "@opennextjs/cloudflare": {
      getCloudflareContext: vi.fn(() => Promise.resolve({ env: { DB: {}, CACHE_KV: {} } })),
    },
    "@phneakngar/shared": () => ({
      ...shared,
      createDb: vi.fn(() => ({})),
      queries: {
        machineToken: {
          getMachineTokenByToken: (...args: any[]) => mockGetMachineTokenByToken(...args),
          claimMachineTokenActivation: (...args: any[]) => mockClaimMachineTokenActivation(...args),
          finalizeMachineTokenActivation: (...args: any[]) => mockFinalizeMachineTokenActivation(...args),
        },
        machine: {
          upsertMachineForActivation: (...args: any[]) => mockUpsertMachineForActivation(...args),
        },
        runtime: {
          upsertAgentRuntime: (...args: any[]) => mockUpsertAgentRuntime(...args),
          listAgentRuntimesByChhlat: (...args: any[]) => mockListAgentRuntimesByChhlat(...args),
          listAgentRuntimesByChhlatProviders: (...args: any[]) => mockListAgentRuntimesByChhlatProviders(...args),
        },
      },
      ActivateTokenRequestSchema: shared.ActivateTokenRequestSchema,
      createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
    }),
    "@/lib/broadcast": {
      broadcastToUser: (...args: any[]) => mockBroadcastToUser(...args),
    },
  };
}

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/machine-tokens/activate", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const validBody = {
  token: "al_test123",
  hostname: "TestMachine.local",
  runtimes: [{ type: "claude", version: "2.1.0" }],
};
const runtimesJson = JSON.stringify([{ type: "claude", version: "2.1.0" }]);
const pendingToken = {
  id: "mt_1",
  userId: "u1",
  userEmail: "u1@example.com",
  workspaceId: "ws_1",
  tokenHash: "hash_1",
  status: "pending",
  hostname: null,
  runtimesJson: null,
};
const runtimeRow = {
  id: "rt_1",
  workspaceId: "ws_1",
  chhlatId: "TestMachine.local",
  runtimeMode: "local",
  provider: "claude",
  deviceInfo: "TestMachine.local",
  metadata: { version: "2.1.0" },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  machineLastSeenAt: null,
};

describe("POST /api/machine-tokens/activate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMachineTokenByToken.mockResolvedValue(pendingToken);
    mockClaimMachineTokenActivation.mockResolvedValue({
      ...pendingToken,
      hostname: validBody.hostname,
      runtimesJson,
    });
    mockUpsertMachineForActivation.mockResolvedValue({ ownerId: "u1" });
    mockUpsertAgentRuntime.mockResolvedValue(runtimeRow);
    mockFinalizeMachineTokenActivation.mockResolvedValue({ ...pendingToken, status: "active" });
    mockListAgentRuntimesByChhlat.mockResolvedValue([runtimeRow]);
    mockListAgentRuntimesByChhlatProviders.mockResolvedValue([runtimeRow]);
    mockBroadcastToUser.mockResolvedValue(undefined);
    mockInvalidateMany.mockResolvedValue(undefined);
  });

  async function loadRoute() {
    vi.resetModules();
    const mocks = sharedMocks();

    vi.doMock("@opennextjs/cloudflare", () => mocks["@opennextjs/cloudflare"]);
    vi.doMock("@phneakngar/shared", mocks["@phneakngar/shared"]);
    vi.doMock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));
    vi.doMock("@/lib/broadcast", () => mocks["@/lib/broadcast"]);
    vi.doMock("@/lib/cache", () => ({
      bindCacheKV: (...args: any[]) => mockBindCacheKV(...args),
      invalidateMany: (...args: any[]) => mockInvalidateMany(...args),
      cacheKeys: {
        machineTokenByHash: (hash: string) => `mt:${hash}`,
        machineTokenLastUsedByHash: (hash: string) => `mt_lu:${hash}`,
        runtimeIds: (workspaceId: string, chhlatId: string) => `rt:${workspaceId}:${chhlatId}`,
        allRuntimes: (workspaceId: string) => `runtimes:${workspaceId}`,
      },
    }));
    vi.doMock("@/lib/middleware/helpers", async () => await import("@/lib/middleware/helpers"));
    vi.doMock("@/lib/api/responses", () => ({
      runtimeToResponse: (runtime: any) => ({ id: runtime.id, provider: runtime.provider }),
    }));

    const { POST } = await import("./route");
    return POST;
  }

  it("claims, provisions, finalizes, invalidates caches, and broadcasts", async () => {
    const POST = await loadRoute();

    const res = await POST(makeReq(validBody));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      chhlat_id: "TestMachine.local",
      workspace_id: "ws_1",
      runtimes: [{ id: "rt_1", provider: "claude" }],
    });
    expect(mockClaimMachineTokenActivation).toHaveBeenCalledWith(
      {}, "mt_1", "TestMachine.local", runtimesJson,
    );
    expect(mockUpsertMachineForActivation).toHaveBeenCalledWith({}, {
      chhlatId: "TestMachine.local",
      workspaceId: "ws_1",
      deviceInfo: "TestMachine.local",
      ownerId: "u1",
    });
    expect(mockFinalizeMachineTokenActivation).toHaveBeenCalledWith(
      {}, "mt_1", "TestMachine.local", runtimesJson,
    );
    expect(mockBindCacheKV).toHaveBeenCalledWith({});
    expect(mockInvalidateMany).toHaveBeenCalledWith([
      "mt:hash_1",
      "mt_lu:hash_1",
      "rt:ws_1:TestMachine.local",
      "runtimes:ws_1",
    ]);
    expect(mockBroadcastToUser).toHaveBeenCalledOnce();
  });

  it("returns the persisted identity for an exact active retry", async () => {
    const POST = await loadRoute();
    mockGetMachineTokenByToken.mockResolvedValue({
      ...pendingToken,
      status: "active",
      hostname: validBody.hostname,
      runtimesJson,
    });

    const res = await POST(makeReq(validBody));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.runtimes[0].id).toBe("rt_1");
    expect(mockClaimMachineTokenActivation).not.toHaveBeenCalled();
    expect(mockUpsertMachineForActivation).not.toHaveBeenCalled();
    expect(mockFinalizeMachineTokenActivation).not.toHaveBeenCalled();
    expect(mockBroadcastToUser).not.toHaveBeenCalled();
  });

  it("returns the claimed runtime set on exact active retry even when extra runtimes exist", async () => {
    const POST = await loadRoute();
    mockGetMachineTokenByToken.mockResolvedValue({
      ...pendingToken,
      status: "active",
      hostname: validBody.hostname,
      runtimesJson,
    });
    mockListAgentRuntimesByChhlat.mockResolvedValue([
      runtimeRow,
      { ...runtimeRow, id: "rt_extra", provider: "gemini" },
    ]);
    mockListAgentRuntimesByChhlatProviders.mockResolvedValue([runtimeRow]);

    const res = await POST(makeReq(validBody));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.runtimes).toEqual([{ id: "rt_1", provider: "claude" }]);
    expect(mockFinalizeMachineTokenActivation).not.toHaveBeenCalled();
    expect(mockListAgentRuntimesByChhlatProviders).toHaveBeenCalledWith(
      {}, "ws_1", "TestMachine.local", ["claude"],
    );
  });

  it("does not finalize when claimed runtimes are not durably resolved", async () => {
    const POST = await loadRoute();
    mockListAgentRuntimesByChhlatProviders.mockResolvedValue([]);

    const res = await POST(makeReq(validBody));

    expect(res.status).toBe(503);
    expect(mockFinalizeMachineTokenActivation).not.toHaveBeenCalled();
  });

  it("rejects reassignment of an active token", async () => {
    const POST = await loadRoute();
    mockGetMachineTokenByToken.mockResolvedValue({
      ...pendingToken,
      status: "active",
      hostname: "Other.local",
      runtimesJson,
    });

    expect((await POST(makeReq(validBody))).status).toBe(409);
    expect(mockUpsertMachineForActivation).not.toHaveBeenCalled();
  });

  it("allows only one of two concurrent different-host claims", async () => {
    const POST = await loadRoute();
    let state = { ...pendingToken } as any;
    mockGetMachineTokenByToken.mockImplementation(() => Promise.resolve({ ...state }));
    mockClaimMachineTokenActivation.mockImplementation((_db, _id, hostname, claimJson) => {
      if (state.hostname || state.runtimesJson) return Promise.resolve(null);
      state = { ...state, hostname, runtimesJson: claimJson };
      return Promise.resolve({ ...state });
    });
    mockFinalizeMachineTokenActivation.mockImplementation(() => {
      state = { ...state, status: "active" };
      return Promise.resolve({ ...state });
    });

    const [first, second] = await Promise.all([
      POST(makeReq(validBody)),
      POST(makeReq({ ...validBody, hostname: "Other.local" })),
    ]);

    expect([first.status, second.status].sort()).toEqual([200, 409]);
    expect(mockFinalizeMachineTokenActivation).toHaveBeenCalledOnce();
  });

  it("resumes after partial provisioning fails", async () => {
    const POST = await loadRoute();
    const claimedToken = {
      ...pendingToken,
      hostname: validBody.hostname,
      runtimesJson,
    };
    mockGetMachineTokenByToken
      .mockResolvedValueOnce(pendingToken)
      .mockResolvedValueOnce(claimedToken);
    mockUpsertAgentRuntime
      .mockRejectedValueOnce(new Error("D1 write failed"))
      .mockResolvedValueOnce(runtimeRow);

    const failed = await POST(makeReq(validBody));
    const retried = await POST(makeReq(validBody));

    expect(failed.status).toBe(503);
    expect(retried.status).toBe(200);
    expect(mockClaimMachineTokenActivation).toHaveBeenCalledOnce();
    expect(mockUpsertAgentRuntime).toHaveBeenCalledTimes(2);
    expect(mockFinalizeMachineTokenActivation).toHaveBeenCalledOnce();
  });

  it("converges when an identical contender finalizes first", async () => {
    const POST = await loadRoute();
    mockFinalizeMachineTokenActivation.mockResolvedValue(null);
    mockGetMachineTokenByToken
      .mockResolvedValueOnce(pendingToken)
      .mockResolvedValueOnce({
        ...pendingToken,
        status: "active",
        hostname: validBody.hostname,
        runtimesJson,
      });

    const res = await POST(makeReq(validBody));

    expect(res.status).toBe(200);
    expect(mockBroadcastToUser).not.toHaveBeenCalled();
  });

  it("rejects duplicate runtime providers before claiming", async () => {
    const POST = await loadRoute();
    const res = await POST(makeReq({
      ...validBody,
      runtimes: [
        { type: "claude", version: "1" },
        { type: "claude", version: "2" },
      ],
    }));

    expect(res.status).toBe(400);
    expect(mockGetMachineTokenByToken).not.toHaveBeenCalled();
  });

  it("returns 404 when token is missing and 422 when it has no workspace", async () => {
    const POST = await loadRoute();
    mockGetMachineTokenByToken.mockResolvedValueOnce(null);
    expect((await POST(makeReq(validBody))).status).toBe(404);

    mockGetMachineTokenByToken.mockResolvedValueOnce({ ...pendingToken, workspaceId: null });
    expect((await POST(makeReq(validBody))).status).toBe(422);
  });
});
