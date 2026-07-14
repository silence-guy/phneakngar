import { describe, it, expect, vi } from "vitest";
import * as wfrQueries from "../../src/db/queries/workspace-file-request";

function createMockDb(rows: any[]) {
  const chain: any = {};
  chain.select = vi.fn(() => chain);
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => Promise.resolve(rows));
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(() => Promise.resolve(rows));
  chain.insert = vi.fn(() => chain);
  chain.values = vi.fn(() => chain);
  chain.returning = vi.fn(() => Promise.resolve(rows));
  chain.update = vi.fn(() => chain);
  chain.set = vi.fn(() => chain);
  chain.delete = vi.fn(() => chain);
  return chain;
}

describe("workspace-file-request query module exports", () => {
  it("exports createRequest", () => {
    expect(typeof wfrQueries.createRequest).toBe("function");
  });

  it("exports getPendingByWorkspace", () => {
    expect(typeof wfrQueries.getPendingByWorkspace).toBe("function");
  });

  it("exports markDispatched", () => {
    expect(typeof wfrQueries.markDispatched).toBe("function");
  });

  it("exports claimPendingByWorkspace", () => {
    expect(typeof wfrQueries.claimPendingByWorkspace).toBe("function");
  });

  it("exports completeRequest", () => {
    expect(typeof wfrQueries.completeRequest).toBe("function");
  });

  it("exports completeRequestForWorkspace", () => {
    expect(typeof wfrQueries.completeRequestForWorkspace).toBe("function");
  });

  it("exports getRequest", () => {
    expect(typeof wfrQueries.getRequest).toBe("function");
  });

  it("exports getRequestForWorkspace", () => {
    expect(typeof wfrQueries.getRequestForWorkspace).toBe("function");
  });

  it("exports expireStale", () => {
    expect(typeof wfrQueries.expireStale).toBe("function");
  });
});

describe("markDispatched", () => {
  it("does nothing for empty ids array (early return)", async () => {
    await wfrQueries.markDispatched(null as any, []);
  });
});

describe("getPendingByWorkspace", () => {
  it("applies the default bounded limit", async () => {
    const mockDb: any = {};
    mockDb.select = vi.fn(() => mockDb);
    mockDb.from = vi.fn(() => mockDb);
    mockDb.where = vi.fn(() => mockDb);
    mockDb.orderBy = vi.fn(() => mockDb);
    mockDb.limit = vi.fn(() => Promise.resolve([]));
    await wfrQueries.getPendingByWorkspace(mockDb, "w1");
    expect(mockDb.limit).toHaveBeenCalledWith(16);
  });

  it("clamps custom limit to the maximum", async () => {
    const mockDb: any = {};
    mockDb.select = vi.fn(() => mockDb);
    mockDb.from = vi.fn(() => mockDb);
    mockDb.where = vi.fn(() => mockDb);
    mockDb.orderBy = vi.fn(() => mockDb);
    mockDb.limit = vi.fn(() => Promise.resolve([]));
    await wfrQueries.getPendingByWorkspace(mockDb, "w1", 99);
    expect(mockDb.limit).toHaveBeenCalledWith(16);
  });
});

