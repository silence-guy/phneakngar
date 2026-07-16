import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as sharedMock from "@/test/shared-mock";

const mockCompleteTask = vi.fn();
const mockTaskToResponse = vi.fn();
const mockGetConversation = vi.fn();
const mockGetTask = vi.fn();
const mockGetAgentRuntimeForWorkspace = vi.fn();
const mockMaybeCreateTaskDeliveryArtifact = vi.fn().mockResolvedValue(null);

let mockAuthCtx: Record<string, unknown> = {
  env: {},
  userId: "u1",
  email: "u@t.com",
  authType: "machine" as const,
  workspaceId: "w1",
};

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => ({ env: { DB: { withSession: () => ({}) } } })),
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
vi.mock("@/lib/middleware/helpers", () => {
  const { NextResponse } = require("next/server");
  return {
    writeJSON: (data: unknown, status = 200) => NextResponse.json(data, { status }),
    writeError: (message: string, status: number) => NextResponse.json({ error: message }, { status }),
    formatTimestamp: (d: Date | string | null) => d instanceof Date ? d.toISOString() : d || "",
    parseBody: async (req: Request, schema: { parse: (d: unknown) => unknown }) => {
      try {
        const data = await req.json();
        return [schema.parse(data), null];
      } catch {
        return [null, NextResponse.json({ error: "invalid request body" }, { status: 400 })];
      }
    },
  };
});
vi.mock("@/lib/services/task", () => {
  class TaskAlreadyTerminalError extends Error {
    readonly code = "TASK_ALREADY_TERMINAL";
    constructor(public readonly taskStatus: string) {
      super("task is already in a terminal state");
    }
  }
  const MockTaskService = function (this: any) {
    this.completeTask = (...a: any[]) => mockCompleteTask(...a);
  } as any;
  return {
    TaskService: MockTaskService,
    TaskAlreadyTerminalError,
    TASK_ALREADY_TERMINAL_CODE: "TASK_ALREADY_TERMINAL",
  };
});
vi.mock("@/lib/api/responses", () => ({
  taskToResponse: (...args: any[]) => mockTaskToResponse(...args),
}));
vi.mock("@/lib/broadcast", () => ({
  broadcastToUser: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/cache", () => ({
  invalidate: vi.fn().mockResolvedValue(undefined),
  invalidateInboxCounts: vi.fn().mockResolvedValue(undefined),
  cacheKeys: { overviewTaskStats: (w: string, d: string) => `ts:${w}:${d}` },
}));
vi.mock("@/lib/services/delivery-artifact", () => ({
  maybeCreateTaskDeliveryArtifact: (...args: unknown[]) =>
    mockMaybeCreateTaskDeliveryArtifact(...args),
}));

import { TaskAlreadyTerminalError } from "@/lib/services/task";
import { POST } from "./route";

const withParams = (taskId: string) => ({
  params: Promise.resolve({ taskId }),
});

