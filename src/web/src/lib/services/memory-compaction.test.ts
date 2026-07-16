import { describe, it, expect, vi, beforeEach } from "vitest";

const mockListMemory = vi.fn();
const mockDeleteMemoriesByIds = vi.fn();
const mockCreateMemory = vi.fn();

vi.mock("@phneakngar/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@phneakngar/shared")>();
  return {
    ...actual,
    queries: {
      agentMemory: {
        listMemory: (...a: unknown[]) => mockListMemory(...a),
        deleteMemoriesByIds: (...a: unknown[]) => mockDeleteMemoriesByIds(...a),
        createMemory: (...a: unknown[]) => mockCreateMemory(...a),
      },
    },
  };
});

import { compactAgentMemory } from "./memory-compaction";
import { MEMORY_SUMMARY_KIND } from "@phneakngar/shared";

function note(
  id: string,
  content: string,
  kind = "fact",
  updatedAt = "2026-07-01T00:00:00.000Z",
  agentId: string | null = "a1"
) {
  return {
    id,
    workspaceId: "w1",
    agentId,
    kind,
    content,
    sourceTaskId: null,
    createdAt: updatedAt,
    updatedAt,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("compactAgentMemory", () => {
  it("no-ops when fewer than min_notes non-summary rows exist", async () => {
    mockListMemory.mockResolvedValue([note("m1", "only one")]);

    const result = await compactAgentMemory({} as any, {
      workspaceId: "w1",
      agent_id: "a1",
    });

    expect(result.compacted).toBe(false);
    expect(result.reason).toBe("below_min_notes");
    expect(result.source_count).toBe(1);
    expect(mockDeleteMemoriesByIds).not.toHaveBeenCalled();
    expect(mockCreateMemory).not.toHaveBeenCalled();
  });

  it("respects custom min_notes threshold", async () => {
    mockListMemory.mockResolvedValue([
      note("m1", "one"),
      note("m2", "two"),
    ]);

    const result = await compactAgentMemory({} as any, {
      workspaceId: "w1",
      agent_id: "a1",
      min_notes: 3,
    });

    expect(result.compacted).toBe(false);
    expect(result.reason).toBe("below_min_notes");
    expect(result.source_count).toBe(2);
    expect(mockCreateMemory).not.toHaveBeenCalled();
  });

  it("does not treat prior summary rows as compactable sources", async () => {
    mockListMemory.mockResolvedValue([
      note("s1", "old summary", MEMORY_SUMMARY_KIND),
      note("s2", "older summary", MEMORY_SUMMARY_KIND),
    ]);

    const result = await compactAgentMemory({} as any, {
      workspaceId: "w1",
      agent_id: "a1",
      min_notes: 1,
    });

    expect(result.compacted).toBe(false);
    expect(result.reason).toBe("below_min_notes");
    expect(result.source_count).toBe(0);
    expect(mockDeleteMemoriesByIds).not.toHaveBeenCalled();
    expect(mockCreateMemory).not.toHaveBeenCalled();
  });

  it("returns empty_summary when max_length collapses all content", async () => {
    mockListMemory.mockResolvedValue([
      note("m1", "alpha"),
      note("m2", "beta"),
    ]);

    const result = await compactAgentMemory({} as any, {
      workspaceId: "w1",
      agent_id: "a1",
      max_length: 0,
    });

    expect(result.compacted).toBe(false);
    expect(result.reason).toBe("empty_summary");
    expect(result.source_count).toBe(2);
    expect(result.summary).toBeNull();
    expect(mockDeleteMemoriesByIds).not.toHaveBeenCalled();
    expect(mockCreateMemory).not.toHaveBeenCalled();
  });

  it("compacts sources into one summary and deletes source + prior summary rows", async () => {
    mockListMemory.mockResolvedValue([
      note("m1", "likes tea", "preference", "2026-07-01T00:00:00.000Z"),
      note("m2", "ship v1", "decision", "2026-07-02T00:00:00.000Z"),
      note("m3", "old summary", MEMORY_SUMMARY_KIND, "2026-07-03T00:00:00.000Z"),
    ]);
    mockCreateMemory.mockResolvedValue({
      id: "mem_summary",
      workspaceId: "w1",
      agentId: "a1",
      kind: MEMORY_SUMMARY_KIND,
      content: "summary",
      sourceTaskId: null,
      createdAt: "2026-07-16T00:00:00.000Z",
      updatedAt: "2026-07-16T00:00:00.000Z",
    });
    mockDeleteMemoriesByIds.mockResolvedValue([
      { id: "m1" },
      { id: "m2" },
      { id: "m3" },
    ]);

    const result = await compactAgentMemory({} as any, {
      workspaceId: "w1",
      agent_id: "a1",
    });

    expect(mockListMemory).toHaveBeenCalledWith({}, "w1", {
      agentId: "a1",
      limit: 500,
    });
    expect(result.compacted).toBe(true);
    expect(result.reason).toBe("ok");
    expect(result.source_count).toBe(2);
    expect(result.deleted_count).toBe(3);
    expect(result.summary).toContain("[decision]");
    expect(result.summary).toContain("[preference]");
    expect(mockCreateMemory).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        workspaceId: "w1",
        agentId: "a1",
        kind: MEMORY_SUMMARY_KIND,
        content: result.summary,
      })
    );
    expect(mockDeleteMemoriesByIds).toHaveBeenCalledWith(
      {},
      "w1",
      expect.arrayContaining(["m1", "m2", "m3"])
    );
    // Durable write order: create summary before deleting sources.
    expect(mockCreateMemory.mock.invocationCallOrder[0]).toBeLessThan(
      mockDeleteMemoriesByIds.mock.invocationCallOrder[0]
    );
    expect(result.memory?.id).toBe("mem_summary");
  });

  it("forwards max_notes and max_length into the compacted summary", async () => {
    mockListMemory.mockResolvedValue([
      note("m1", "alpha note", "decision", "2026-07-01T00:00:00.000Z"),
      note("m2", "beta note", "fact", "2026-07-02T00:00:00.000Z"),
      note("m3", "gamma note", "role", "2026-07-03T00:00:00.000Z"),
    ]);
    mockCreateMemory.mockImplementation(async (_db: unknown, data: { content: string }) => ({
      id: "mem_s",
      workspaceId: "w1",
      agentId: "a1",
      kind: MEMORY_SUMMARY_KIND,
      content: data.content,
      sourceTaskId: null,
      createdAt: "2026-07-16T00:00:00.000Z",
      updatedAt: "2026-07-16T00:00:00.000Z",
    }));
    mockDeleteMemoriesByIds.mockResolvedValue([{ id: "m1" }, { id: "m2" }, { id: "m3" }]);

    const result = await compactAgentMemory({} as any, {
      workspaceId: "w1",
      agent_id: "a1",
      max_notes: 2,
      max_length: 40,
    });

    expect(result.compacted).toBe(true);
    expect(result.summary).toBeTruthy();
    expect(result.summary!.length).toBeLessThanOrEqual(40);
    expect(result.summary).not.toContain("[role]");
    expect(mockCreateMemory).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ content: result.summary })
    );
  });

  it("dry_run returns summary without mutating D1", async () => {
    mockListMemory.mockResolvedValue([
      note("m1", "alpha", "fact", "2026-07-01T00:00:00.000Z", null),
      note("m2", "beta", "fact", "2026-07-01T00:00:00.000Z", null),
    ]);

    const result = await compactAgentMemory({} as any, {
      workspaceId: "w1",
      agent_id: null,
      dry_run: true,
    });

    expect(result.compacted).toBe(true);
    expect(result.summary).toContain("alpha");
    expect(result.summary).toContain("beta");
    expect(result.deleted_count).toBe(0);
    expect(result.memory).toBeNull();
    expect(mockDeleteMemoriesByIds).not.toHaveBeenCalled();
    expect(mockCreateMemory).not.toHaveBeenCalled();
    expect(mockListMemory).toHaveBeenCalledWith({}, "w1", {
      agentId: null,
      limit: 500,
    });
  });

  it("omitted agent_id scopes shared notes only (agent_id IS NULL)", async () => {
    mockListMemory.mockResolvedValue([
      note("m1", "shared-a", "fact", "2026-07-01T00:00:00.000Z", null),
      note("m2", "shared-b", "fact", "2026-07-02T00:00:00.000Z", null),
    ]);
    mockCreateMemory.mockResolvedValue({
      id: "mem_s",
      workspaceId: "w1",
      agentId: null,
      kind: MEMORY_SUMMARY_KIND,
      content: "x",
      sourceTaskId: null,
      createdAt: "2026-07-16T00:00:00.000Z",
      updatedAt: "2026-07-16T00:00:00.000Z",
    });
    mockDeleteMemoriesByIds.mockResolvedValue([{ id: "m1" }, { id: "m2" }]);

    await compactAgentMemory({} as any, {
      workspaceId: "w1",
    });

    expect(mockListMemory).toHaveBeenCalledWith({}, "w1", {
      agentId: null,
      limit: 500,
    });
    expect(mockCreateMemory).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ workspaceId: "w1", agentId: null })
    );
  });

  it("writes fewer durable rows than the source note set", async () => {
    mockListMemory.mockResolvedValue([
      note("m1", "one", "fact", "2026-07-01T00:00:00.000Z", null),
      note("m2", "two", "fact", "2026-07-01T00:00:00.000Z", null),
      note("m3", "three", "fact", "2026-07-01T00:00:00.000Z", null),
    ]);
    mockCreateMemory.mockResolvedValue({
      id: "mem_s",
      workspaceId: "w1",
      agentId: null,
      kind: MEMORY_SUMMARY_KIND,
      content: "x",
      sourceTaskId: null,
      createdAt: "2026-07-16T00:00:00.000Z",
      updatedAt: "2026-07-16T00:00:00.000Z",
    });
    mockDeleteMemoriesByIds.mockResolvedValue([
      { id: "m1" },
      { id: "m2" },
      { id: "m3" },
    ]);

    const result = await compactAgentMemory({} as any, {
      workspaceId: "w1",
    });

    // 3 sources deleted, 1 summary created → net fewer rows
    expect(result.source_count).toBe(3);
    expect(result.deleted_count).toBe(3);
    expect(result.memory).not.toBeNull();
    expect(result.source_count - 1).toBeGreaterThan(0);
  });

  it("is idempotent after a successful compact (only summary remains)", async () => {
    mockListMemory.mockResolvedValue([
      note("mem_s", "• [fact] one\n• [fact] two", MEMORY_SUMMARY_KIND),
    ]);

    const result = await compactAgentMemory({} as any, {
      workspaceId: "w1",
      agent_id: "a1",
    });

    expect(result.compacted).toBe(false);
    expect(result.reason).toBe("below_min_notes");
    expect(result.source_count).toBe(0);
    expect(mockCreateMemory).not.toHaveBeenCalled();
    expect(mockDeleteMemoriesByIds).not.toHaveBeenCalled();
  });
});
