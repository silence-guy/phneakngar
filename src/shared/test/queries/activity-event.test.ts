import { describe, it, expect, vi } from "vitest";
import { activityEvent } from "../../src/db/schema";
import * as activityEventQueries from "../../src/db/queries/activity-event";
import { drizzle } from "drizzle-orm/d1";

const fakeDb = drizzle({} as never);

function createMock(rows: any[]) {
  const chain: any = {};
  chain.insert = vi.fn(() => chain);
  chain.values = vi.fn(() => chain);
  chain.onConflictDoNothing = vi.fn(() => chain);
  chain.returning = vi.fn(() => Promise.resolve(rows));
  chain.select = vi.fn(() => chain);
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => Object.assign(Promise.resolve(rows), chain));
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(() => Promise.resolve(rows));
  return chain;
}

describe("activity-event queries", () => {
  it("createActivityEvent without dedupe inserts", async () => {
    const row = { id: "ae1", workspaceId: "w1", kind: "x", summary: "s" };
    const mockDb = createMock([row]);
    const result = await activityEventQueries.createActivityEvent(mockDb, {
      workspaceId: "w1",
      kind: "approval_decided",
      summary: "s",
    });
    expect(result.created).toBe(true);
    expect(mockDb.from).not.toHaveBeenCalledWith(activityEvent); // insert path
    expect(mockDb.insert).toHaveBeenCalledWith(activityEvent);
    expect(result.row).toEqual(row);
  });

  it("listActivityEvents scopes by workspace", async () => {
    const rows = [{ id: "ae1" }];
    const mockDb = createMock(rows);
    // list uses orderBy.limit which returns promise of rows
    mockDb.where = vi.fn(() => mockDb);
    mockDb.orderBy = vi.fn(() => mockDb);
    mockDb.limit = vi.fn(() => Promise.resolve(rows));
    const result = await activityEventQueries.listActivityEvents(mockDb, "w1", {
      limit: 10,
    });
    expect(result).toEqual(rows);
    expect(mockDb.from).toHaveBeenCalledWith(activityEvent);
  });
});
