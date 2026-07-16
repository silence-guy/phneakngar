import { describe, it, expect, vi } from "vitest";
import * as conversationMapQueries from "../../src/db/queries/conversation-map";

function createMockDb(rows: any[]) {
  const chain: any = {};
  chain.select = vi.fn(() => chain);
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.limit = vi.fn(() => Promise.resolve(rows));
  chain.insert = vi.fn(() => chain);
  chain.values = vi.fn(() => chain);
  chain.onConflictDoNothing = vi.fn(() => Promise.resolve());
  return chain;
}

/**
 * Simulate concurrent get-or-create: first find misses, insert no-ops (race),
 * re-find returns winner conversation id.
 */
function createRaceMockDb(winnerConversationId: string) {
  let findCalls = 0;
  const chain: any = {};
  chain.select = vi.fn(() => chain);
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.limit = vi.fn(() => {
    findCalls += 1;
    // getOrCreate: first find empty; createMapping re-find returns winner
    if (findCalls === 1) return Promise.resolve([]);
    return Promise.resolve([{ conversationId: winnerConversationId }]);
  });
  chain.insert = vi.fn(() => chain);
  chain.values = vi.fn(() => chain);
  chain.onConflictDoNothing = vi.fn(() => Promise.resolve());
  return chain;
}

describe("conversation-map query module exports", () => {
  it("exports findByKey", () => {
    expect(typeof conversationMapQueries.findByKey).toBe("function");
  });

  it("exports createMapping", () => {
    expect(typeof conversationMapQueries.createMapping).toBe("function");
  });

  it("exports getOrCreateMapping", () => {
    expect(typeof conversationMapQueries.getOrCreateMapping).toBe("function");
  });
});

describe("findByKey", () => {
  it("returns conversationId when mapping exists", async () => {
    const mockDb = createMockDb([{ conversationId: "conv_123" }]);
    const result = await conversationMapQueries.findByKey(mockDb, "email:ag_1:thread", "ws_1");
    expect(result).toBe("conv_123");
    expect(mockDb.select).toHaveBeenCalledOnce();
    expect(mockDb.from).toHaveBeenCalledOnce();
    expect(mockDb.where).toHaveBeenCalledOnce();
    expect(mockDb.limit).toHaveBeenCalledWith(1);
  });

  it("returns null when no mapping exists", async () => {
    const mockDb = createMockDb([]);
    const result = await conversationMapQueries.findByKey(mockDb, "email:ag_1:unknown", "ws_1");
    expect(result).toBeNull();
  });
});

describe("createMapping", () => {
  it("inserts with onConflictDoNothing then re-reads winner", async () => {
    const mockDb = createMockDb([{ conversationId: "conv_winner" }]);
    const result = await conversationMapQueries.createMapping(mockDb, {
      key: "email:ag_1:thread",
      workspaceId: "ws_1",
      conversationId: "conv_local",
    });
    expect(result).toBe("conv_winner");
    expect(mockDb.insert).toHaveBeenCalledOnce();
    expect(mockDb.onConflictDoNothing).toHaveBeenCalledOnce();
    expect(mockDb.select).toHaveBeenCalledOnce();
  });

  it("is safe under concurrent retry (conflict no-op + re-find)", async () => {
    const mockDb = createMockDb([{ conversationId: "conv_other" }]);
    const a = await conversationMapQueries.createMapping(mockDb, {
      key: "email:ag_1:thread",
      workspaceId: "ws_1",
      conversationId: "conv_a",
    });
    const b = await conversationMapQueries.createMapping(mockDb, {
      key: "email:ag_1:thread",
      workspaceId: "ws_1",
      conversationId: "conv_b",
    });
    expect(a).toBe("conv_other");
    expect(b).toBe("conv_other");
    expect(mockDb.insert).toHaveBeenCalledTimes(2);
  });

  it("throws when mapping cannot be resolved after insert", async () => {
    const mockDb = createMockDb([]);
    await expect(
      conversationMapQueries.createMapping(mockDb, {
        key: "email:ag_1:thread",
        workspaceId: "ws_1",
        conversationId: "conv_a",
      }),
    ).rejects.toThrow(/could not be resolved/i);
  });
});

describe("getOrCreateMapping", () => {
  it("returns existing mapping without insert", async () => {
    const mockDb = createMockDb([{ conversationId: "conv_existing" }]);
    const result = await conversationMapQueries.getOrCreateMapping(mockDb, {
      key: "email:ag_1:thread",
      workspaceId: "ws_1",
      conversationId: "conv_new",
    });
    expect(result).toEqual({ conversationId: "conv_existing", created: false });
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("creates when missing and reports created=true when our id wins", async () => {
    const mockDb = createRaceMockDb("conv_local");
    const result = await conversationMapQueries.getOrCreateMapping(mockDb, {
      key: "email:ag_1:thread",
      workspaceId: "ws_1",
      conversationId: "conv_local",
    });
    expect(result).toEqual({ conversationId: "conv_local", created: true });
    expect(mockDb.insert).toHaveBeenCalledOnce();
  });

  it("converges under race: other conversation wins → created=false", async () => {
    const mockDb = createRaceMockDb("conv_other");
    const result = await conversationMapQueries.getOrCreateMapping(mockDb, {
      key: "email:ag_1:thread",
      workspaceId: "ws_1",
      conversationId: "conv_local",
    });
    expect(result).toEqual({ conversationId: "conv_other", created: false });
  });
});
