import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockListApprovals = vi.fn();

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => ({ env: { DB: {} } })),
}));

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

vi.mock("@phneakngar/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@phneakngar/shared")>();
  return {
    ...actual,
    queries: {
      approval: {
        listApprovals: (...a: unknown[]) => mockListApprovals(...a),
      },
    },
  };
});

vi.mock("@/lib/middleware/auth", () => ({
  withAuth: (handler: any) => async (req: any, ctx?: any) => {
    const params = ctx?.params instanceof Promise ? await ctx.params : ctx?.params;
    return handler(req, { env: {}, userId: "u1", email: "u@t.com", params });
  },
}));

vi.mock("@/lib/middleware/workspace", () => ({
  withWorkspaceMember: vi.fn(async () => ({ workspaceId: "w1" })),
}));

vi.mock("@/lib/api/responses", () => ({
  approvalToResponse: (row: any) => ({
    id: row.id,
    status: row.status,
    kind: row.kind,
    title: row.title,
  }),
}));

import { GET } from "./route";

beforeEach(() => vi.clearAllMocks());

describe("GET /api/approvals", () => {
  it("lists pending approvals by default filter", async () => {
    mockListApprovals.mockResolvedValue([
      { id: "ap_1", status: "pending", kind: "outbound_email", title: "Send reply" },
    ]);

    const res = await GET(
      new NextRequest("http://localhost/api/approvals?status=pending"),
      {} as any
    );
    expect(res.status).toBe(200);
    expect(mockListApprovals).toHaveBeenCalledWith({}, "w1", {
      status: "pending",
      agentId: undefined,
      kind: undefined,
      limit: 100,
    });
    const body = await res.json();
    expect(body.items).toEqual([
      { id: "ap_1", status: "pending", kind: "outbound_email", title: "Send reply" },
    ]);
  });

  it("passes agent_id and limit", async () => {
    mockListApprovals.mockResolvedValue([]);
    const res = await GET(
      new NextRequest("http://localhost/api/approvals?agent_id=a1&limit=5"),
      {} as any
    );
    expect(res.status).toBe(200);
    expect(mockListApprovals).toHaveBeenCalledWith({}, "w1", {
      status: undefined,
      agentId: "a1",
      kind: undefined,
      limit: 5,
    });
  });

  it("passes kind=skill_install for G2 proposal listing", async () => {
    mockListApprovals.mockResolvedValue([
      {
        id: "ap_skill",
        status: "pending",
        kind: "skill_install",
        title: "deploy-helper",
      },
    ]);

    const res = await GET(
      new NextRequest(
        "http://localhost/api/approvals?status=pending&kind=skill_install",
      ),
      {} as any,
    );
    expect(res.status).toBe(200);
    expect(mockListApprovals).toHaveBeenCalledWith({}, "w1", {
      status: "pending",
      agentId: undefined,
      kind: "skill_install",
      limit: 100,
    });
    const body = await res.json();
    expect(body.items).toEqual([
      {
        id: "ap_skill",
        status: "pending",
        kind: "skill_install",
        title: "deploy-helper",
      },
    ]);
  });
});
