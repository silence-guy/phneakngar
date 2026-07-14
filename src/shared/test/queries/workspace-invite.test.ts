import { describe, it, expect, vi } from "vitest";
import * as wi from "../../src/db/queries/workspace-invite";

function createSelectMock(rows: any[]) {
  const chain: any = {};
  chain.select = vi.fn(() => chain);
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => Promise.resolve(rows));
  chain.innerJoin = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.values = vi.fn(() => chain);
  chain.returning = vi.fn(() => Promise.resolve(rows));
  return chain;
}

describe("workspace-invite exports", () => {
  it("exports createInvite", () => { expect(typeof wi.createInvite).toBe("function"); });
  it("exports WORKSPACE_MEMBER_CAPACITY", () => { expect(wi.WORKSPACE_MEMBER_CAPACITY).toBe(4); });
  it("exports getInviteByToken", () => { expect(typeof wi.getInviteByToken).toBe("function"); });
  it("exports getInviteByTokenForUser", () => { expect(typeof wi.getInviteByTokenForUser).toBe("function"); });
  it("exports listActiveInvites", () => { expect(typeof wi.listActiveInvites).toBe("function"); });
  it("exports redeemInvite", () => { expect(typeof wi.redeemInvite).toBe("function"); });
  it("exports redeemInviteForUser", () => { expect(typeof wi.redeemInviteForUser).toBe("function"); });
  it("exports deleteInvite", () => { expect(typeof wi.deleteInvite).toBe("function"); });
});

describe("createInvite", () => {
  it("creates invite", async () => {
    const inv = { id: "inv_1" };
    expect(await wi.createInvite(createSelectMock([inv]), { workspaceId: "w", createdBy: "u", expiresAt: "2026-12-31" })).toEqual(inv);
  });
});

describe("getInviteByToken", () => {
  it("returns null when not found", async () => { expect(await wi.getInviteByToken(createSelectMock([]), "x")).toBeNull(); });
  it("returns invite with joins", async () => {
    const inv = { id: "inv_1" };
    const mockDb = createSelectMock([inv]);
    expect(await wi.getInviteByToken(mockDb, "tok")).toEqual(inv);
    expect(mockDb.innerJoin).toHaveBeenCalledTimes(2);
  });
});

describe("redeemInvite", () => {
  it("returns null when expired", async () => {
    const chain: any = {};
    chain.update = vi.fn(() => chain); chain.set = vi.fn(() => chain);
    chain.where = vi.fn(() => chain); chain.returning = vi.fn(() => Promise.resolve([]));
    expect(await wi.redeemInvite(chain, "x", "u")).toBeNull();
  });
  it("returns redeemed invite", async () => {
    const inv = { id: "inv_1" };
    const chain: any = {};
    chain.update = vi.fn(() => chain); chain.set = vi.fn(() => chain);
    chain.where = vi.fn(() => chain); chain.returning = vi.fn(() => Promise.resolve([inv]));
    expect(await wi.redeemInvite(chain, "tok", "u")).toEqual(inv);
  });
});

