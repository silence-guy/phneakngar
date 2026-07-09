import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetTaskStatus = vi.fn();
const mockGetTask = vi.fn();
const mockGetAgentRuntimeForWorkspace = vi.fn();

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
    createDb: vi.fn(() => ({})),
  queries: {
    task: {
      getTask: (...args: any[]) => mockGetTask(...args),
      getTaskStatus: (...args: any[]) => mockGetTaskStatus(...args),
    },
    runtime: {
      getAgentRuntimeForWorkspace: (...args: any[]) => mockGetAgentRuntimeForWorkspace(...args),
    },
  },
  };
});
vi.mock("@/lib/middleware/auth", () => ({
  withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => {
    const params = ctx?.params instanceof Promise ? await ctx.params : ctx?.params;
    return handler(req, {
      env: {},
      userId: "u1",
      email: "u@t.com",
      authType: "machine" as const,
      workspaceId: "w1",
      params,
    });
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

import { GET } from "./route";

const withParams = (taskId: string) => ({
  params: Promise.resolve({ taskId }),
});

describe("GET /api/daemon/tasks/[taskId]/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTask.mockResolvedValue({ id: "t1", runtimeId: "rt1", workspaceId: "w1" });
    mockGetAgentRuntimeForWorkspace.mockResolvedValue({ id: "rt1" });
  });

  it("returns task status", async () => {
    mockGetTaskStatus.mockResolvedValue("running");

    const res = await GET(
      new NextRequest("http://localhost/api/daemon/tasks/t1/status"),
      withParams("t1")
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ status: "running" });
    expect(mockGetTask).toHaveBeenCalledWith({}, "t1", "w1");
    expect(mockGetAgentRuntimeForWorkspace).toHaveBeenCalledWith({}, "rt1", "w1", "u1");
    expect(mockGetTaskStatus).toHaveBeenCalledWith({}, "t1", "w1");
  });

  it("returns 404 when task is not found for the token workspace", async () => {
    mockGetTask.mockResolvedValueOnce(null);

    const res = await GET(
      new NextRequest("http://localhost/api/daemon/tasks/t-missing/status"),
      withParams("t-missing")
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("task not found");
    expect(mockGetTaskStatus).not.toHaveBeenCalled();
  });

  it("returns 403 when the task runtime does not belong to the token owner", async () => {
    mockGetAgentRuntimeForWorkspace.mockResolvedValueOnce(null);

    const res = await GET(
      new NextRequest("http://localhost/api/daemon/tasks/t1/status"),
      withParams("t1")
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe("task runtime does not match token owner");
    expect(mockGetTaskStatus).not.toHaveBeenCalled();
  });
});
