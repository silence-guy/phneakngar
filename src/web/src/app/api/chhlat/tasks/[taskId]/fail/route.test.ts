import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as sharedMock from "@/test/shared-mock";

const mockFailTask = vi.fn();
const mockTaskToResponse = vi.fn();
const mockGetConversation = vi.fn();
const mockGetTask = vi.fn();
const mockGetAgentRuntimeForWorkspace = vi.fn();
const mockHandlePlaybookTaskTerminal = vi.fn().mockResolvedValue(undefined);

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
vi.mock("@/lib/middleware/helpers", () => ({
  writeJSON: (data: unknown, status = 200) => { const { NextResponse } = require("next/server"); return NextResponse.json(data, { status }); },
  writeError: (message: string, status: number) => { const { NextResponse } = require("next/server"); return NextResponse.json({ error: message }, { status }); },
  formatTimestamp: (date: Date | string | null) => date ? new Date(date as string).toISOString().replace(/\.\d{3}Z$/, "Z") : "",
  formatTimestampNullable: (date: Date | string | null) => date ? new Date(date as string).toISOString().replace(/\.\d{3}Z$/, "Z") : null,
  parseBody: async (req: Request, schema: { parse: (d: unknown) => unknown }) => {
    try {
      const data = await req.json();
      return [schema.parse(data), null];
    } catch {
      return [null, { status: 400, error: "invalid request body" }];
    }
  },
}));
vi.mock("@/lib/services/task", () => {
  class TaskAlreadyTerminalError extends Error {
    readonly code = "TASK_ALREADY_TERMINAL";
    constructor(public readonly taskStatus: string) {
      super("task is already in a terminal state");
    }
  }
  const MockTaskService = function (this: any) {
    this.failTask = (...a: any[]) => mockFailTask(...a);
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
vi.mock("@/lib/services/playbook-engine", () => ({
  handlePlaybookTaskTerminal: (...args: unknown[]) => mockHandlePlaybookTaskTerminal(...args),
}));
vi.mock("@/lib/email-domain", () => ({
  resolveServerEmailDomain: vi.fn(() => "test.dev"),
}));
vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { TaskAlreadyTerminalError } from "@/lib/services/task";
import { POST } from "./route";

const withParams = (taskId: string) => ({
  params: Promise.resolve({ taskId }),
});

const makeReq = (taskId: string, body: Record<string, unknown> = {}) =>
  new NextRequest(`http://localhost/api/chhlat/tasks/${taskId}/fail`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /api/chhlat/tasks/[taskId]/fail", () => {
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

  it("returns failed task and broadcasts to conversation owner", async () => {
    const fakeTask = { id: "t1", agentId: "a1", conversationId: "c1", status: "failed" };
    mockFailTask.mockResolvedValue(fakeTask);
    mockGetConversation.mockResolvedValue({ id: "c1", userId: "owner-u2" });
    mockTaskToResponse.mockReturnValue({ id: "t1", status: "failed" });

    const res = await POST(makeReq("t1", { error: "boom" }), withParams("t1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ id: "t1", status: "failed" });
    expect(mockGetTask).toHaveBeenCalledWith({}, "t1", "w1");
    expect(mockGetAgentRuntimeForWorkspace).toHaveBeenCalledWith({}, "rt1", "w1", "u1");
    expect(mockFailTask).toHaveBeenCalledWith("t1", "w1", "boom");
    const { broadcastToUser } = await import("@/lib/broadcast");
    expect(broadcastToUser).toHaveBeenCalledWith("owner-u2", expect.objectContaining({ type: "task.updated", status: "failed" }));
    const { invalidateInboxCounts } = await import("@/lib/cache");
    expect(invalidateInboxCounts).toHaveBeenCalledWith("owner-u2", "w1");
  });

  it("returns 403 when workspaceId is missing (session auth)", async () => {
    mockAuthCtx = { env: {}, userId: "u1", email: "u@t.com", authType: "user" as const };

    const res = await POST(makeReq("t1", { error: "boom" }), withParams("t1"));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe("Forbidden: machine token required");
    expect(mockFailTask).not.toHaveBeenCalled();
  });

  it("rejects cross-workspace task fail before calling the task service", async () => {
    mockGetTask.mockResolvedValueOnce(null);

    const res = await POST(makeReq("t-other", { error: "boom" }), withParams("t-other"));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("task not found");
    expect(mockFailTask).not.toHaveBeenCalled();
  });

  it("returns a machine-readable conflict when the task is already terminal", async () => {
    mockFailTask.mockRejectedValueOnce(new TaskAlreadyTerminalError("failed"));

    const res = await POST(makeReq("t1", { error: "boom" }), withParams("t1"));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body).toEqual({
      error: "task is already in a terminal state",
      code: "TASK_ALREADY_TERMINAL",
    });
  });

  it("keeps non-terminal transition errors distinct from terminal conflicts", async () => {
    mockFailTask.mockRejectedValueOnce(new Error("cannot fail task in 'queued' status"));

    const res = await POST(makeReq("t1", { error: "boom" }), withParams("t1"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "cannot fail task in 'queued' status" });
  });

  it("rejects tasks owned by another machine runtime", async () => {
    mockGetAgentRuntimeForWorkspace.mockResolvedValueOnce(null);

    const res = await POST(makeReq("t1", { error: "boom" }), withParams("t1"));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe("task runtime does not match token owner");
    expect(mockFailTask).not.toHaveBeenCalled();
  });

  it("fails the playbook step with emailDomain when the task is a playbook step", async () => {
    const fakeTask = {
      id: "t1",
      agentId: "a1",
      conversationId: "c1",
      status: "failed",
      type: "playbook_step",
      context: { playbook_run_id: "pbr_1", playbook_step_id: "s1" },
    };
    mockFailTask.mockResolvedValue(fakeTask);
    mockGetConversation.mockResolvedValue({ id: "c1", userId: "owner-u2" });
    mockTaskToResponse.mockReturnValue({ id: "t1", status: "failed" });

    const res = await POST(makeReq("t1", { error: "boom" }), withParams("t1"));
    expect(res.status).toBe(200);
    expect(mockHandlePlaybookTaskTerminal).toHaveBeenCalledWith(
      {},
      fakeTask,
      "failed",
      { error: "boom", emailDomain: "test.dev" },
    );
  });

  it("does not call the playbook hook for non-playbook tasks", async () => {
    const fakeTask = {
      id: "t1",
      agentId: "a1",
      conversationId: "c1",
      status: "failed",
      type: "user_dm_message",
      context: {},
    };
    mockFailTask.mockResolvedValue(fakeTask);
    mockGetConversation.mockResolvedValue({ id: "c1", userId: "owner-u2" });
    mockTaskToResponse.mockReturnValue({ id: "t1", status: "failed" });

    const res = await POST(makeReq("t1", { error: "boom" }), withParams("t1"));
    expect(res.status).toBe(200);
    expect(mockHandlePlaybookTaskTerminal).not.toHaveBeenCalled();
  });
});
