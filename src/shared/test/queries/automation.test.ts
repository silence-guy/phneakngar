import { describe, it, expect, vi } from "vitest";
import * as automationQueries from "../../src/db/queries/automation";

function createInsertMock(rows: any[]) {
  const chain: any = {};
  chain.insert = vi.fn(() => chain);
  chain.values = vi.fn(() => chain);
  chain.returning = vi.fn(() => Promise.resolve(rows));
  chain.select = vi.fn(() => chain);
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(() => Promise.resolve(rows));
  chain.update = vi.fn(() => chain);
  chain.set = vi.fn(() => chain);
  chain.delete = vi.fn(() => chain);
  return chain;
}

describe("automation query exports", () => {
  it("exports createAutomation", () => {
    expect(typeof automationQueries.createAutomation).toBe("function");
  });
  it("exports listDueAutomations", () => {
    expect(typeof automationQueries.listDueAutomations).toBe("function");
  });
  it("exports claimAutomationRun", () => {
    expect(typeof automationQueries.claimAutomationRun).toBe("function");
  });
  it("exports revertAutomationRunClaim", () => {
    expect(typeof automationQueries.revertAutomationRunClaim).toBe("function");
  });
});

describe("createAutomation", () => {
  it("defaults deliveryMode channel and enabled true", async () => {
    const row = { id: "auto_1" };
    const mockDb = createInsertMock([row]);
    const result = await automationQueries.createAutomation(mockDb, {
      workspaceId: "w1",
      agentId: "a1",
      title: "Morning brief",
      schedule: "0 8 * * *",
      nextRunAt: "2026-07-17T01:00:00.000Z",
    });
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "w1",
        agentId: "a1",
        title: "Morning brief",
        deliveryMode: "channel",
        enabled: true,
        sopMarkdown: "",
      })
    );
    expect(result).toEqual(row);
  });
});

describe("listDueAutomations", () => {
  it("queries with workspace scope and limit", async () => {
    const mockDb = createInsertMock([]);
    await automationQueries.listDueAutomations(mockDb, "w1", "2026-07-17T01:00:00.000Z", 10);
    expect(mockDb.select).toHaveBeenCalled();
    expect(mockDb.where).toHaveBeenCalled();
    expect(mockDb.limit).toHaveBeenCalledWith(10);
  });
});

describe("claimAutomationRun", () => {
  it("returns null when no row updated (lost race)", async () => {
    const mockDb = createInsertMock([]);
    const result = await automationQueries.claimAutomationRun(
      mockDb,
      "auto_1",
      "w1",
      "2026-07-17T01:00:00.000Z",
      "2026-07-18T01:00:00.000Z",
      "task_1"
    );
    expect(result).toBeNull();
  });

  it("returns updated row when claim succeeds", async () => {
    const row = { id: "auto_1", lastTaskId: "task_1" };
    const mockDb = createInsertMock([row]);
    const result = await automationQueries.claimAutomationRun(
      mockDb,
      "auto_1",
      "w1",
      "2026-07-17T01:00:00.000Z",
      "2026-07-18T01:00:00.000Z",
      "task_1"
    );
    expect(result).toEqual(row);
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({ lastTaskId: "task_1", nextRunAt: "2026-07-18T01:00:00.000Z" })
    );
  });
});

describe("revertAutomationRunClaim", () => {
  it("restores previous nextRunAt/lastRunAt/lastTaskId when claim still advanced", async () => {
    const row = {
      id: "auto_1",
      nextRunAt: "2026-07-17T01:00:00.000Z",
      lastRunAt: null,
      lastTaskId: null,
    };
    const mockDb = createInsertMock([row]);
    const result = await automationQueries.revertAutomationRunClaim(
      mockDb,
      "auto_1",
      "w1",
      "2026-07-18T01:00:00.000Z",
      {
        nextRunAt: "2026-07-17T01:00:00.000Z",
        lastRunAt: null,
        lastTaskId: null,
      },
    );
    expect(result).toEqual(row);
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        nextRunAt: "2026-07-17T01:00:00.000Z",
        lastRunAt: null,
        lastTaskId: null,
      }),
    );
  });

  it("returns null when another runner already advanced nextRunAt", async () => {
    const mockDb = createInsertMock([]);
    const result = await automationQueries.revertAutomationRunClaim(
      mockDb,
      "auto_1",
      "w1",
      "2026-07-18T01:00:00.000Z",
      {
        nextRunAt: "2026-07-17T01:00:00.000Z",
        lastRunAt: "2026-07-16T01:00:00.000Z",
        lastTaskId: "task_old",
      },
    );
    expect(result).toBeNull();
  });
});
