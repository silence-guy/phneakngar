import { describe, it, expect, vi } from "vitest";
import * as runtimeQueries from "../../src/db/queries/runtime";

function createMockDb(rows: any[]) {
  const chain: any = {};
  chain.select = vi.fn(() => chain);
  chain.from = vi.fn(() => chain);
  chain.leftJoin = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => Promise.resolve(rows));
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(rows).then(resolve);
  return chain;
}

describe("runtime query module exports", () => {
  it("exports getAgentRuntimesForWorkspace", () => {
    expect(typeof runtimeQueries.getAgentRuntimesForWorkspace).toBe("function");
  });

  it("exports getAgentRuntimeForWorkspace", () => {
    expect(typeof runtimeQueries.getAgentRuntimeForWorkspace).toBe("function");
  });

  it("exports upsertAgentRuntime", () => {
    expect(typeof runtimeQueries.upsertAgentRuntime).toBe("function");
  });

  it("exports listAgentRuntimes", () => {
    expect(typeof runtimeQueries.listAgentRuntimes).toBe("function");
  });

  it("exports getAgentRuntime", () => {
    expect(typeof runtimeQueries.getAgentRuntime).toBe("function");
  });

  it("exports listAgentRuntimesByChhlat", () => {
    expect(typeof runtimeQueries.listAgentRuntimesByChhlat).toBe("function");
  });
});

describe("listAgentRuntimesByChhlat", () => {
  it("returns the persisted runtime identities for one workspace machine", async () => {
    const rows = [{ id: "rt1", workspaceId: "ws1", chhlatId: "host.local", provider: "claude" }];
    const db = createMockDb(rows);

    await expect(runtimeQueries.listAgentRuntimesByChhlat(db, "ws1", "host.local"))
      .resolves.toEqual(rows);
    expect(db.leftJoin).toHaveBeenCalledOnce();
    expect(db.where).toHaveBeenCalledOnce();
    expect(db.orderBy).toHaveBeenCalledOnce();
  });
});

describe("getAgentRuntimesForWorkspace", () => {
  it("returns empty array for empty ids without querying DB", async () => {
    const result = await runtimeQueries.getAgentRuntimesForWorkspace(null as any, [], "ws1");
    expect(result).toEqual([]);
  });

  it("queries DB and returns runtimes when ids is non-empty", async () => {
    const mockRows = [
      { id: "rt1", workspaceId: "ws1", runtimeMode: "local", machineLastSeenAt: null },
      { id: "rt2", workspaceId: "ws1", runtimeMode: "cloud", machineLastSeenAt: "2026-01-01" },
    ];
    const mockDb = createMockDb(mockRows);

    const result = await runtimeQueries.getAgentRuntimesForWorkspace(mockDb, ["rt1", "rt2"], "ws1");

    expect(mockDb.select).toHaveBeenCalledOnce();
    expect(mockDb.from).toHaveBeenCalledOnce();
    expect(mockDb.leftJoin).toHaveBeenCalledOnce();
    expect(mockDb.where).toHaveBeenCalledOnce();
    expect(result).toEqual(mockRows);
  });

  it("returns single runtime for single id input", async () => {
    const mockRows = [{ id: "rt1", workspaceId: "ws1", runtimeMode: "local", machineLastSeenAt: null }];
    const mockDb = createMockDb(mockRows);

    const result = await runtimeQueries.getAgentRuntimesForWorkspace(mockDb, ["rt1"], "ws1");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("rt1");
  });
});
