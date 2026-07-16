import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetChannelById = vi.fn();
const mockListChannelMembers = vi.fn();
const mockAddChannelMember = vi.fn();
const mockRemoveChannelMember = vi.fn();
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
      channel: {
        getChannelById: (...args: any[]) => mockGetChannelById(...args),
      },
      channelMember: {
        listChannelMembers: (...args: any[]) => mockListChannelMembers(...args),
        addChannelMember: (...args: any[]) => mockAddChannelMember(...args),
        removeChannelMember: (...args: any[]) => mockRemoveChannelMember(...args),
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
  channelMemberToResponse: (m: any) => ({
    id: m.id,
    workspace_id: m.workspaceId,
    channel_id: m.channelId,
    member_type: m.memberType,
    member_id: m.memberId,
    created_at: m.createdAt,
  }),
}));

import { GET, POST, DELETE } from "./route";

const CH = { id: "ch_1", workspaceId: "w1", name: "work", createdAt: "2024-01-01T00:00:00Z" };
const CM = {
  id: "cm_1",
  workspaceId: "w1",
  channelId: "ch_1",
  memberType: "agent",
  memberId: "a1",
  createdAt: "2024-01-01T00:00:00Z",
};

function getReq(id: string) {
  return [
    new NextRequest(`http://localhost/api/channels/${id}/members?workspace_id=w1`),
    { params: Promise.resolve({ id }) },
  ] as const;
}

function postReq(id: string, body: Record<string, unknown>) {
  return [
    new NextRequest(`http://localhost/api/channels/${id}/members?workspace_id=w1`, {
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
      `http://localhost/api/channels/${id}/members?workspace_id=w1&member_type=${memberType}&member_id=${memberId}`,
      { method: "DELETE" },
    ),
    { params: Promise.resolve({ id }) },
  ] as const;
}

describe("GET /api/channels/[id]/members", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists members workspace-scoped", async () => {
    mockGetChannelById.mockResolvedValue(CH);
    mockListChannelMembers.mockResolvedValue([CM]);

    const [req, ctx] = getReq("ch_1");
    const res = await GET(req, ctx as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].member_id).toBe("a1");
    expect(mockListChannelMembers).toHaveBeenCalledWith({}, "w1", "ch_1");
  });

  it("returns 404 when channel missing", async () => {
    mockGetChannelById.mockResolvedValue(null);
    const [req, ctx] = getReq("missing");
    const res = await GET(req, ctx as any);
    expect(res.status).toBe(404);
  });
});

describe("POST /api/channels/[id]/members", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetChannelById.mockResolvedValue(CH);
  });

  it("adds an agent member", async () => {
    mockGetAgent.mockResolvedValue({ id: "a1", workspaceId: "w1" });
    mockAddChannelMember.mockResolvedValue(CM);

    const [req, ctx] = postReq("ch_1", { member_type: "agent", member_id: "a1" });
    const res = await POST(req, ctx as any);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.member.member_type).toBe("agent");
    expect(mockAddChannelMember).toHaveBeenCalledWith({}, {
      workspaceId: "w1",
      channelId: "ch_1",
      memberType: "agent",
      memberId: "a1",
    });
  });

  it("adds a user member", async () => {
    mockGetMemberByUserAndWorkspace.mockResolvedValue({ id: "m1", userId: "u2" });
    mockAddChannelMember.mockResolvedValue({
      ...CM,
      memberType: "user",
      memberId: "u2",
    });

    const [req, ctx] = postReq("ch_1", { member_type: "user", member_id: "u2" });
    const res = await POST(req, ctx as any);
    expect(res.status).toBe(201);
    expect(mockGetMemberByUserAndWorkspace).toHaveBeenCalledWith({}, "u2", "w1");
  });

  it("returns 404 for unknown agent", async () => {
    mockGetAgent.mockResolvedValue(null);
    const [req, ctx] = postReq("ch_1", { member_type: "agent", member_id: "missing" });
    const res = await POST(req, ctx as any);
    expect(res.status).toBe(404);
    expect(mockAddChannelMember).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/channels/[id]/members", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetChannelById.mockResolvedValue(CH);
  });

  it("removes a member", async () => {
    mockRemoveChannelMember.mockResolvedValue(CM);
    const [req, ctx] = deleteReq("ch_1", "agent", "a1");
    const res = await DELETE(req, ctx as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockRemoveChannelMember).toHaveBeenCalledWith(
      {},
      "w1",
      "ch_1",
      "agent",
      "a1",
    );
  });

  it("returns 404 when membership missing", async () => {
    mockRemoveChannelMember.mockResolvedValue(null);
    const [req, ctx] = deleteReq("ch_1", "agent", "a1");
    const res = await DELETE(req, ctx as any);
    expect(res.status).toBe(404);
  });

  it("rejects invalid member_type", async () => {
    const [req, ctx] = deleteReq("ch_1", "bot", "a1");
    const res = await DELETE(req, ctx as any);
    expect(res.status).toBe(400);
  });
});
