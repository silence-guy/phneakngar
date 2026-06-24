import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetConversation = vi.fn();
const mockGetTask = vi.fn();
const mockGetAgentRuntimeForWorkspace = vi.fn();
const mockSupersede = vi.fn();

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => ({ env: { DB: {} } })),
}));
vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("@alook/shared", () => ({
  queries: {
    task: { getTask: (...args: any[]) => mockGetTask(...args) },
    runtime: {
      getAgentRuntimeForWorkspace: (...args: any[]) => mockGetAgentRuntimeForWorkspace(...args),
    },
    conversation: { getConversation: (...args: any[]) => mockGetConversation(...args) },
  },
}));

vi.mock("@/lib/services/task", () => ({
  TaskService: function () { return { supersedeTask: mockSupersede }; },
}));
vi.mock("@/lib/api/responses", () => ({ taskToResponse: (t: any) => ({ id: t.id, status: t.status }) }));
vi.mock("@/lib/broadcast", () => ({ broadcastToUser: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/cache", () => ({
  invalidate: vi.fn().mockResolvedValue(undefined),
  invalidateInboxCounts: vi.fn().mockResolvedValue(undefined),
  cacheKeys: { overviewTaskStats: (w: string, d: string) => `ts:${w}:${d}` },
}));

let injectWorkspaceId: string | undefined = "w1";
vi.mock("@/lib/middleware/auth", () => ({
  withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => {
    const params = ctx?.params instanceof Promise ? await ctx.params : ctx?.params;
    return handler(req, {
      env: {},
      userId: "u1",
      email: "u@t.com",
      authType: injectWorkspaceId ? ("machine" as const) : ("user" as const),
      workspaceId: injectWorkspaceId,
      params,
    });
  }),
}));

import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  injectWorkspaceId = "w1";
  mockGetTask.mockResolvedValue({ id: "t1", runtimeId: "rt1", workspaceId: "w1" });
  mockGetAgentRuntimeForWorkspace.mockResolvedValue({ id: "rt1" });
});

const post = (params: Record<string, string>) =>
  POST(new NextRequest("http://localhost/x", { method: "POST" }), { params });

describe("POST /api/daemon/tasks/[taskId]/supersede", () => {
  it("403 when no workspace (machine token required)", async () => {
    injectWorkspaceId = undefined;
    const res = await post({ taskId: "t1" });
    expect(res.status).toBe(403);
    expect(mockSupersede).not.toHaveBeenCalled();
  });

  it("400 when taskId missing", async () => {
    const res = await post({});
    expect(res.status).toBe(400);
    expect(mockSupersede).not.toHaveBeenCalled();
  });

  it("supersedes a task and broadcasts to conversation owner", async () => {
    mockSupersede.mockResolvedValue({ id: "t1", agentId: "a1", conversationId: "c1", status: "superseded" });
    mockGetConversation.mockResolvedValue({ id: "c1", userId: "owner-u2" });
    const res = await post({ taskId: "t1" });
    expect(res.status).toBe(200);
    expect(mockGetTask).toHaveBeenCalledWith({}, "t1", "w1");
    expect(mockGetAgentRuntimeForWorkspace).toHaveBeenCalledWith({}, "rt1", "w1", "u1");
    expect(mockSupersede).toHaveBeenCalledWith("t1", "w1");
    expect((await res.json()).id).toBe("t1");
    const { broadcastToUser } = await import("@/lib/broadcast");
    expect(broadcastToUser).toHaveBeenCalledWith("owner-u2", expect.objectContaining({ type: "task.updated", status: "superseded" }));
    const { invalidateInboxCounts } = await import("@/lib/cache");
    expect(invalidateInboxCounts).toHaveBeenCalledWith("owner-u2", "w1");
  });

  it("404 when task is not found for the token workspace", async () => {
    mockGetTask.mockResolvedValueOnce(null);
    const res = await post({ taskId: "t-other" });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("task not found");
    expect(mockSupersede).not.toHaveBeenCalled();
  });

  it("403 when task runtime does not belong to token owner", async () => {
    mockGetAgentRuntimeForWorkspace.mockResolvedValueOnce(null);
    const res = await post({ taskId: "t1" });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("task runtime does not match token owner");
    expect(mockSupersede).not.toHaveBeenCalled();
  });

  it("400 when supersede throws after authorization", async () => {
    mockSupersede.mockRejectedValue(new Error("task not found"));
    const res = await post({ taskId: "t1" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("task not found");
  });
});
