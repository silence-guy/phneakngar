import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockDeleteRuntimesByChhlatId = vi.fn();
const mockDeleteMachine = vi.fn();
const mockGetMachineByChhlat = vi.fn();
const mockGetMemberByUserAndWorkspace = vi.fn();

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => ({ env: { DB: {} } })),
}));
vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

vi.mock("@phneakngar/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@phneakngar/shared")>();
  return {
    ...actual,
    createDb: vi.fn(() => ({})),
  queries: {
    runtime: {
      deleteRuntimesByChhlatId: (...args: any[]) =>
        mockDeleteRuntimesByChhlatId(...args),
    },
    machine: {
      deleteMachine: (...args: any[]) =>
        mockDeleteMachine(...args),
      getMachineByChhlat: (...args: any[]) =>
        mockGetMachineByChhlat(...args),
    },
    member: {
      getMemberByUserAndWorkspace: (...args: any[]) =>
        mockGetMemberByUserAndWorkspace(...args),
    },
  },
  };
});
vi.mock("@/lib/middleware/auth", () => ({
  withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => {
    const params =
      ctx?.params instanceof Promise ? await ctx.params : ctx?.params;
    return handler(req, { env: {}, userId: "u1", email: "u@t.com", params });
  }),
}));
vi.mock("@/lib/middleware/workspace", () => ({
  withWorkspaceMember: vi.fn(async (req: any) => {
    const wsId = req.nextUrl.searchParams.get("workspace_id");
    if (!wsId) {
      const { NextResponse } = await import("next/server");
      return NextResponse.json({ error: "workspace_id is required" }, { status: 400 });
    }
    // Check member mock
    const member = await mockGetMemberByUserAndWorkspace({}, "u1", wsId);
    if (!member) {
      const { NextResponse } = await import("next/server");
      return NextResponse.json({ error: "workspace not found" }, { status: 404 });
    }
    return { workspaceId: wsId };
  }),
}));
vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/broadcast", () => ({
  broadcastToUser: vi.fn().mockResolvedValue(undefined),
  broadcastToChhlat: vi.fn().mockResolvedValue({ sent: 1 }),
}));

import { DELETE } from "./route";

function makeReq(params: Record<string, string>) {
  const url = new URL("http://localhost/api/runtimes/machine");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url.toString(), { method: "DELETE" });
}

describe("DELETE /api/runtimes/machine", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when chhlat_id is missing", async () => {
    mockGetMemberByUserAndWorkspace.mockResolvedValue({ id: "m1" });

    const res = await DELETE(makeReq({ workspace_id: "w1" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("chhlat_id");
  });

  it("returns 400 when workspace_id is missing", async () => {
    const res = await DELETE(makeReq({ chhlat_id: "d1" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("workspace_id");
  });

  it("returns 404 when user is not a workspace member", async () => {
    mockGetMemberByUserAndWorkspace.mockResolvedValue(null);

    const res = await DELETE(makeReq({ chhlat_id: "d1", workspace_id: "w-other" }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toContain("workspace not found");
  });

  it("returns 204 on successful delete (TC-12)", async () => {
    mockGetMemberByUserAndWorkspace.mockResolvedValue({ id: "m1" });
    mockGetMachineByChhlat.mockResolvedValue({ chhlatId: "d1", ownerId: "u1" });
    mockDeleteRuntimesByChhlatId.mockResolvedValue(undefined);
    mockDeleteMachine.mockResolvedValue(undefined);

    const res = await DELETE(
      makeReq({ chhlat_id: "d1", workspace_id: "w1" })
    );

    expect(res.status).toBe(204);
  });

  it("TC-11: returns 404 when deleting another member's machine", async () => {
    mockGetMemberByUserAndWorkspace.mockResolvedValue({ id: "m1" });
    mockGetMachineByChhlat.mockResolvedValue({ chhlatId: "d1", ownerId: "other-user" });

    const res = await DELETE(
      makeReq({ chhlat_id: "d1", workspace_id: "w1" })
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toContain("not found");
    expect(mockDeleteRuntimesByChhlatId).not.toHaveBeenCalled();
  });

  it("returns 404 when machine does not exist", async () => {
    mockGetMemberByUserAndWorkspace.mockResolvedValue({ id: "m1" });
    mockGetMachineByChhlat.mockResolvedValue(null);

    const res = await DELETE(
      makeReq({ chhlat_id: "d1", workspace_id: "w1" })
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toContain("not found");
  });

  it("passes correct chhlat_id with dots and dashes", async () => {
    mockGetMemberByUserAndWorkspace.mockResolvedValue({ id: "m1" });
    mockGetMachineByChhlat.mockResolvedValue({ chhlatId: "my-chhlat.v2.host-01", ownerId: "u1" });
    mockDeleteRuntimesByChhlatId.mockResolvedValue(undefined);
    mockDeleteMachine.mockResolvedValue(undefined);

    const chhlatId = "my-chhlat.v2.host-01";
    await DELETE(makeReq({ chhlat_id: chhlatId, workspace_id: "w1" }));

    expect(mockDeleteRuntimesByChhlatId).toHaveBeenCalledWith(
      {},
      chhlatId,
      "w1"
    );
  });

  it("calls deleteRuntimesByChhlatId exactly once", async () => {
    mockGetMemberByUserAndWorkspace.mockResolvedValue({ id: "m1" });
    mockGetMachineByChhlat.mockResolvedValue({ chhlatId: "d1", ownerId: "u1" });
    mockDeleteRuntimesByChhlatId.mockResolvedValue(undefined);
    mockDeleteMachine.mockResolvedValue(undefined);

    await DELETE(makeReq({ chhlat_id: "d1", workspace_id: "w1" }));

    expect(mockDeleteRuntimesByChhlatId).toHaveBeenCalledOnce();
  });

  it("returns 500 when deleteRuntimesByChhlatId throws", async () => {
    mockGetMemberByUserAndWorkspace.mockResolvedValue({ id: "m1" });
    mockGetMachineByChhlat.mockResolvedValue({ chhlatId: "d1", ownerId: "u1" });
    mockDeleteRuntimesByChhlatId.mockRejectedValue(new Error("DB exploded"));

    const res = await DELETE(
      makeReq({ chhlat_id: "d1", workspace_id: "w1" })
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toContain("Failed to remove machine");
  });

  it("broadcasts chhlat.evict on successful delete", async () => {
    const { broadcastToChhlat } = await import("@/lib/broadcast");
    mockGetMemberByUserAndWorkspace.mockResolvedValue({ id: "m1" });
    mockGetMachineByChhlat.mockResolvedValue({ chhlatId: "d1", ownerId: "u1" });
    mockDeleteRuntimesByChhlatId.mockResolvedValue(undefined);
    mockDeleteMachine.mockResolvedValue(undefined);

    await DELETE(makeReq({ chhlat_id: "d1", workspace_id: "w1" }));

    expect(broadcastToChhlat).toHaveBeenCalledWith("d1", {
      type: "chhlat.evict",
      workspaceId: "w1",
    });
  });
});
