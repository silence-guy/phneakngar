import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockCompactAgentMemory = vi.fn();
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

vi.mock("@/lib/services/memory-compaction", () => ({
  compactAgentMemory: (...a: unknown[]) => mockCompactAgentMemory(...a),
}));

import { POST } from "./route";

beforeEach(() => vi.clearAllMocks());

describe("POST /api/memory/compact", () => {
  it("runs compaction for workspace-wide memory", async () => {
    mockCompactAgentMemory.mockResolvedValue({
      compacted: true,
      reason: "ok",
      source_count: 3,
      deleted_count: 3,
      summary: "• [fact] one",
      memory: {
        id: "mem_s",
        workspaceId: "w1",
        agentId: null,
        kind: "summary",
        content: "• [fact] one",
        sourceTaskId: null,
        createdAt: "2026-07-16T00:00:00.000Z",
        updatedAt: "2026-07-16T00:00:00.000Z",
      },
    });

    const res = await POST(
      new NextRequest("http://localhost/api/memory/compact?workspace_id=w1", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "content-type": "application/json" },
      }),
      {} as any
    );

    expect(res.status).toBe(200);
    expect(mockGetAgent).not.toHaveBeenCalled();
    expect(mockCompactAgentMemory).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        workspaceId: "w1",
        agent_id: undefined,
      })
    );
    const body = await res.json();
    expect(body.compacted).toBe(true);
    expect(body.source_count).toBe(3);
    expect(body.deleted_count).toBe(3);
    expect(body.memory.id).toBe("mem_s");
    expect(body.memory.kind).toBe("summary");
  });

  it("validates agent exists when agent_id provided", async () => {
    mockGetAgent.mockResolvedValue(null);
    const res = await POST(
      new NextRequest("http://localhost/api/memory/compact", {
        method: "POST",
        body: JSON.stringify({ agent_id: "a9" }),
        headers: { "content-type": "application/json" },
      }),
      {} as any
    );
    expect(res.status).toBe(404);
    expect(mockCompactAgentMemory).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid body", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/memory/compact", {
        method: "POST",
        body: JSON.stringify({ min_notes: 0 }),
        headers: { "content-type": "application/json" },
      }),
      {} as any
    );
    expect(res.status).toBe(400);
    expect(mockCompactAgentMemory).not.toHaveBeenCalled();
  });

  it("forwards dry_run and options to the service", async () => {
    mockGetAgent.mockResolvedValue({ id: "a1" });
    mockCompactAgentMemory.mockResolvedValue({
      compacted: true,
      reason: "ok",
      source_count: 2,
      deleted_count: 0,
      summary: "• [fact] x",
      memory: null,
    });

    const res = await POST(
      new NextRequest("http://localhost/api/memory/compact", {
        method: "POST",
        body: JSON.stringify({
          agent_id: "a1",
          dry_run: true,
          min_notes: 2,
          max_notes: 10,
          max_length: 500,
        }),
        headers: { "content-type": "application/json" },
      }),
      {} as any
    );

    expect(res.status).toBe(200);
    expect(mockGetAgent).toHaveBeenCalledWith({}, "a1", "w1", "u1");
    expect(mockCompactAgentMemory).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        workspaceId: "w1",
        agent_id: "a1",
        dry_run: true,
        min_notes: 2,
        max_notes: 10,
        max_length: 500,
      })
    );
  });

  it("returns below_min_notes payload without a memory row", async () => {
    mockCompactAgentMemory.mockResolvedValue({
      compacted: false,
      reason: "below_min_notes",
      source_count: 1,
      deleted_count: 0,
      summary: null,
      memory: null,
    });

    const res = await POST(
      new NextRequest("http://localhost/api/memory/compact?workspace_id=w1", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "content-type": "application/json" },
      }),
      {} as any
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      compacted: false,
      reason: "below_min_notes",
      source_count: 1,
      deleted_count: 0,
      summary: null,
      memory: null,
    });
  });

  it("accepts agent_id null for shared-note compaction", async () => {
    mockCompactAgentMemory.mockResolvedValue({
      compacted: true,
      reason: "ok",
      source_count: 2,
      deleted_count: 2,
      summary: "• [fact] shared",
      memory: {
        id: "mem_s",
        workspaceId: "w1",
        agentId: null,
        kind: "summary",
        content: "• [fact] shared",
        sourceTaskId: null,
        createdAt: "2026-07-16T00:00:00.000Z",
        updatedAt: "2026-07-16T00:00:00.000Z",
      },
    });

    const res = await POST(
      new NextRequest("http://localhost/api/memory/compact?workspace_id=w1", {
        method: "POST",
        body: JSON.stringify({ agent_id: null }),
        headers: { "content-type": "application/json" },
      }),
      {} as any
    );

    expect(res.status).toBe(200);
    expect(mockGetAgent).not.toHaveBeenCalled();
    expect(mockCompactAgentMemory).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        workspaceId: "w1",
        agent_id: null,
      })
    );
  });
});
