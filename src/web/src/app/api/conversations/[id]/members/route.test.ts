import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetConversation = vi.fn();
const mockListConversationMembers = vi.fn();
const mockEnsurePrimaryConversationMembers = vi.fn();
const mockAddConversationMember = vi.fn();
const mockRemoveConversationMember = vi.fn();
const mockGetAgent = vi.fn();
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
      conversation: {
        getConversation: (...args: any[]) => mockGetConversation(...args),
      },
      conversationMember: {
        listConversationMembers: (...args: any[]) => mockListConversationMembers(...args),
        ensurePrimaryConversationMembers: (...args: any[]) =>
          mockEnsurePrimaryConversationMembers(...args),
        addConversationMember: (...args: any[]) => mockAddConversationMember(...args),
        removeConversationMember: (...args: any[]) => mockRemoveConversationMember(...args),
      },
      agent: {
        getAgent: (...args: any[]) => mockGetAgent(...args),
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
    const params = ctx?.params instanceof Promise ? await ctx.params : ctx?.params;
    return handler(req, { env: {}, userId: "u1", email: "u@t.com", params });
  }),
}));
vi.mock("@/lib/middleware/workspace", () => ({
  withWorkspaceMember: vi.fn(async () => ({ workspaceId: "w1" })),
}));
vi.mock("@/lib/api/responses", () => ({
  conversationMemberToResponse: (m: any) => ({
    id: m.id,
    workspace_id: m.workspaceId,
    conversation_id: m.conversationId,
    member_type: m.memberType,
    member_id: m.memberId,
    created_at: m.createdAt,
  }),
}));

import { GET, POST, DELETE } from "./route";

const CONV = {
  id: "c1",
  workspaceId: "w1",
  agentId: "ag1",
  userId: "u1",
  createdAt: "2024-01-01T00:00:00Z",
};
const CM = {
  id: "cvm_1",
  workspaceId: "w1",
  conversationId: "c1",
  memberType: "agent",
  memberId: "ag1",
  createdAt: "2024-01-01T00:00:00Z",
};

function getReq(id: string) {
  return [
    new NextRequest(`http://localhost/api/conversations/${id}/members?workspace_id=w1`),
    { params: Promise.resolve({ id }) },
  ] as const;
}

function postReq(id: string, body: Record<string, unknown>) {
  return [
    new NextRequest(`http://localhost/api/conversations/${id}/members?workspace_id=w1`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
    { params: Promise.resolve({ id }) },
  ] as const;
}

function deleteReq(id: string, memberType: string, memberId: string) {
  return [
    new NextRequest(
      `http://localhost/api/conversations/${id}/members?workspace_id=w1&member_type=${memberType}&member_id=${memberId}`,
      { method: "DELETE" },
    ),
    { params: Promise.resolve({ id }) },
  ] as const;
}

describe("GET /api/conversations/[id]/members", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists members workspace-scoped via ensurePrimary", async () => {
    mockGetConversation.mockResolvedValue(CONV);
    mockEnsurePrimaryConversationMembers.mockResolvedValue([CM]);

    const [req, ctx] = getReq("c1");
    const res = await GET(req, ctx as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].member_id).toBe("ag1");
    expect(mockEnsurePrimaryConversationMembers).toHaveBeenCalledWith(
      {},
      "w1",
      CONV,
    );
  });

  it("returns 404 when conversation missing", async () => {
    mockGetConversation.mockResolvedValue(null);
    const [req, ctx] = getReq("missing");
    const res = await GET(req, ctx as any);
    expect(res.status).toBe(404);
  });
});

describe("POST /api/conversations/[id]/members", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConversation.mockResolvedValue(CONV);
  });

  it("adds an agent member", async () => {
    mockGetAgent.mockResolvedValue({ id: "ag2", workspaceId: "w1" });
    mockAddConversationMember.mockResolvedValue({
      ...CM,
      id: "cvm_2",
      memberId: "ag2",
    });

    const [req, ctx] = postReq("c1", { member_type: "agent", member_id: "ag2" });
    const res = await POST(req, ctx as any);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.member.member_type).toBe("agent");
    expect(body.member.member_id).toBe("ag2");
    expect(mockAddConversationMember).toHaveBeenCalledWith({}, {
      workspaceId: "w1",
      conversationId: "c1",
      memberType: "agent",
      memberId: "ag2",
    });
  });

  it("adds a user member", async () => {
    mockGetMemberByUserAndWorkspace.mockResolvedValue({ id: "m1", userId: "u2" });
    mockAddConversationMember.mockResolvedValue({
      ...CM,
      memberType: "user",
      memberId: "u2",
    });

    const [req, ctx] = postReq("c1", { member_type: "user", member_id: "u2" });
    const res = await POST(req, ctx as any);
    expect(res.status).toBe(201);
    expect(mockGetMemberByUserAndWorkspace).toHaveBeenCalledWith({}, "u2", "w1");
  });

  it("returns 404 for unknown agent", async () => {
    mockGetAgent.mockResolvedValue(null);
    const [req, ctx] = postReq("c1", { member_type: "agent", member_id: "missing" });
    const res = await POST(req, ctx as any);
    expect(res.status).toBe(404);
    expect(mockAddConversationMember).not.toHaveBeenCalled();
  });

  it("soft-idempotent re-add returns existing member", async () => {
    mockGetAgent.mockResolvedValue({ id: "ag1", workspaceId: "w1" });
    mockAddConversationMember.mockResolvedValue(CM);

    const [req, ctx] = postReq("c1", { member_type: "agent", member_id: "ag1" });
    const res = await POST(req, ctx as any);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.member.id).toBe("cvm_1");
    expect(mockAddConversationMember).toHaveBeenCalledWith({}, {
      workspaceId: "w1",
      conversationId: "c1",
      memberType: "agent",
      memberId: "ag1",
    });
  });

  it("returns 500 when add cannot resolve unique conflict", async () => {
    mockGetAgent.mockResolvedValue({ id: "ag2", workspaceId: "w1" });
    mockAddConversationMember.mockResolvedValue(null);
    const [req, ctx] = postReq("c1", { member_type: "agent", member_id: "ag2" });
    const res = await POST(req, ctx as any);
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/conversations/[id]/members", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConversation.mockResolvedValue(CONV);
  });

  it("removes a member", async () => {
    mockRemoveConversationMember.mockResolvedValue(CM);
    const [req, ctx] = deleteReq("c1", "agent", "ag1");
    const res = await DELETE(req, ctx as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockRemoveConversationMember).toHaveBeenCalledWith(
      {},
      "w1",
      "c1",
      "agent",
      "ag1",
    );
  });

  it("returns 404 when membership missing", async () => {
    mockRemoveConversationMember.mockResolvedValue(null);
    const [req, ctx] = deleteReq("c1", "agent", "ag1");
    const res = await DELETE(req, ctx as any);
    expect(res.status).toBe(404);
  });

  it("rejects invalid member_type", async () => {
    const [req, ctx] = deleteReq("c1", "bot", "ag1");
    const res = await DELETE(req, ctx as any);
    expect(res.status).toBe(400);
  });
});
