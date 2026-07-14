import { describe, it, expect, vi } from "vitest";
import * as machineQueries from "../../src/db/queries/machine";

function createMockDb(rows: any[]) {
  const chain: any = {};
  chain.select = vi.fn(() => chain);
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => Promise.resolve(rows));
  chain.insert = vi.fn(() => chain);
  chain.values = vi.fn(() => chain);
  chain.returning = vi.fn(() => Promise.resolve(rows));
  chain.onConflictDoUpdate = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.set = vi.fn(() => chain);
  chain.delete = vi.fn(() => chain);
  return chain;
}

describe("machine query module exports", () => {
  it("exports upsertMachine", () => { expect(typeof machineQueries.upsertMachine).toBe("function"); });
  it("exports upsertMachineForActivation", () => { expect(typeof machineQueries.upsertMachineForActivation).toBe("function"); });
  it("exports updateMachineLastSeen", () => { expect(typeof machineQueries.updateMachineLastSeen).toBe("function"); });
  it("exports setMachineLastSeenNull", () => { expect(typeof machineQueries.setMachineLastSeenNull).toBe("function"); });
  it("exports getMachineByChhlat", () => { expect(typeof machineQueries.getMachineByChhlat).toBe("function"); });
  it("exports listMachinesForWorkspace", () => { expect(typeof machineQueries.listMachinesForWorkspace).toBe("function"); });
  it("exports deleteMachine", () => { expect(typeof machineQueries.deleteMachine).toBe("function"); });
  it("exports setPendingUpdateVersion", () => { expect(typeof machineQueries.setPendingUpdateVersion).toBe("function"); });
  it("exports clearPendingUpdateVersion", () => { expect(typeof machineQueries.clearPendingUpdateVersion).toBe("function"); });
  it("exports setPendingRescan", () => { expect(typeof machineQueries.setPendingRescan).toBe("function"); });
  it("exports clearPendingRescan", () => { expect(typeof machineQueries.clearPendingRescan).toBe("function"); });
});

describe("upsertMachine", () => {
  it("inserts and returns first row", async () => {
    const m = { id: "m_1" };
    const mockDb = createMockDb([m]);
    const result = await machineQueries.upsertMachine(mockDb, { chhlatId: "d_1", workspaceId: "ws_1", deviceInfo: "Mac" });
    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockDb.onConflictDoUpdate).toHaveBeenCalled();
    expect(result).toEqual(m);
  });
  it("uses null lastSeenAt when explicitly null", async () => {
    const mockDb = createMockDb([{ id: "m_1" }]);
    await machineQueries.upsertMachine(mockDb, { chhlatId: "d_1", workspaceId: "ws_1", deviceInfo: "x", lastSeenAt: null });
    expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({ lastSeenAt: null }));
  });
});

describe("upsertMachineForActivation", () => {
  it("uses an owner-guarded conflict update", async () => {
    const row = { chhlatId: "host.local", workspaceId: "ws_1", ownerId: "u1" };
    const db = createMockDb([row]);

    await expect(machineQueries.upsertMachineForActivation(db, {
      chhlatId: "host.local",
      workspaceId: "ws_1",
      deviceInfo: "host.local",
      ownerId: "u1",
    })).resolves.toEqual(row);
    expect(db.onConflictDoUpdate).toHaveBeenCalledWith(expect.objectContaining({
      setWhere: expect.anything(),
      set: expect.objectContaining({ ownerId: "u1" }),
    }));
  });

  it("returns null when an existing machine belongs to another user", async () => {
    await expect(machineQueries.upsertMachineForActivation(createMockDb([]), {
      chhlatId: "host.local",
      workspaceId: "ws_1",
      deviceInfo: "host.local",
      ownerId: "u1",
    })).resolves.toBeNull();
  });
});

describe("getMachineByChhlat", () => {
  it("returns null when not found", async () => {
    const mockDb = createMockDb([]);
    expect(await machineQueries.getMachineByChhlat(mockDb, "d_x", "ws_1")).toBeNull();
  });
  it("returns machine when found", async () => {
    const m = { id: "m_1" };
    const mockDb = createMockDb([m]);
    expect(await machineQueries.getMachineByChhlat(mockDb, "d_1", "ws_1")).toEqual(m);
  });
});

describe("updateMachineLastSeen", () => {
  it("updates lastSeenAt", async () => {
    const mockDb = createMockDb([]);
    await machineQueries.updateMachineLastSeen(mockDb, "d_1", "ws_1");
    expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({ lastSeenAt: expect.any(String) }));
  });
});

describe("setMachineLastSeenNull", () => {
  it("sets lastSeenAt to null", async () => {
    const mockDb = createMockDb([]);
    await machineQueries.setMachineLastSeenNull(mockDb, "d_1", "ws_1");
    expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({ lastSeenAt: null }));
  });
});

describe("deleteMachine", () => {
  it("calls delete", async () => {
    const mockDb = createMockDb([]);
    await machineQueries.deleteMachine(mockDb, "d_1", "ws_1");
    expect(mockDb.delete).toHaveBeenCalled();
  });
});

describe("setPendingUpdateVersion", () => {
  it("sets version", async () => {
    const mockDb = createMockDb([]);
    await machineQueries.setPendingUpdateVersion(mockDb, "d_1", "ws_1", "1.2.3");
    expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({ pendingUpdateVersion: "1.2.3" }));
  });
});

describe("clearPendingUpdateVersion", () => {
  it("clears to null", async () => {
    const mockDb = createMockDb([]);
    await machineQueries.clearPendingUpdateVersion(mockDb, "d_1", "ws_1");
    expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({ pendingUpdateVersion: null }));
  });
});

describe("setPendingRescan", () => {
  it("sets to true", async () => {
    const mockDb = createMockDb([]);
    await machineQueries.setPendingRescan(mockDb, "d_1", "ws_1");
    expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({ pendingRescan: true }));
  });
});

describe("clearPendingRescan", () => {
  it("sets to false", async () => {
    const mockDb = createMockDb([]);
    await machineQueries.clearPendingRescan(mockDb, "d_1", "ws_1");
    expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({ pendingRescan: false }));
  });
});
