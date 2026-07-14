import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as sharedMock from "@/test/shared-mock";

const mockGetMember = vi.fn();
const mockUpsertMachine = vi.fn();
const mockUpsertAgentRuntime = vi.fn();
const mockGetMachineByChhlat = vi.fn();
const mockClearPendingUpdateVersion = vi.fn();
const mockBroadcastToUser = vi.fn();

function sharedMocks() {
  return {
    "@opennextjs/cloudflare": {
      getCloudflareContext: vi.fn(() => ({ env: { DB: {} } })),
    },
    "@phneakngar/shared": async () => {
      const actual = await vi.importActual<typeof import("@phneakngar/shared")>("@phneakngar/shared");
      return {
        ...actual,
        createDb: vi.fn(() => ({})),
        queries: {
          member: {
            getMemberByUserAndWorkspace: (...a: any[]) => mockGetMember(...a),
          },
          machine: {
            upsertMachine: (...a: any[]) => mockUpsertMachine(...a),
            getMachineByChhlat: (...a: any[]) => mockGetMachineByChhlat(...a),
            clearPendingUpdateVersion: (...a: any[]) => mockClearPendingUpdateVersion(...a),
          },
          runtime: {
            upsertAgentRuntime: (...a: any[]) => mockUpsertAgentRuntime(...a),
          },
        },
      };
    },
    "@/lib/broadcast": {
      broadcastToUser: (...a: any[]) => mockBroadcastToUser(...a),
    },
    "@/lib/api/responses": {
      runtimeToResponse: (rt: any) => ({ id: rt.id }),
    },
  };
}

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/chhlat/register", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/chhlat/register", () => {
  beforeEach(() => vi.clearAllMocks());

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
    vi.doMock("@/lib/api/responses", () => mocks["@/lib/api/responses"]);
    vi.doMock("@/lib/cache", () => ({
      invalidate: vi.fn(),
      cacheKeys: {
        runtimeIds: (...a: any[]) => a.join(":"),
        allRuntimes: (ws: string) => `runtimes:${ws}`,
      },
    }));
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
    vi.doMock("@/lib/middleware/helpers", () => {
      const { NextResponse } = require("next/server");
      return {
        writeJSON: (data: unknown, status = 200) => NextResponse.json(data, { status }),
        writeError: (message: string, status: number) => NextResponse.json({ error: message }, { status }),
        formatTimestamp: (date: Date | string | null) =>
          date ? new Date(date as string).toISOString().replace(/\.\d{3}Z$/, "Z") : "",
        formatTimestampNullable: (date: Date | string | null) =>
          date ? new Date(date as string).toISOString().replace(/\.\d{3}Z$/, "Z") : null,
        parseBody: async (req: Request, schema: { parse: (d: unknown) => unknown }) => {
          let raw: unknown;
          try {
            raw = await req.json();
          } catch {
            return [null, NextResponse.json({ error: "invalid request body" }, { status: 400 })];
          }
          try {
            return [schema.parse(raw), null];
          } catch (err: unknown) {
            const e = err as { issues?: { path: (string | number)[]; message: string }[]; errors?: { path: (string | number)[]; message: string }[] };
            const issues = e.issues ?? e.errors ?? [];
            const fields = issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
            return [null, NextResponse.json({ error: "validation error", details: fields }, { status: 400 })];
          }
        },
      };
    });

    const { POST } = await import("./route");
    return POST;
  }

  const validBody = {
    workspace_id: "w1",
    chhlat_id: "d1",
    device_name: "MyMachine",
    cli_version: "0.0.2",
    runtimes: [
      { type: "claude", version: "1.0", runtime_mode: "local" },
    ],
  };

  const authCtx = { env: {}, userId: "u1", email: "u@t.com", authType: "machine" as const, workspaceId: "w1", machineTokenHostname: "d1" };

  it("upserts machine + runtimes and returns 200", async () => {
    const POST = await loadRoute(authCtx);

    mockGetMember.mockResolvedValue({ userId: "u1", workspaceId: "w1" });
    mockUpsertMachine.mockResolvedValue(undefined);
    mockUpsertAgentRuntime.mockResolvedValue({ id: "r1" });
    mockBroadcastToUser.mockResolvedValue(undefined);

    const res = await POST(makeReq(validBody));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ runtimes: [{ id: "r1" }], workspaceId: "w1" });
    expect(mockUpsertMachine).toHaveBeenCalledTimes(1);
    expect(mockUpsertAgentRuntime).toHaveBeenCalledTimes(1);
  });

  it("persists sanitized Headroom capability metadata for runtimes", async () => {
    const POST = await loadRoute(authCtx);

    mockGetMember.mockResolvedValue({ userId: "u1", workspaceId: "w1" });
    mockUpsertMachine.mockResolvedValue(undefined);
    mockUpsertAgentRuntime.mockResolvedValue({ id: "r1" });
    mockBroadcastToUser.mockResolvedValue(undefined);

    const res = await POST(makeReq({
      ...validBody,
      runtimes: [
        {
          type: "claude",
          version: "1.0",
          runtime_mode: "local",
          headroom: {
            status: "missing",
            configured: true,
            available: false,
            mode: "proxy",
            port: 8787,
            executable: "headroom",
            next_actions: ["install_headroom", "configure_headroom_path"],
          },
        },
      ],
    }));

    expect(res.status).toBe(200);
    expect(mockUpsertAgentRuntime).toHaveBeenCalledWith({}, expect.objectContaining({
      metadata: expect.objectContaining({
        headroom: {
          status: "missing",
          configured: true,
          available: false,
          mode: "proxy",
          port: 8787,
          executable: "headroom",
          next_actions: ["install_headroom", "configure_headroom_path"],
        },
      }),
    }));
  });

  it("rejects malformed Headroom next actions", async () => {
    const POST = await loadRoute(authCtx);

    const res = await POST(makeReq({
      ...validBody,
      runtimes: [
        {
          type: "claude",
          version: "1.0",
          headroom: {
            status: "missing",
            configured: true,
            available: false,
            mode: "proxy",
            port: 8787,
            executable: "headroom",
            next_actions: ["install_headroom", "send_secret_to_ui"],
          },
        },
      ],
    }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("validation error");
    expect(body.details.join("\n")).toContain("next_actions");
    expect(mockUpsertAgentRuntime).not.toHaveBeenCalled();
  });

  it("rejects unsupported Headroom capability fields", async () => {
    const POST = await loadRoute(authCtx);

    const res = await POST(makeReq({
      ...validBody,
      runtimes: [
        {
          type: "claude",
          version: "1.0",
          headroom: {
            status: "available",
            configured: true,
            available: true,
            mode: "proxy",
            port: 8787,
            executable: "headroom",
            proxy_url: "http://127.0.0.1:8787",
          },
        },
      ],
    }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("validation error");
    expect(body.details.join("\n")).toContain("proxy_url");
    expect(mockUpsertAgentRuntime).not.toHaveBeenCalled();
  });

  it("broadcasts only runtime.registered after upserts when no pending update", async () => {
    const POST = await loadRoute(authCtx);

    mockGetMember.mockResolvedValue({ userId: "u1", workspaceId: "w1" });
    mockUpsertMachine.mockResolvedValue(undefined);
    mockUpsertAgentRuntime.mockResolvedValue({ id: "r1" });
    mockGetMachineByChhlat.mockResolvedValue(null);
    mockBroadcastToUser.mockResolvedValue(undefined);

    await POST(makeReq(validBody));

    expect(mockBroadcastToUser).toHaveBeenCalledTimes(1);
    expect(mockBroadcastToUser).toHaveBeenCalledWith("u1", {
      type: "runtime.registered",
      chhlatId: "d1",
      hostname: "MyMachine",
      workspaceId: "w1",
    });
  });

  it("does NOT broadcast runtime.status when no pending update version", async () => {
    const POST = await loadRoute(authCtx);

    mockGetMember.mockResolvedValue({ userId: "u1", workspaceId: "w1" });
    mockUpsertMachine.mockResolvedValue(undefined);
    mockUpsertAgentRuntime.mockResolvedValue({ id: "r1" });
    mockGetMachineByChhlat.mockResolvedValue(null);
    mockBroadcastToUser.mockResolvedValue(undefined);

    await POST(makeReq(validBody));

    const broadcastCalls = mockBroadcastToUser.mock.calls;
    const statusBroadcasts = broadcastCalls.filter(
      ([, msg]: [string, any]) => msg.type === "runtime.status"
    );
    expect(statusBroadcasts).toHaveLength(0);
  });

  it("returns 404 when membership is missing and does not broadcast", async () => {
    const POST = await loadRoute(authCtx);

    mockGetMember.mockResolvedValue(null);

    const res = await POST(makeReq(validBody));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("workspace not found");
    expect(mockUpsertMachine).not.toHaveBeenCalled();
    expect(mockBroadcastToUser).not.toHaveBeenCalled();
  });

  it("returns 403 when token workspace_id does not match body workspace_id", async () => {
    const POST = await loadRoute({ ...authCtx, workspaceId: "w_other" });

    const res = await POST(makeReq(validBody));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe("workspace_id does not match token");
    expect(mockGetMember).not.toHaveBeenCalled();
    expect(mockUpsertMachine).not.toHaveBeenCalled();
  });

  it("allows register when token workspace_id matches body workspace_id", async () => {
    const POST = await loadRoute({ ...authCtx, workspaceId: "w1" });

    mockGetMember.mockResolvedValue({ userId: "u1", workspaceId: "w1" });
    mockUpsertMachine.mockResolvedValue(undefined);
    mockUpsertAgentRuntime.mockResolvedValue({ id: "r1" });
    mockBroadcastToUser.mockResolvedValue(undefined);

    const res = await POST(makeReq(validBody));

    expect(res.status).toBe(200);
    expect(mockUpsertMachine).toHaveBeenCalledTimes(1);
  });

  it("does not fail the request if broadcast throws (fire-and-forget)", async () => {
    const POST = await loadRoute(authCtx);

    mockGetMember.mockResolvedValue({ userId: "u1", workspaceId: "w1" });
    mockUpsertMachine.mockResolvedValue(undefined);
    mockUpsertAgentRuntime.mockResolvedValue({ id: "r1" });
    mockBroadcastToUser.mockRejectedValue(new Error("ws down"));

    const res = await POST(makeReq(validBody));

    expect(res.status).toBe(200);
  });

  it("still registers runtimes when upsertMachine fails (D1 transient error)", async () => {
    const POST = await loadRoute(authCtx);

    mockGetMember.mockResolvedValue({ userId: "u1", workspaceId: "w1" });
    mockUpsertMachine.mockRejectedValue(new Error("D1 timeout"));
    mockUpsertAgentRuntime.mockResolvedValue({ id: "r1" });
    mockBroadcastToUser.mockResolvedValue(undefined);
    mockGetMachineByChhlat.mockResolvedValue(null);

    const res = await POST(makeReq(validBody));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.runtimes).toEqual([{ id: "r1" }]);
    expect(mockUpsertAgentRuntime).toHaveBeenCalledTimes(1);
  });

  it("clears pendingUpdateVersion when cli_version satisfies pending version on register", async () => {
    const POST = await loadRoute(authCtx);

    mockGetMember.mockResolvedValue({ userId: "u1", workspaceId: "w1" });
    mockUpsertMachine.mockResolvedValue(undefined);
    mockUpsertAgentRuntime.mockResolvedValue({ id: "r1" });
    mockGetMachineByChhlat.mockResolvedValue({ pendingUpdateVersion: "0.0.2" });
    mockClearPendingUpdateVersion.mockResolvedValue(undefined);
    mockBroadcastToUser.mockResolvedValue(undefined);

    const res = await POST(makeReq(validBody));

    expect(res.status).toBe(200);
    expect(mockClearPendingUpdateVersion).toHaveBeenCalledWith({}, "d1", "w1");
    expect(mockBroadcastToUser).toHaveBeenCalledWith("u1", {
      type: "runtime.status",
      chhlatId: "d1",
      workspaceId: "w1",
      status: "online",
    });
  });

  it("does not clear pendingUpdateVersion when cli_version is older", async () => {
    const POST = await loadRoute(authCtx);

    mockGetMember.mockResolvedValue({ userId: "u1", workspaceId: "w1" });
    mockUpsertMachine.mockResolvedValue(undefined);
    mockUpsertAgentRuntime.mockResolvedValue({ id: "r1" });
    mockGetMachineByChhlat.mockResolvedValue({ pendingUpdateVersion: "2.0.0" });
    mockBroadcastToUser.mockResolvedValue(undefined);

    const res = await POST(makeReq(validBody));

    expect(res.status).toBe(200);
    expect(mockClearPendingUpdateVersion).not.toHaveBeenCalled();
  });

  it("does not check pendingUpdateVersion when cli_version is missing", async () => {
    const POST = await loadRoute(authCtx);

    mockGetMember.mockResolvedValue({ userId: "u1", workspaceId: "w1" });
    mockUpsertMachine.mockResolvedValue(undefined);
    mockUpsertAgentRuntime.mockResolvedValue({ id: "r1" });
    mockBroadcastToUser.mockResolvedValue(undefined);

    const bodyWithoutVersion = { ...validBody, cli_version: undefined };
    const res = await POST(makeReq(bodyWithoutVersion));

    expect(res.status).toBe(200);
    expect(mockGetMachineByChhlat).toHaveBeenCalledTimes(1);
  });

  it("returns 400 when no workspace_id is provided or resolved", async () => {
    const POST = await loadRoute({ env: {}, userId: "u1", email: "u@t.com", authType: "user" as const });

    const body = {
      chhlat_id: "d1",
      device_name: "MyMachine",
      cli_version: "0.0.2",
      runtimes: [{ type: "claude", version: "1.0", runtime_mode: "local" }],
    };
    const res = await POST(makeReq(body));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("workspace_id is required");
    expect(mockUpsertMachine).not.toHaveBeenCalled();
  });

  it("uses auth context workspaceId when body workspace_id is missing", async () => {
    const POST = await loadRoute({ ...authCtx, workspaceId: "w_from_token" });

    mockGetMember.mockResolvedValue({ userId: "u1", workspaceId: "w_from_token" });
    mockUpsertMachine.mockResolvedValue(undefined);
    mockUpsertAgentRuntime.mockResolvedValue({ id: "r1" });
    mockBroadcastToUser.mockResolvedValue(undefined);

    const bodyWithoutWs = {
      chhlat_id: "d1",
      device_name: "MyMachine",
      cli_version: "0.0.2",
      runtimes: [{ type: "claude", version: "1.0", runtime_mode: "local" }],
    };
    const res = await POST(makeReq(bodyWithoutWs));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.workspaceId).toBe("w_from_token");
  });
});