describe("claimPendingByWorkspace", () => {
  it("returns only rows actually claimed by pending-status updates", async () => {
    const selected = [
      { id: "wfr_1", workspaceId: "w1", status: "pending" },
      { id: "wfr_2", workspaceId: "w1", status: "pending" },
    ];
    const returningResults = [
      [],
      [{ ...selected[1], status: "dispatched" }],
    ];
    const selectChain: any = {};
    selectChain.select = vi.fn(() => selectChain);
    selectChain.from = vi.fn(() => selectChain);
    selectChain.where = vi.fn(() => selectChain);
    selectChain.orderBy = vi.fn(() => selectChain);
    selectChain.limit = vi.fn(() => Promise.resolve(selected));
    selectChain.update = vi.fn(() => selectChain);
    selectChain.set = vi.fn(() => selectChain);
    selectChain.returning = vi.fn(() => Promise.resolve(returningResults.shift() ?? []));

    const result = await wfrQueries.claimPendingByWorkspace(selectChain, "w1", 2);

    expect(result).toEqual([{ ...selected[1], status: "dispatched" }]);
    expect(selectChain.update).toHaveBeenCalledTimes(2);
    expect(selectChain.returning).toHaveBeenCalledTimes(2);
  });

  it("preserves the deterministic selected candidate order", async () => {
    const selected = [
      { id: "wfr_1", workspaceId: "w1", status: "pending" },
      { id: "wfr_2", workspaceId: "w1", status: "pending" },
    ];
    const returningResults = [
      [{ ...selected[0], status: "dispatched" }],
      [{ ...selected[1], status: "dispatched" }],
    ];
    const chain: any = {};
    chain.select = vi.fn(() => chain);
    chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.orderBy = vi.fn(() => chain);
    chain.limit = vi.fn(() => Promise.resolve(selected));
    chain.update = vi.fn(() => chain);
    chain.set = vi.fn(() => chain);
    chain.returning = vi.fn(() => Promise.resolve(returningResults.shift() ?? []));

    const result = await wfrQueries.claimPendingByWorkspace(chain, "w1", 2);

    expect(result.map((row) => row.id)).toEqual(["wfr_1", "wfr_2"]);
  });

  it("does not duplicate delivery across concurrent claims against shared pending rows", async () => {
    const rows = [
      { id: "wfr_1", workspaceId: "w1", status: "pending", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "wfr_2", workspaceId: "w1", status: "pending", createdAt: "2026-01-01T00:00:01.000Z" },
    ];
    const makeDb = () => {
      const db: any = {};
      let selectedRows: typeof rows = [];
      let returningIndex = 0;
      db.select = vi.fn(() => db);
      db.from = vi.fn(() => db);
      db.where = vi.fn(() => db);
      db.orderBy = vi.fn(() => db);
      db.limit = vi.fn((limit: number) => {
        selectedRows = rows.filter((row) => row.workspaceId === "w1" && row.status === "pending").slice(0, limit);
        return Promise.resolve(selectedRows.map((row) => ({ ...row })));
      });
      db.update = vi.fn(() => db);
      db.set = vi.fn((value: { status: string; updatedAt: string }) => {
        db._set = value;
        return db;
      });
      db.returning = vi.fn(() => {
        const selected = selectedRows[returningIndex++];
        const row = selected ? rows.find((candidate) => candidate.id === selected.id) : undefined;
        if (!row || row.status !== "pending") return Promise.resolve([]);
        Object.assign(row, db._set);
        return Promise.resolve([{ ...row }]);
      });
      return db;
    };

    const [first, second] = await Promise.all([
      wfrQueries.claimPendingByWorkspace(makeDb(), "w1", 1),
      wfrQueries.claimPendingByWorkspace(makeDb(), "w1", 1),
    ]);

    const deliveredIds = [...first, ...second].map((row) => row.id);
    expect(new Set(deliveredIds).size).toBe(deliveredIds.length);
    expect(deliveredIds).toEqual(["wfr_1"]);

    const later = await wfrQueries.claimPendingByWorkspace(makeDb(), "w1", 1);
    expect(later.map((row) => row.id)).toEqual(["wfr_2"]);
  });
});

describe("getRequest", () => {
  it("returns null when request not found", async () => {
    const mockDb = createMockDb([]);
    const result = await wfrQueries.getRequest(mockDb, "wfr_missing");
    expect(result).toBeNull();
  });

  it("returns request when found", async () => {
    const row = { id: "wfr_1", status: "pending", path: "/test" };
    const mockDb = createMockDb([row]);
    const result = await wfrQueries.getRequest(mockDb, "wfr_1");
    expect(result).toEqual(row);
  });
});

describe("getRequestForWorkspace", () => {
  it("returns request when found through workspace scoped query", async () => {
    const row = { id: "wfr_1", workspaceId: "w1", status: "pending", path: "/test" };
    const mockDb = createMockDb([row]);
    const result = await wfrQueries.getRequestForWorkspace(mockDb, "w1", "wfr_1");
    expect(result).toEqual(row);
    expect(mockDb.where).toHaveBeenCalledTimes(1);
  });
});

describe("completeRequest", () => {
  it("returns null when no row updated", async () => {
    const chain: any = {};
    chain.update = vi.fn(() => chain);
    chain.set = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.returning = vi.fn(() => Promise.resolve([]));
    const result = await wfrQueries.completeRequest(chain, "wfr_missing", { ok: true });
    expect(result).toBeNull();
  });
});

describe("completeRequestForWorkspace", () => {
  it("returns updated scoped row", async () => {
    const row = { id: "wfr_1", workspaceId: "w1" };
    const chain: any = {};
    chain.update = vi.fn(() => chain);
    chain.set = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.returning = vi.fn(() => Promise.resolve([row]));
    const result = await wfrQueries.completeRequestForWorkspace(chain, "w1", "wfr_1", { ok: true });
    expect(result).toEqual(row);
    expect(chain.where).toHaveBeenCalledTimes(1);
  });
});
