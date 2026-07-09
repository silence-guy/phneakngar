import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockStartTask = vi.fn();
const mockTaskToResponse = vi.fn();
const mockGetConversation = vi.fn();
const mockGetTask = vi.fn();
const mockGetAgentRuntimeForWorkspace = vi.fn();

let mockAuthCtx: Record<string, unknown> = {
  env: {},
  userId: "u1",
  email: "u@t.com",
  authType: "machine" as const,
  workspaceId: "w1",
};

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
    task: { getTask: (...args: any[]) => mockGetTask(...args) },
    runtime: {
      getAgentRuntimeForWorkspace: (...args: any[]) => mockGetAgentRuntimeForWorkspace(...args),
    },
    conversation: { getConversation: (...args: any[]) => mockGetConversation(...args) },
  },
  };
});
vi.mock("@/lib/middleware/auth", () => ({
  withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => {
    const params = ctx?.params instanceof Promise ? await ctx.params : ctx?.params;
    return handler(req, { ...mockAuthCtx, params });
  }),
}));
vi.mock("@/lib/middleware/helpers", async () => {
  return await import("@/lib/middleware/helpers");
});
vi.mock("@/lib/broadcast", () => ({
  broadcastToUser: vi.fn().mockReturnValue(Promise.resolve()),
}));
vi.mock("@/lib/services/task", () => {
  const MockTaskService = function (this: any) {
    this.startTask = (...a: any[]) => mockStartTask(...a);
  } as any;
  return { TaskService: MockTaskService };
});
vi.mock("@/lib/api/responses", () => ({
  taskToResponse: (...args: any[]) => mockTaskToResponse(...args),
}));

import { POST } from "./route";

const withParams = (taskId: string) => ({
  params: Promise.resolve({ taskId }),
});

const makeReq = (taskId: string) =>
  new NextRequest(`http://localhost/api/daemon/tasks/${taskId}/start`, {
    method: "POST",
  });

describe("POST /api/daemon/tasks/[taskId]/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthCtx = {
      env: {},
      userId: "u1",
      email: "u@t.com",
      authType: "machine" as const,
      workspaceId: "w1",
    };
    mockGetTask.mockResolvedValue({ id: "t1", runtimeId: "rt1", workspaceId: "w1" });
    mockGetAgentRuntimeForWorkspace.mockResolvedValue({ id: "rt1" });
  });

  it("returns started task and broadcasts to conversation owner", async () => {
    const fakeTask = {
      id: "t1",
      agentId: "a1",
      conversationId: "c1",
      status: "running",
    };
    mockStartTask.mockResolvedValue(fakeTask);
    mockGetConversation.mockResolvedValue({ id: "c1", userId: "owner-u2" });
    mockTaskToResponse.mockReturnValue({ id: "t1", status: "running" });

    const res = await POST(makeReq("t1"), withParams("t1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ id: "t1", status: "running" });
    expect(mockGetTask).toHaveBeenCalledWith({}, "t1", "w1");
    expect(mockGetAgentRuntimeForWorkspace).toHaveBeenCalledWith({}, "rt1", "w1", "u1");
    expect(mockStartTask).toHaveBeenCalledWith("t1", "w1");
    const { broadcastToUser } = await import("@/lib/broadcast");
    expect(broadcastToUser).toHaveBeenCalledWith("owner-u2", expect.objectContaining({ type: "task.updated", status: "running" }));
  });

  it("skips broadcast gracefully when conversation not found", async () => {
    const fakeTask = { id: "t1", agentId: "a1", conversationId: "c-deleted", status: "running" };
    mockStartTask.mockResolvedValue(fakeTask);
    mockGetConversation.mockResolvedValue(null);
    mockTaskToResponse.mockReturnValue({ id: "t1", status: "running" });

    const res = await POST(makeReq("t1"), withParams("t1"));
    expect(res.status).toBe(200);
    const { broadcastToUser } = await import("@/lib/broadcast");
    expect(broadcastToUser).not.toHaveBeenCalled();
  });

  it("returns 400 when task not in dispatched status", async () => {
    mockStartTask.mockRejectedValue(new Error("task not in dispatched status"));

    const res = await POST(makeReq("t1"), withParams("t1"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("task not in dispatched status");
  });

  it("returns 403 when workspaceId is missing (session auth)", async () => {
    mockAuthCtx = { env: {}, userId: "u1", email: "u@t.com", authType: "user" as const };

    const res = await POST(makeReq("t1"), withParams("t1"));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe("Forbidden: machine token required");
    expect(mockStartTask).not.toHaveBeenCalled();
  });

  it("rejects cross-workspace task start before calling the task service", async () => {
    mockGetTask.mockResolvedValueOnce(null);

    const res = await POST(makeReq("t-other"), withParams("t-other"));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("task not found");
    expect(mockStartTask).not.toHaveBeenCalled();
  });

  it("rejects tasks owned by another machine runtime", async () => {
    mockGetAgentRuntimeForWorkspace.mockResolvedValueOnce(null);

    const res = await POST(makeReq("t1"), withParams("t1"));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe("task runtime does not match token owner");
    expect(mockStartTask).not.toHaveBeenCalled();
  });
});
