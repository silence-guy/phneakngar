import { describe, it, expect, vi } from "vitest";
import * as wfrQueries from "../../src/db/queries/workspace-file-request";

function createMockDb(rows: any[]) {
  const chain: any = {};
  chain.select = vi.fn(() => chain);
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => Promise.resolve(rows));
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
