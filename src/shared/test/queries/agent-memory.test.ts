import { describe, it, expect, vi } from "vitest";
import * as memoryQueries from "../../src/db/queries/agent-memory";

function createMock(rows: any[]) {
  const chain: any = {};
  chain.insert = vi.fn(() => chain);
  chain.values = vi.fn(() => chain);
  chain.returning = vi.fn(() => Promise.resolve(rows));
  chain.select = vi.fn(() => chain);
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(() => Promise.resolve(rows));
  chain.delete = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.set = vi.fn(() => chain);
  return chain;
}

describe("agent-memory queries", () => {
  it("createMemory stores workspace-scoped fact", async () => {
    const row = { id: "mem_1" };
    const mockDb = createMock([row]);
    const result = await memoryQueries.createMemory(mockDb, {
      workspaceId: "w1",
      agentId: "a1",
      kind: "preference",
      content: "Prefers concise briefs",
    });
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "w1",
        agentId: "a1",
        kind: "preference",
        content: "Prefers concise briefs",
      })
    );
    expect(result).toEqual(row);
  });

  it("listMemoryForAgent scopes by workspace and agent-or-shared", async () => {
    const mockDb = createMock([]);
    await memoryQueries.listMemoryForAgent(mockDb, "w1", "a1", 20);
    expect(mockDb.where).toHaveBeenCalled();
    expect(mockDb.limit).toHaveBeenCalledWith(20);
  });

  it("deleteMemory requires workspaceId", async () => {
    const mockDb = createMock([]);
    const result = await memoryQueries.deleteMemory(mockDb, "mem_1", "w1");
    expect(result).toBeNull();
    expect(mockDb.where).toHaveBeenCalled();
  });

  it("deleteMemoriesByIds no-ops on empty id list", async () => {
    const mockDb = createMock([]);
    const result = await memoryQueries.deleteMemoriesByIds(mockDb, "w1", []);
    expect(result).toEqual([]);
    expect(mockDb.delete).not.toHaveBeenCalled();
  });

  it("deleteMemoriesByIds scopes by workspaceId", async () => {
    const rows = [{ id: "mem_1" }, { id: "mem_2" }];
    const mockDb = createMock(rows);
    const result = await memoryQueries.deleteMemoriesByIds(mockDb, "w1", [
      "mem_1",
      "mem_2",
    ]);
    expect(mockDb.delete).toHaveBeenCalled();
    expect(mockDb.where).toHaveBeenCalled();
    expect(result).toEqual(rows);
  });

  it("listMemory scopes by workspaceId and optional agentId/kind", async () => {
    const mockDb = createMock([]);
    await memoryQueries.listMemory(mockDb, "w1", {
      agentId: "a1",
      kind: "summary",
      limit: 25,
    });
    expect(mockDb.select).toHaveBeenCalled();
    expect(mockDb.from).toHaveBeenCalled();
    expect(mockDb.where).toHaveBeenCalled();
    expect(mockDb.limit).toHaveBeenCalledWith(25);
  });

  it("listMemory can filter shared notes with agentId null", async () => {
    const mockDb = createMock([]);
    await memoryQueries.listMemory(mockDb, "w1", { agentId: null, limit: 10 });
    expect(mockDb.where).toHaveBeenCalled();
    expect(mockDb.limit).toHaveBeenCalledWith(10);
  });

  it("createMemory can persist a system summary kind", async () => {
    const row = { id: "mem_s", kind: "summary" };
    const mockDb = createMock([row]);
    const result = await memoryQueries.createMemory(mockDb, {
      workspaceId: "w1",
      agentId: null,
      kind: "summary",
      content: "• [fact] one",
    });
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "w1",
        agentId: null,
        kind: "summary",
        content: "• [fact] one",
      })
    );
    expect(result).toEqual(row);
  });
});
