import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockListMemory = vi.fn();
const mockCreateMemory = vi.fn();
const mockGetAgent = vi.fn();

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => ({ env: { DB: {} } })),
}));

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

vi.mock("@phneakngar/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@phneakngar/shared")>();
  return {
    ...actual,
    queries: {
      agentMemory: {
        listMemory: (...a: unknown[]) => mockListMemory(...a),
        createMemory: (...a: unknown[]) => mockCreateMemory(...a),
      },
      agent: {
        getAgent: (...a: unknown[]) => mockGetAgent(...a),
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
  memoryToResponse: (row: any) => ({
    id: row.id,
    workspace_id: row.workspaceId,
    agent_id: row.agentId ?? null,
    kind: row.kind,
    content: row.content,
    source_task_id: row.sourceTaskId ?? null,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }),
}));

import { GET, POST } from "./route";

beforeEach(() => vi.clearAllMocks());

describe("GET /api/memory", () => {
  it("lists workspace memory", async () => {
    mockListMemory.mockResolvedValue([
      {
        id: "mem_1",
        workspaceId: "w1",
        agentId: null,
        kind: "fact",
        content: "Prefer short updates",
        sourceTaskId: null,
        createdAt: "2026-07-16T00:00:00.000Z",
        updatedAt: "2026-07-16T00:00:00.000Z",
      },
    ]);

    const res = await GET(new NextRequest("http://localhost/api/memory?workspace_id=w1"), {} as any);
    expect(res.status).toBe(200);
    expect(mockListMemory).toHaveBeenCalledWith({}, "w1", {
      agentId: undefined,
      kind: undefined,
      limit: 100,
    });
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe("mem_1");
  });

  it("filters by agent_id and kind", async () => {
    mockListMemory.mockResolvedValue([]);
    const res = await GET(
      new NextRequest("http://localhost/api/memory?agent_id=a1&kind=preference&limit=10"),
      {} as any
    );
    expect(res.status).toBe(200);
    expect(mockListMemory).toHaveBeenCalledWith({}, "w1", {
      agentId: "a1",
      kind: "preference",
      limit: 10,
    });
  });
});

describe("POST /api/memory", () => {
  it("creates workspace memory", async () => {
    mockCreateMemory.mockResolvedValue({
      id: "mem_2",
      workspaceId: "w1",
      agentId: null,
      kind: "decision",
      content: "Ship approvals first",
      sourceTaskId: null,
      createdAt: "2026-07-16T00:00:00.000Z",
      updatedAt: "2026-07-16T00:00:00.000Z",
    });

    const res = await POST(
      new NextRequest("http://localhost/api/memory", {
        method: "POST",
        body: JSON.stringify({ kind: "decision", content: "Ship approvals first" }),
        headers: { "content-type": "application/json" },
      }),
      {} as any
    );

    expect(res.status).toBe(201);
    expect(mockCreateMemory).toHaveBeenCalledWith({}, {
      workspaceId: "w1",
      agentId: null,
      kind: "decision",
      content: "Ship approvals first",
      sourceTaskId: null,
    });
    expect(mockGetAgent).not.toHaveBeenCalled();
  });

  it("validates agent exists when agent_id provided", async () => {
    mockGetAgent.mockResolvedValue(null);
    const res = await POST(
      new NextRequest("http://localhost/api/memory", {
        method: "POST",
        body: JSON.stringify({ agent_id: "a9", kind: "fact", content: "x" }),
        headers: { "content-type": "application/json" },
      }),
      {} as any
    );
    expect(res.status).toBe(404);
    expect(mockCreateMemory).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid body", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/memory", {
        method: "POST",
        body: JSON.stringify({ kind: "nope", content: "" }),
        headers: { "content-type": "application/json" },
      }),
      {} as any
    );
    expect(res.status).toBe(400);
  });
});