describe("redeemInviteForUser", () => {
  function createRedeemDb(finalRows: any[], rejection?: Error, capacityRows: any[] = []) {
    const makeSelectBuilder = () => {
      const builder: any = {};
      builder.from = vi.fn(() => builder);
      builder.where = vi.fn(() => builder);
      builder.innerJoin = vi.fn(() => builder);
      builder.leftJoin = vi.fn(() => builder);
      builder.limit = vi.fn(() => builder);
      builder.offset = vi.fn(() => builder);
      return builder;
    };
    const updateBuilder: any = {};
    updateBuilder.set = vi.fn(() => updateBuilder);
    updateBuilder.where = vi.fn(() => updateBuilder);

    const insertBuilder: any = {};
    insertBuilder.select = vi.fn((callback: (qb: any) => unknown) => {
      const qb = { select: vi.fn(() => makeSelectBuilder()) };
      callback(qb);
      return insertBuilder;
    });
    insertBuilder.onConflictDoNothing = vi.fn(() => insertBuilder);

    const db: any = {
      select: vi.fn(() => makeSelectBuilder()),
      update: vi.fn(() => updateBuilder),
      insert: vi.fn(() => insertBuilder),
      batch: rejection
        ? vi.fn(() => Promise.reject(rejection))
        : vi.fn(() => Promise.resolve([[], [], finalRows, capacityRows])),
    };
    return db;
  }

  it("returns success for a newly redeemed or same-user replayed invite", async () => {
    const db = createRedeemDb([{
      workspaceId: "w1",
      workspaceSlug: "acme",
      usedBy: "u1",
      expiresAt: "2099-01-01T00:00:00.000Z",
      memberId: "m1",
    }]);

    await expect(wi.redeemInviteForUser(db, "tok", "u1")).resolves.toEqual({
      status: "success",
      workspaceId: "w1",
      workspaceSlug: "acme",
    });
    expect(db.batch).toHaveBeenCalledOnce();
    expect(db.batch.mock.calls[0][0]).toHaveLength(4);
  });

  it("repairs historical same-user used invite state below capacity", async () => {
    const db = createRedeemDb([{
      workspaceId: "w1",
      workspaceSlug: "acme",
      usedBy: "u1",
      expiresAt: "2000-01-01T00:00:00.000Z",
      memberId: "m1",
    }]);

    await expect(wi.redeemInviteForUser(db, "tok", "u1")).resolves.toEqual({
      status: "success",
      workspaceId: "w1",
      workspaceSlug: "acme",
    });
    expect(db.batch).toHaveBeenCalledOnce();
  });

  it("rejects historical same-user partial repair when the workspace is at capacity", async () => {
    await expect(wi.redeemInviteForUser(createRedeemDb([{
      workspaceId: "w1",
      workspaceSlug: "acme",
      usedBy: "u1",
      expiresAt: "2099-01-01T00:00:00.000Z",
      memberId: null,
    }], undefined, [{ id: "m-capacity-slot" }]), "tok", "u1"))
      .resolves.toEqual({ status: "capacity_full" });
  });

  it.each([
    [[], "not_found"],
    [[{ workspaceId: "w1", workspaceSlug: "acme", usedBy: null, expiresAt: "2000-01-01T00:00:00.000Z", memberId: null }], "expired"],
    [[{ workspaceId: "w1", workspaceSlug: "acme", usedBy: "u2", expiresAt: "2099-01-01T00:00:00.000Z", memberId: null }], "used"],
    [[{ workspaceId: "w1", workspaceSlug: "acme", usedBy: null, expiresAt: "2099-01-01T00:00:00.000Z", memberId: "m1" }], "already_member"],
    [[{ workspaceId: "w1", workspaceSlug: "acme", usedBy: "u1", expiresAt: "2099-01-01T00:00:00.000Z", memberId: null }], "inconsistent"],
  ])("classifies final state %#", async (rows, status) => {
    await expect(wi.redeemInviteForUser(createRedeemDb(rows as any[]), "tok", "u1"))
      .resolves.toEqual({ status });
  });

  it("propagates an atomic batch failure without reporting success", async () => {
    await expect(wi.redeemInviteForUser(
      createRedeemDb([], new Error("D1 batch failed")),
      "tok",
      "u1",
    )).rejects.toThrow("D1 batch failed");
  });
});

describe("deleteInvite", () => {
  it("returns null when not found", async () => {
    const chain: any = {};
    chain.delete = vi.fn(() => chain); chain.where = vi.fn(() => chain);
    chain.returning = vi.fn(() => Promise.resolve([]));
    expect(await wi.deleteInvite(chain, "x", "w")).toBeNull();
  });
  it("returns deleted invite", async () => {
    const inv = { id: "inv_1" };
    const chain: any = {};
    chain.delete = vi.fn(() => chain); chain.where = vi.fn(() => chain);
    chain.returning = vi.fn(() => Promise.resolve([inv]));
    expect(await wi.deleteInvite(chain, "inv_1", "w")).toEqual(inv);
  });
});
