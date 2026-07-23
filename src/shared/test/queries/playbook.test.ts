import { describe, it, expect, vi } from "vitest";
import { playbook, playbookRun, playbookStepRun } from "../../src/db/schema";
import * as playbookQueries from "../../src/db/queries/playbook";
import * as runQueries from "../../src/db/queries/playbook-run";

function createMock(rows: any[]) {
  const chain: any = {};
  chain.insert = vi.fn(() => chain);
  chain.values = vi.fn(() => chain);
  chain.onConflictDoNothing = vi.fn(() => Promise.resolve(rows));
  chain.returning = vi.fn(() => Promise.resolve(rows));
  chain.select = vi.fn(() => chain);
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => Object.assign(Promise.resolve(rows), chain));
  chain.update = vi.fn(() => chain);
  chain.set = vi.fn(() => chain);
  chain.delete = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(() => Promise.resolve(rows));
  return chain;
}

const definition = [{ id: "s1", kind: "agent", title: "A", prompt: "do it" }] as any;

describe("playbook queries", () => {
  it("createPlaybook inserts with workspace scope and defaults", async () => {
    const row = { id: "pb1", workspaceId: "w1", version: 1, status: "draft" };
    const mockDb = createMock([row]);
    const result = await playbookQueries.createPlaybook(mockDb, {
      workspaceId: "w1",
      title: "Release",
      definition,
    });
    expect(mockDb.insert).toHaveBeenCalledWith(playbook);
    expect(result).toEqual(row);
  });

  it("getPlaybook selects from the playbook table (where carries workspace scope)", async () => {
    const rows = [{ id: "pb1", workspaceId: "w1" }];
    const mockDb = createMock(rows);
    const result = await playbookQueries.getPlaybook(mockDb, "pb1", "w1");
    expect(mockDb.from).toHaveBeenCalledWith(playbook);
    expect(mockDb.where).toHaveBeenCalled();
    expect(result).toEqual(rows[0]);
  });

  it("getPlaybook returns null when no row", async () => {
    const mockDb = createMock([]);
    const result = await playbookQueries.getPlaybook(mockDb, "pbX", "w1");
    expect(result).toBeNull();
  });

  it("updatePlaybook goes through the update path", async () => {
    const rows = [{ id: "pb1", version: 2 }];
    const mockDb = createMock(rows);
    const result = await playbookQueries.updatePlaybook(mockDb, "pb1", "w1", {
      version: 2,
      definition,
    });
    expect(mockDb.update).toHaveBeenCalledWith(playbook);
    expect(result).toEqual(rows[0]);
  });

  it("deletePlaybook deletes scoped by workspace", async () => {
    const rows = [{ id: "pb1" }];
    const mockDb = createMock(rows);
    const result = await playbookQueries.deletePlaybook(mockDb, "pb1", "w1");
    expect(mockDb.delete).toHaveBeenCalledWith(playbook);
    expect(result).toEqual(rows[0]);
  });
});

describe("playbook-run queries", () => {
  it("createPlaybookRun inserts with snapshot and first step", async () => {
    const row = { id: "pbr1", workspaceId: "w1", status: "running", currentStepId: "s1" };
    const mockDb = createMock([row]);
    const result = await runQueries.createPlaybookRun(mockDb, {
      workspaceId: "w1",
      playbookId: "pb1",
      playbookVersion: 1,
      agentId: "ag1",
      snapshot: definition,
      firstStepId: "s1",
    });
    expect(mockDb.insert).toHaveBeenCalledWith(playbookRun);
    expect(result).toEqual(row);
  });

  it("getPlaybookRun scopes by workspace", async () => {
    const rows = [{ id: "pbr1" }];
    const mockDb = createMock(rows);
    const result = await runQueries.getPlaybookRun(mockDb, "pbr1", "w1");
    expect(mockDb.from).toHaveBeenCalledWith(playbookRun);
    expect(result).toEqual(rows[0]);
  });

  it("ensureStepRun inserts idempotently then reads back", async () => {
    const row = { id: "pbsr1", runId: "pbr1", stepId: "s1", status: "pending" };
    const mockDb = createMock([row]);
    const result = await runQueries.ensureStepRun(mockDb, {
      runId: "pbr1",
      workspaceId: "w1",
      stepId: "s1",
      stepKind: "agent",
    });
    expect(mockDb.insert).toHaveBeenCalledWith(playbookStepRun);
    expect(mockDb.onConflictDoNothing).toHaveBeenCalled();
    expect(mockDb.from).toHaveBeenCalledWith(playbookStepRun);
    expect(result).toEqual(row);
  });

  it("updateStepRun scopes by run + step + workspace", async () => {
    const rows = [{ id: "pbsr1", status: "completed" }];
    const mockDb = createMock(rows);
    const result = await runQueries.updateStepRun(mockDb, "pbr1", "s1", "w1", {
      status: "completed",
      output: "done",
    });
    expect(mockDb.update).toHaveBeenCalledWith(playbookStepRun);
    expect(result).toEqual(rows[0]);
  });

  it("listStepRuns scopes by run + workspace", async () => {
    const rows = [{ id: "pbsr1" }, { id: "pbsr2" }];
    const mockDb = createMock(rows);
    mockDb.where = vi.fn(() => Promise.resolve(rows));
    const result = await runQueries.listStepRuns(mockDb, "pbr1", "w1");
    expect(mockDb.from).toHaveBeenCalledWith(playbookStepRun);
    expect(result).toEqual(rows);
  });

  it("listStuckPlaybookRuns joins step runs and scopes by workspace", async () => {
    const rows = [{ runId: "pbr1" }];
    const mockDb = createMock(rows);
    mockDb.innerJoin = vi.fn(() => mockDb);
    mockDb.where = vi.fn(() => mockDb);
    mockDb.limit = vi.fn(() => Promise.resolve(rows));
    const result = await runQueries.listStuckPlaybookRuns(mockDb, "w1");
    expect(mockDb.from).toHaveBeenCalledWith(playbookRun);
    expect(mockDb.innerJoin).toHaveBeenCalledWith(playbookStepRun, expect.anything());
    expect(result).toEqual(rows);
  });
});
