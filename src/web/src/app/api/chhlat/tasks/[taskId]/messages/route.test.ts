import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as sharedMock from "@/test/shared-mock";

const mockListTaskMessages = vi.fn();
const mockCreateTaskMessage = vi.fn();
const mockGetTask = vi.fn();
const mockGetAgentRuntimeForWorkspace = vi.fn();
const mockTaskMessageToResponse = vi.fn((m: any) => m);
const mockGetConversation = vi.fn();

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
vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => ({})),
  withD1Retry: vi.fn((fn: () => Promise<any>) => fn()),
}));
vi.mock("@phneakngar/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@phneakngar/shared")>();
  return {
    ...actual,
    createDb: vi.fn(() => ({})),
  queries: {
    taskMessage: {
      TaskMessageConflictError: actual.queries.taskMessage.TaskMessageConflictError,
      taskMessagePayloadFingerprint: actual.queries.taskMessage.taskMessagePayloadFingerprint,
      listTaskMessages: (...args: any[]) => mockListTaskMessages(...args),
      createTaskMessage: (...args: any[]) => mockCreateTaskMessage(...args),
    },
    task: {
      getTask: (...args: any[]) => mockGetTask(...args),
    },
    runtime: {
      getAgentRuntimeForWorkspace: (...args: any[]) => mockGetAgentRuntimeForWorkspace(...args),
    },
    conversation: {
      getConversation: (...args: any[]) => mockGetConversation(...args),
    },
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
vi.mock("@/lib/api/responses", () => ({
  taskMessageToResponse: (...args: any[]) => mockTaskMessageToResponse(...args),
}));
const mockBroadcastToUser = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/broadcast", () => ({
  broadcastToUser: (...args: any[]) => mockBroadcastToUser(...args),
}));
vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { queries } from "@phneakngar/shared";
import { GET, POST } from "./route";

const withParams = (taskId: string) => ({
  params: Promise.resolve({ taskId }),
});

