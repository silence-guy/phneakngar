import { describe, it, expect, vi } from "vitest";
import * as mt from "../../src/db/queries/machine-token";

function createSelectMock(rows: any[]) {
  const chain: any = {};
  chain.select = vi.fn(() => chain);
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(rows).then(resolve);
  chain.innerJoin = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.set = vi.fn(() => chain);
  chain.values = vi.fn(() => chain);
  chain.returning = vi.fn(() => Promise.resolve(rows));
  chain.orderBy = vi.fn(() => chain);
  return chain;
}

describe("machine-token exports", () => {
  it("exports createMachineToken", () => { expect(typeof mt.createMachineToken).toBe("function"); });
  it("exports getMachineTokenByToken", () => { expect(typeof mt.getMachineTokenByToken).toBe("function"); });
  it("exports getPendingMachineToken", () => { expect(typeof mt.getPendingMachineToken).toBe("function"); });
  it("exports activateMachineToken", () => { expect(typeof mt.activateMachineToken).toBe("function"); });
  it("exports claimMachineTokenActivation", () => { expect(typeof mt.claimMachineTokenActivation).toBe("function"); });
  it("exports finalizeMachineTokenActivation", () => { expect(typeof mt.finalizeMachineTokenActivation).toBe("function"); });
  it("exports getLatestTokenForUser", () => { expect(typeof mt.getLatestTokenForUser).toBe("function"); });
  it("exports listMachineTokens", () => { expect(typeof mt.listMachineTokens).toBe("function"); });
  it("exports deleteMachineToken", () => { expect(typeof mt.deleteMachineToken).toBe("function"); });
  it("exports updateMachineTokenLastUsed", () => { expect(typeof mt.updateMachineTokenLastUsed).toBe("function"); });
});

describe("createMachineToken", () => {
  it("creates token with defaults", async () => {
    const t = { id: "mt_1" };
    const mockDb = createSelectMock([t]);
    const result = await mt.createMachineToken(mockDb, { userId: "u", token: "tok", name: "T" });
    expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
      status: "active",
      workspaceId: null,
      tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
    expect(result).toEqual(t);
  });
  it("uses custom status", async () => {
    const mockDb = createSelectMock([{ id: "mt_1" }]);
    await mt.createMachineToken(mockDb, { userId: "u", token: "tok", name: "T", status: "pending" });
    expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({ status: "pending" }));
  });
});

describe("getMachineTokenByToken", () => {
  it("returns null when not found", async () => { expect(await mt.getMachineTokenByToken(createSelectMock([]), "x")).toBeNull(); });
  it("lazily hashes and redacts a legacy active token", async () => {
    const t = { id: "mt_1", status: "active", tokenHash: null };
    const mockDb = createSelectMock([t]);
    const result = await mt.getMachineTokenByToken(mockDb, "tok");
    expect(result).toEqual({
      ...t,
      tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(mockDb.innerJoin).toHaveBeenCalled();
    expect(mockDb.set).toHaveBeenCalledWith({
      tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      token: "redacted:mt_1",
    });
  });
});

describe("getPendingMachineToken", () => {
  it("returns null when none", async () => {
    const chain: any = {};
    chain.select = vi.fn(() => chain); chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => chain); chain.limit = vi.fn(() => Promise.resolve([]));
    expect(await mt.getPendingMachineToken(chain, "u")).toBeNull();
  });
  it("returns pending token", async () => {
    const t = { id: "mt_1" };
    const chain: any = {};
    chain.select = vi.fn(() => chain); chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => chain); chain.limit = vi.fn(() => Promise.resolve([t]));
    expect(await mt.getPendingMachineToken(chain, "u")).toEqual(t);
  });
  it("handles workspaceId", async () => {
    const t = { id: "mt_1" };
    const chain: any = {};
    chain.select = vi.fn(() => chain); chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => chain); chain.limit = vi.fn(() => Promise.resolve([t]));
    expect(await mt.getPendingMachineToken(chain, "u", "ws_1")).toEqual(t);
  });
});

describe("activateMachineToken", () => {
  it("sets active status with hostname", async () => {
    const chain: any = {};
    chain.update = vi.fn(() => chain); chain.set = vi.fn(() => chain);
    chain.where = vi.fn(() => Promise.resolve());
    await mt.activateMachineToken(chain, "mt_1", "host.local");
    expect(chain.set).toHaveBeenCalledWith(expect.objectContaining({
      status: "active",
      hostname: "host.local",
    }));
  });
});

describe("activation claim queries", () => {
  it("claims only through a guarded update and returns the claimed row", async () => {
    const claimed = { id: "mt_1", hostname: "host.local", runtimesJson: "[]" };
    const db = createSelectMock([claimed]);

    await expect(mt.claimMachineTokenActivation(db, "mt_1", "host.local", "[]"))
      .resolves.toEqual(claimed);
    expect(db.set).toHaveBeenCalledWith({ hostname: "host.local", runtimesJson: "[]" });
    expect(db.where).toHaveBeenCalledOnce();
  });

  it("returns null when another request already owns the claim", async () => {
    await expect(mt.claimMachineTokenActivation(
      createSelectMock([]),
      "mt_1",
      "other.local",
      "[]",
    )).resolves.toBeNull();
  });

  it("finalizes only the matching durable claim", async () => {
    const finalized = { id: "mt_1", status: "active" };
    const db = createSelectMock([finalized]);

    await expect(mt.finalizeMachineTokenActivation(db, "mt_1", "host.local", "[]"))
      .resolves.toEqual(finalized);
    expect(db.set).toHaveBeenCalledWith({ status: "active", token: "redacted:mt_1" });
    expect(db.where).toHaveBeenCalledOnce();
  });
});

describe("getLatestTokenForUser", () => {
  it("returns null when no tokens exist", async () => {
    const chain: any = {};
    chain.select = vi.fn(() => chain); chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => chain); chain.orderBy = vi.fn(() => chain);
    chain.limit = vi.fn(() => Promise.resolve([]));
    expect(await mt.getLatestTokenForUser(chain, "u")).toBeNull();
  });
  it("returns latest token with status", async () => {
    const t = { id: "mt_1", status: "active" };
    const chain: any = {};
    chain.select = vi.fn(() => chain); chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => chain); chain.orderBy = vi.fn(() => chain);
    chain.limit = vi.fn(() => Promise.resolve([t]));
    expect(await mt.getLatestTokenForUser(chain, "u")).toEqual(t);
  });
});

describe("deleteMachineToken", () => {
  it("deletes by id, userId, and workspaceId", async () => {
    const chain: any = {};
    chain.delete = vi.fn(() => chain);
    chain.where = vi.fn(() => Promise.resolve());
    await mt.deleteMachineToken(chain, "mt_1", "u", "w1");
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.where).toHaveBeenCalledTimes(1);
  });
});

describe("updateMachineTokenLastUsed", () => {
  it("updates lastUsedAt", async () => {
    const chain: any = {};
    chain.update = vi.fn(() => chain); chain.set = vi.fn(() => chain);
    chain.where = vi.fn(() => Promise.resolve());
    await mt.updateMachineTokenLastUsed(chain, "mt_1");
    expect(chain.set).toHaveBeenCalledWith(expect.objectContaining({ lastUsedAt: expect.any(String) }));
  });
});