const makeReq = (taskId: string, body: Record<string, unknown> = {}) =>
  new NextRequest(`http://localhost/api/chhlat/tasks/${taskId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /api/chhlat/tasks/[taskId]/complete", () => {
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

  it("returns completed task and broadcasts to conversation owner", async () => {
    const fakeTask = { id: "t1", agentId: "a1", conversationId: "c1", status: "completed" };
    mockCompleteTask.mockResolvedValue({ task: fakeTask, channelDelivery: null });
    mockGetConversation.mockResolvedValue({ id: "c1", userId: "owner-u2" });
    mockTaskToResponse.mockReturnValue({ id: "t1", status: "completed" });
    mockAuthCtx = {
      ...mockAuthCtx,
      env: { EMAIL_BUCKET: { put: vi.fn() } },
    };

    const res = await POST(makeReq("t1", { output: "done" }), withParams("t1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ id: "t1", status: "completed" });
    expect(mockGetTask).toHaveBeenCalledWith({}, "t1", "w1");
    expect(mockGetAgentRuntimeForWorkspace).toHaveBeenCalledWith({}, "rt1", "w1", "u1");
    expect(mockCompleteTask).toHaveBeenCalledWith("t1", "w1", expect.any(String), "");
    const { broadcastToUser } = await import("@/lib/broadcast");
    expect(broadcastToUser).toHaveBeenCalledWith("owner-u2", expect.objectContaining({ type: "task.updated", status: "completed" }));
    const { invalidateInboxCounts } = await import("@/lib/cache");
    expect(invalidateInboxCounts).toHaveBeenCalledWith("owner-u2", "w1");
    // C9: delivery artifact linked to completed task (workspace-scoped)
    expect(mockMaybeCreateTaskDeliveryArtifact).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ put: expect.any(Function) }),
      expect.objectContaining({
        workspaceId: "w1",
        agentId: "a1",
        conversationId: "c1",
        taskId: "t1",
        result: { output: "done" },
        ownerUserId: "owner-u2",
      }),
    );
  });

  it("links C9 delivery artifacts to the channel conversation when C3 delivered there", async () => {
    const fakeTask = {
      id: "t1",
      agentId: "a1",
      conversationId: "c_src",
      status: "completed",
    };
    mockCompleteTask.mockResolvedValue({
      task: fakeTask,
      channelDelivery: {
        conversationId: "c_channel",
        channelName: "standup",
        channelId: "ch_1",
        created: true,
        message: { id: "channel-delivery-t1" },
      },
    });
    mockGetConversation.mockResolvedValue({ id: "c_src", userId: "owner-u2" });
    mockTaskToResponse.mockReturnValue({ id: "t1", status: "completed" });
    mockAuthCtx = {
      ...mockAuthCtx,
      env: { EMAIL_BUCKET: { put: vi.fn() } },
    };

    const res = await POST(makeReq("t1", { output: "Morning brief" }), withParams("t1"));
    expect(res.status).toBe(200);
    expect(mockMaybeCreateTaskDeliveryArtifact).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ put: expect.any(Function) }),
      expect.objectContaining({
        workspaceId: "w1",
        agentId: "a1",
        conversationId: "c_channel",
        taskId: "t1",
        result: { output: "Morning brief" },
        ownerUserId: "owner-u2",
      }),
    );
  });

  it("still completes when delivery artifact hook returns null", async () => {
    const fakeTask = { id: "t1", agentId: "a1", conversationId: "c1", status: "completed" };
    mockCompleteTask.mockResolvedValue({ task: fakeTask, channelDelivery: null });
    mockGetConversation.mockResolvedValue({ id: "c1", userId: "owner-u2" });
    mockTaskToResponse.mockReturnValue({ id: "t1", status: "completed" });
    mockMaybeCreateTaskDeliveryArtifact.mockResolvedValueOnce(null);

    const res = await POST(makeReq("t1", { output: "done" }), withParams("t1"));
    expect(res.status).toBe(200);
    expect(mockMaybeCreateTaskDeliveryArtifact).toHaveBeenCalled();
  });

  it("does not call delivery artifact hook when complete fails as terminal", async () => {
    mockCompleteTask.mockRejectedValueOnce(new TaskAlreadyTerminalError("completed"));

    const res = await POST(makeReq("t1", { output: "done" }), withParams("t1"));
    expect(res.status).toBe(409);
    expect(mockMaybeCreateTaskDeliveryArtifact).not.toHaveBeenCalled();
  });

  it("returns 403 when workspaceId is missing (session auth)", async () => {
    mockAuthCtx = { env: {}, userId: "u1", email: "u@t.com", authType: "user" as const };

    const res = await POST(makeReq("t1", { output: "done" }), withParams("t1"));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe("Forbidden: machine token required");
    expect(mockCompleteTask).not.toHaveBeenCalled();
  });

  it("rejects cross-workspace task complete before calling the task service", async () => {
    mockGetTask.mockResolvedValueOnce(null);

    const res = await POST(makeReq("t-other", { output: "done" }), withParams("t-other"));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("task not found");
    expect(mockCompleteTask).not.toHaveBeenCalled();
  });

  it("returns a machine-readable conflict when the task is already terminal", async () => {
    mockCompleteTask.mockRejectedValueOnce(new TaskAlreadyTerminalError("completed"));

    const res = await POST(makeReq("t1", { output: "done" }), withParams("t1"));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body).toEqual({
      error: "task is already in a terminal state",
      code: "TASK_ALREADY_TERMINAL",
    });
  });

  it("keeps non-terminal transition errors distinct from terminal conflicts", async () => {
    mockCompleteTask.mockRejectedValueOnce(new Error("cannot complete task in 'queued' status"));

    const res = await POST(makeReq("t1", { output: "done" }), withParams("t1"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "cannot complete task in 'queued' status" });
  });

  it("rejects tasks owned by another machine runtime", async () => {
    mockGetAgentRuntimeForWorkspace.mockResolvedValueOnce(null);

    const res = await POST(makeReq("t1", { output: "done" }), withParams("t1"));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe("task runtime does not match token owner");
    expect(mockCompleteTask).not.toHaveBeenCalled();
  });
});