const messageReq = (taskId: string, messages: Array<Record<string, unknown>>) =>
  new NextRequest(`http://localhost/api/chhlat/tasks/${taskId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthCtx = {
    env: {},
    userId: "u1",
    email: "u@t.com",
    authType: "machine" as const,
    workspaceId: "w1",
  };
  mockGetTask.mockResolvedValue({ id: "t1", workspaceId: "w1", runtimeId: "rt1", conversationId: "c1" });
  mockGetAgentRuntimeForWorkspace.mockResolvedValue({ id: "rt1" });
});

describe("GET /api/chhlat/tasks/[taskId]/messages", () => {
  it("returns messages for workspace-scoped task", async () => {
    const msgs = [{ id: "m1", seq: 1, content: "hi" }];
    mockListTaskMessages.mockResolvedValue(msgs);

    const res = await GET(
      new NextRequest("http://localhost/api/chhlat/tasks/t1/messages"),
      withParams("t1")
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(mockGetTask).toHaveBeenCalledWith({}, "t1", "w1");
    expect(mockGetAgentRuntimeForWorkspace).toHaveBeenCalledWith({}, "rt1", "w1", "u1");
    expect(mockListTaskMessages).toHaveBeenCalledWith({}, "t1", "w1");
  });

  it("returns 403 when workspaceId is missing (session auth)", async () => {
    mockAuthCtx = { env: {}, userId: "u1", email: "u@t.com", authType: "user" as const };

    const res = await GET(
      new NextRequest("http://localhost/api/chhlat/tasks/t1/messages"),
      withParams("t1")
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe("Forbidden: machine token required");
    expect(mockListTaskMessages).not.toHaveBeenCalled();
  });

  it("returns 403 when the task runtime is owned by another chhlat", async () => {
    mockGetAgentRuntimeForWorkspace.mockResolvedValueOnce(null);

    const res = await GET(
      new NextRequest("http://localhost/api/chhlat/tasks/t1/messages"),
      withParams("t1")
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe("task runtime does not match token owner");
    expect(mockListTaskMessages).not.toHaveBeenCalled();
  });
});

describe("POST /api/chhlat/tasks/[taskId]/messages", () => {
  it("creates messages for workspace-scoped task", async () => {
    mockGetConversation.mockResolvedValue({ id: "c1", userId: "owner-u2" });
    mockCreateTaskMessage.mockResolvedValue({
      message: { id: "m1", seq: 1, type: "text", content: "hello", output: "" },
      created: true,
    });

    const res = await POST(messageReq("t1", [{ seq: 1, type: "text", content: "hello" }]), withParams("t1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(mockGetTask).toHaveBeenCalledWith({}, "t1", "w1");
    expect(mockGetAgentRuntimeForWorkspace).toHaveBeenCalledWith({}, "rt1", "w1", "u1");
    expect(mockCreateTaskMessage).toHaveBeenCalledTimes(1);
  });

  it("returns 403 when workspaceId is missing (session auth)", async () => {
    mockAuthCtx = { env: {}, userId: "u1", email: "u@t.com", authType: "user" as const };

    const res = await POST(messageReq("t1", [{ seq: 1, type: "text", content: "hello" }]), withParams("t1"));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe("Forbidden: machine token required");
    expect(mockGetTask).not.toHaveBeenCalled();
  });

  it("returns 404 when task belongs to another workspace", async () => {
    mockGetTask.mockResolvedValueOnce(null);

    const res = await POST(messageReq("t-other", [{ seq: 1, type: "text", content: "hello" }]), withParams("t-other"));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("task not found");
    expect(mockCreateTaskMessage).not.toHaveBeenCalled();
  });

  it("returns 403 when the task runtime is owned by another chhlat", async () => {
    mockGetAgentRuntimeForWorkspace.mockResolvedValueOnce(null);

    const res = await POST(messageReq("t1", [{ seq: 1, type: "text", content: "hello" }]), withParams("t1"));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe("task runtime does not match token owner");
    expect(mockCreateTaskMessage).not.toHaveBeenCalled();
  });

  it("only broadcasts text and error messages via WebSocket to conversation owner", async () => {
    mockGetConversation.mockResolvedValue({ id: "c1", userId: "owner-u2" });
    mockCreateTaskMessage.mockImplementation((_db, data) => Promise.resolve({
      message: { id: `m${data.seq}`, ...data },
      created: true,
    }));

    const res = await POST(
      messageReq("t1", [
        { seq: 1, type: "text", content: "hello" },
        { seq: 2, type: "tool-result", content: "large payload" },
        { seq: 3, type: "tool-use", tool: "grep", content: "" },
      ]),
      withParams("t1")
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(mockCreateTaskMessage).toHaveBeenCalledTimes(3);
    expect(mockBroadcastToUser).toHaveBeenCalledTimes(1);
    expect(mockBroadcastToUser.mock.calls[0][0]).toBe("owner-u2");
    const broadcastPayload = mockBroadcastToUser.mock.calls[0][1];
    expect(broadcastPayload.messages).toHaveLength(1);
    expect(broadcastPayload.messages[0].type).toBe("text");
  });

  it("stores thinking messages but does not broadcast them", async () => {
    mockGetConversation.mockResolvedValue({ id: "c1", userId: "owner-u2" });
    mockCreateTaskMessage.mockImplementation((_db, data) => Promise.resolve({
      message: { id: `m${data.seq}`, ...data },
      created: true,
    }));

    const res = await POST(
      messageReq("t1", [
        { seq: 1, type: "text", content: "hello" },
        { seq: 2, type: "thinking", content: "hmm" },
      ]),
      withParams("t1")
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(mockCreateTaskMessage).toHaveBeenCalledTimes(2);
    expect(mockBroadcastToUser).toHaveBeenCalledTimes(1);
    const broadcastPayload = mockBroadcastToUser.mock.calls[0][1];
    expect(broadcastPayload.messages).toHaveLength(1);
    expect(broadcastPayload.messages[0].type).toBe("text");
  });

  it("does not broadcast when all messages are tool-result", async () => {
    mockGetConversation.mockResolvedValue({ id: "c1", userId: "owner-u2" });
    mockCreateTaskMessage.mockImplementation((_db, data) => Promise.resolve({
      message: { id: `m${data.seq}`, ...data },
      created: true,
    }));

    await POST(
      messageReq("t1", [
        { seq: 1, type: "tool-result", content: "result1" },
        { seq: 2, type: "tool-result", content: "result2" },
      ]),
      withParams("t1")
    );

    expect(mockBroadcastToUser).not.toHaveBeenCalled();
  });

  it("acknowledges an exact replay without broadcasting it again", async () => {
    mockGetConversation.mockResolvedValue({ id: "c1", userId: "owner-u2" });
    mockCreateTaskMessage.mockResolvedValue({
      message: { id: "m1", seq: 1, type: "text", content: "hello", output: "" },
      created: false,
    });

    const res = await POST(
      messageReq("t1", [{ seq: 1, type: "text", content: "hello" }]),
      withParams("t1"),
    );

    expect(res.status).toBe(200);
    expect(mockBroadcastToUser).not.toHaveBeenCalled();
  });

  it("returns 503 for a partial storage failure and broadcasts nothing", async () => {
    mockGetConversation.mockResolvedValue({ id: "c1", userId: "owner-u2" });
    mockCreateTaskMessage
      .mockResolvedValueOnce({
        message: { id: "m1", seq: 1, type: "text", content: "stored", output: "" },
        created: true,
      })
      .mockRejectedValueOnce(new Error("D1 unavailable"));

    const res = await POST(
      messageReq("t1", [
        { seq: 1, type: "text", content: "stored" },
        { seq: 2, type: "error", content: "not stored" },
      ]),
      withParams("t1"),
    );
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.error).toBe("task messages were not fully stored");
    expect(mockBroadcastToUser).not.toHaveBeenCalled();
  });

  it("returns 409 when the same task sequence has a conflicting payload", async () => {
    mockCreateTaskMessage.mockRejectedValue(
      new queries.taskMessage.TaskMessageConflictError("t1", 1),
    );

    const res = await POST(
      messageReq("t1", [{ seq: 1, type: "text", content: "different" }]),
      withParams("t1"),
    );

    expect(res.status).toBe(409);
    expect(mockBroadcastToUser).not.toHaveBeenCalled();
  });

  it("rejects conflicting duplicate sequences in the submitted batch before writing", async () => {
    const res = await POST(
      messageReq("t1", [
        { seq: 1, type: "text", content: "first" },
        { seq: 1, type: "text", content: "different" },
      ]),
      withParams("t1"),
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("task message payload conflict");
    expect(mockCreateTaskMessage).not.toHaveBeenCalled();
    expect(mockBroadcastToUser).not.toHaveBeenCalled();
  });

  it("deduplicates identical duplicate sequences in the submitted batch", async () => {
    mockCreateTaskMessage.mockResolvedValue({
      message: { id: "m1", seq: 1, type: "text", content: "same", output: "" },
      created: true,
    });

    const res = await POST(
      messageReq("t1", [
        { seq: 1, type: "text", content: "same" },
        { seq: 1, type: "text", content: "same" },
      ]),
      withParams("t1"),
    );

    expect(res.status).toBe(200);
    expect(mockCreateTaskMessage).toHaveBeenCalledOnce();
  });

  it("preserves retryability when a batch has both conflict and transient failures", async () => {
    mockCreateTaskMessage
      .mockRejectedValueOnce(new queries.taskMessage.TaskMessageConflictError("t1", 1))
      .mockRejectedValueOnce(new Error("D1 unavailable"));

    const res = await POST(
      messageReq("t1", [
        { seq: 1, type: "text", content: "conflict" },
        { seq: 2, type: "error", content: "transient" },
      ]),
      withParams("t1"),
    );
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.error).toBe("task messages were not fully stored");
    expect(mockBroadcastToUser).not.toHaveBeenCalled();
  });
});
