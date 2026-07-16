import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetIssue = vi.fn();
const mockClaimIssue = vi.fn();
const mockGetAgent = vi.fn();

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => ({ env: { DB: {} } })),
}));

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

const mockCreateComment = vi.fn();

vi.mock("@phneakngar/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@phneakngar/shared")>();
  return {
    ...actual,
    queries: {
      issue: {
        getIssue: (...a: unknown[]) => mockGetIssue(...a),
        claimIssue: (...a: unknown[]) => mockClaimIssue(...a),
      },
      agent: {
        getAgent: (...a: unknown[]) => mockGetAgent(...a),
      },
      issueComment: {
        createComment: (...a: unknown[]) => mockCreateComment(...a),
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
  issueToResponse: (i: any) => ({
    id: i.id,
    status: i.status,
    claimed_by_agent_id: i.claimedByAgentId ?? null,
  }),
}));

vi.mock("@/lib/cache", () => ({
  invalidate: vi.fn().mockResolvedValue(undefined),
  cacheKeys: {
    overviewTaskStats: (ws: string, d: string) => `ov_task:${ws}:${d}`,
  },
}));

import { POST } from "./route";

beforeEach(() => vi.clearAllMocks());

describe("POST /api/issues/[id]/claim", () => {
  it("claims issue for agent", async () => {
    mockGetIssue.mockResolvedValue({ id: "iss_1", status: "todo" });
    mockGetAgent.mockResolvedValue({ id: "a1", name: "Ops" });
    mockClaimIssue.mockResolvedValue({
      id: "iss_1",
      status: "in_progress",
      claimedByAgentId: "a1",
    });
    mockCreateComment.mockResolvedValue({ id: "c1" });

    const res = await POST(
      new NextRequest("http://localhost/api/issues/iss_1/claim", {
        method: "POST",
        body: JSON.stringify({ agent_id: "a1" }),
        headers: { "content-type": "application/json" },
      }),
      { params: { id: "iss_1" } } as any
    );

    expect(res.status).toBe(200);
    expect(mockClaimIssue).toHaveBeenCalledWith(expect.anything(), "iss_1", "w1", "a1");
    expect(mockCreateComment).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        issueId: "iss_1",
        authorType: "agent",
        authorId: "a1",
        content: expect.stringContaining("Claimed"),
      }),
    );
    expect(await res.json()).toEqual({
      issue: { id: "iss_1", status: "in_progress", claimed_by_agent_id: "a1" },
    });
  });

  it("returns 409 when claim lost", async () => {
    mockGetIssue.mockResolvedValue({ id: "iss_1", status: "todo" });
    mockGetAgent.mockResolvedValue({ id: "a1" });
    mockClaimIssue.mockResolvedValue(null);

    const res = await POST(
      new NextRequest("http://localhost/api/issues/iss_1/claim", {
        method: "POST",
        body: JSON.stringify({ agent_id: "a1" }),
        headers: { "content-type": "application/json" },
      }),
      { params: { id: "iss_1" } } as any
    );

    expect(res.status).toBe(409);
  });

  it("returns 404 when issue missing", async () => {
    mockGetIssue.mockResolvedValue(null);
    const res = await POST(
      new NextRequest("http://localhost/api/issues/iss_1/claim", {
        method: "POST",
        body: JSON.stringify({ agent_id: "a1" }),
        headers: { "content-type": "application/json" },
      }),
      { params: { id: "iss_1" } } as any
    );
    expect(res.status).toBe(404);
  });
});
