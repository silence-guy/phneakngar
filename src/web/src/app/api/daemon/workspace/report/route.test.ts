import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as sharedMock from "@/test/shared-mock";

const mockGetRequestForWorkspace = vi.fn();
const mockCompleteRequestForWorkspace = vi.fn();
const mockBroadcastToUser = vi.fn();

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

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => ({})),
  withD1Retry: vi.fn((fn: () => Promise<any>) => fn()),
}));

vi.mock("@phneakngar/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@phneakngar/shared")>();
  return {
    ...actual,
    queries: {
    workspaceFileRequest: {
      getRequestForWorkspace: (...args: unknown[]) => mockGetRequestForWorkspace(...args),
      completeRequestForWorkspace: (...args: unknown[]) => mockCompleteRequestForWorkspace(...args),
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

vi.mock("@/lib/middleware/helpers", async () =>
  await import("@/lib/middleware/helpers")
);

vi.mock("@/lib/broadcast", () => ({
  broadcastToUser: (...args: unknown[]) => mockBroadcastToUser(...args),
}));

import { POST } from "./route";

function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/daemon/workspace/report", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/daemon/workspace/report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthCtx = {
      env: {},
      userId: "u1",
      email: "u@t.com",
      authType: "machine" as const,
      workspaceId: "w1",
    };
  });

  it("requires machine token auth", async () => {
    mockAuthCtx = { env: {}, userId: "u1", email: "u@t.com", authType: "user" as const, workspaceId: "w1" };

    const res = await POST(postReq({ request_id: "wfr_1", path: "." }));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe("Forbidden: machine token required");
    expect(mockGetRequestForWorkspace).not.toHaveBeenCalled();
  });

  it("returns 404 when request is not found in the token workspace", async () => {
    mockGetRequestForWorkspace.mockResolvedValue(null);

    const res = await POST(postReq({ request_id: "wfr_missing", path: "." }));
    expect(res.status).toBe(404);
    expect(mockGetRequestForWorkspace).toHaveBeenCalledWith({}, "w1", "wfr_missing");
    expect(mockCompleteRequestForWorkspace).not.toHaveBeenCalled();
  });

  it("completes request and broadcasts result for tree", async () => {
    const entries = [
      { name: "memory.md", path: "memory.md", isDirectory: false, size: 100, modifiedAt: "2026-01-01" },
    ];
    mockGetRequestForWorkspace.mockResolvedValue({
      id: "wfr_1",
      agentId: "a1",
      requestType: "tree",
      workspaceId: "w1",
    });
    mockCompleteRequestForWorkspace.mockResolvedValue({ id: "wfr_1" });
    mockBroadcastToUser.mockResolvedValue(undefined);

    const res = await POST(postReq({ request_id: "wfr_1", path: ".", entries }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(mockCompleteRequestForWorkspace).toHaveBeenCalledWith({}, "w1", "wfr_1", {
      entries,
      content: undefined,
      isBinary: undefined,
      error: undefined,
      path: ".",
    });
    expect(mockBroadcastToUser).toHaveBeenCalledWith("u1", {
      type: "workspace.files",
      agentId: "a1",
      requestId: "wfr_1",
      requestType: "tree",
      result: expect.objectContaining({ entries, path: "." }),
    });
  });

  it("does not broadcast if scoped completion loses the row", async () => {
    mockGetRequestForWorkspace.mockResolvedValue({
      id: "wfr_1",
      agentId: "a1",
      requestType: "tree",
      workspaceId: "w1",
    });
    mockCompleteRequestForWorkspace.mockResolvedValue(null);

    const res = await POST(postReq({ request_id: "wfr_1", path: ".", entries: [] }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("request not found");
    expect(mockBroadcastToUser).not.toHaveBeenCalled();
  });

  it("completes request and broadcasts for file read", async () => {
    mockGetRequestForWorkspace.mockResolvedValue({
      id: "wfr_2",
      agentId: "a1",
      requestType: "read",
      workspaceId: "w1",
    });
    mockCompleteRequestForWorkspace.mockResolvedValue({ id: "wfr_2" });
    mockBroadcastToUser.mockResolvedValue(undefined);

    const res = await POST(postReq({
      request_id: "wfr_2",
      path: "memory.md",
      content: "# Hello",
      isBinary: false,
    }));

    expect(res.status).toBe(200);
    expect(mockBroadcastToUser).toHaveBeenCalledWith("u1", {
      type: "workspace.files",
      agentId: "a1",
      requestId: "wfr_2",
      requestType: "read",
      result: expect.objectContaining({ content: "# Hello", isBinary: false, path: "memory.md" }),
    });
  });

  it("handles error report from daemon", async () => {
    mockGetRequestForWorkspace.mockResolvedValue({
      id: "wfr_3",
      agentId: "a1",
      requestType: "read",
      workspaceId: "w1",
    });
    mockCompleteRequestForWorkspace.mockResolvedValue({ id: "wfr_3" });
    mockBroadcastToUser.mockResolvedValue(undefined);

    const res = await POST(postReq({
      request_id: "wfr_3",
      path: "missing.txt",
      error: "ENOENT: no such file",
    }));

    expect(res.status).toBe(200);
    expect(mockBroadcastToUser).toHaveBeenCalledWith("u1", expect.objectContaining({
      result: expect.objectContaining({ error: "ENOENT: no such file" }),
    }));
  });

  it("returns 400 when request_id is missing", async () => {
    const res = await POST(postReq({ path: "." }));
    expect(res.status).toBe(400);
  });
});
