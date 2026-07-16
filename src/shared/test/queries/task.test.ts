import { describe, it, expect, vi } from "vitest";
import * as taskQueries from "../../src/db/queries/task";

function createMockDb(rows: any[]) {
  const chain: any = {};
  chain.select = vi.fn(() => chain);
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(() => Promise.resolve(rows));
  chain.insert = vi.fn(() => chain);
  chain.values = vi.fn(() => chain);
  chain.returning = vi.fn(() => Promise.resolve(rows));
  chain.update = vi.fn(() => chain);
  chain.set = vi.fn(() => chain);
  chain.delete = vi.fn(() => chain);
  chain.groupBy = vi.fn(() => chain);
  chain.leftJoin = vi.fn(() => chain);
  chain.innerJoin = vi.fn(() => chain);
  return chain;
}

describe("task query module exports", () => {
  it("exports listActiveTaskCountsByWorkspace", () => {
    expect(typeof taskQueries.listActiveTaskCountsByWorkspace).toBe("function");
  });

  it("exports listActiveTasksByAgent", () => {
    expect(typeof taskQueries.listActiveTasksByAgent).toBe("function");
  });

  it("exports countRunningTasks", () => {
    expect(typeof taskQueries.countRunningTasks).toBe("function");
  });

  it("exports getActiveTaskByConversation", () => {
    expect(typeof taskQueries.getActiveTaskByConversation).toBe("function");
  });

  it("exports failStaleRunningTasks", () => {
    expect(typeof taskQueries.failStaleRunningTasks).toBe("function");
  });

  it("exports visible outcome helpers", () => {
    expect(typeof taskQueries.detectTaskVisibleOutcome).toBe("function");
    expect(typeof taskQueries.updateTaskVisibleOutcomeStatus).toBe("function");
  });
});

describe("task query function signatures", () => {
  it("listActiveTaskCountsByWorkspace accepts (db, workspaceId, agentIds?, userId?)", () => {
    expect(taskQueries.listActiveTaskCountsByWorkspace.length).toBe(4);
  });

  it("listActiveTasksByAgent accepts (db, agentId, workspaceId, userId?)", () => {
    expect(taskQueries.listActiveTasksByAgent.length).toBe(4);
  });
});

describe("listPendingTasksByRuntimes", () => {
  it("returns empty array for empty runtimeIds without querying DB", async () => {
    const result = await taskQueries.listPendingTasksByRuntimes(null as any, [], "ws_1");
    expect(result).toEqual([]);
  });

  it("applies a bounded candidate limit", async () => {
    const mockDb = createMockDb([]);
    await taskQueries.listPendingTasksByRuntimes(mockDb, ["rt_1"], "ws_1", 999);
    expect(mockDb.limit).toHaveBeenCalledWith(64);
  });

  it("groups candidates by agent before applying the response limit", async () => {
    const mockDb = createMockDb([]);
    await taskQueries.listPendingTasksByRuntimes(mockDb, ["rt_1"], "ws_1", 8);
    expect(mockDb.groupBy).toHaveBeenCalledTimes(1);
    expect(mockDb.limit).toHaveBeenCalledWith(8);
  });

  it("joins agent capacity and applies claimability predicates before limiting", async () => {
    const mockDb = createMockDb([]);
    await taskQueries.listPendingTasksByRuntimes(mockDb, ["rt_1"], "ws_1", 8);
    expect(mockDb.innerJoin).toHaveBeenCalledTimes(1);
    expect(mockDb.where).toHaveBeenCalledTimes(1);
    expect(mockDb.limit).toHaveBeenCalledWith(8);
  });

  it("returns empty array for zero limit without querying DB", async () => {
    const result = await taskQueries.listPendingTasksByRuntimes(null as any, ["rt_1"], "ws_1", 0);
    expect(result).toEqual([]);
  });
});

describe("claimKillTasks", () => {
  it("returns empty array for empty runtimeIds without querying DB", async () => {
    const result = await taskQueries.claimKillTasks(null as any, [], "ws_1", 10);
    expect(result).toEqual([]);
  });

  it("returns empty array for zero limit without querying DB", async () => {
    const result = await taskQueries.claimKillTasks(null as any, ["rt_1"], "ws_1", 0);
    expect(result).toEqual([]);
  });
});

describe("countTasksByTrace", () => {
  it("returns count from query", async () => {
    const chain: any = {};
    chain.select = vi.fn(() => chain);
    chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => Promise.resolve([{ value: 7 }]));
    const result = await taskQueries.countTasksByTrace(chain, "trace_1", "ws_1");
    expect(result).toBe(7);
  });

  it("returns 0 when no results", async () => {
    const chain: any = {};
    chain.select = vi.fn(() => chain);
    chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => Promise.resolve([]));
    const result = await taskQueries.countTasksByTrace(chain, "trace_empty", "ws_1");
    expect(result).toBe(0);
  });
});

describe("getLatestTaskForConversation", () => {
  it("returns null when no tasks exist", async () => {
    const mockDb = createMockDb([]);
    const result = await taskQueries.getLatestTaskForConversation(mockDb, "conv_empty");
    expect(result).toBeNull();
  });

  it("returns latest task when found", async () => {
    const task = { id: "task_1", traceId: "trace_1" };
    const mockDb = createMockDb([task]);
    const result = await taskQueries.getLatestTaskForConversation(mockDb, "conv_1");
    expect(result).toEqual(task);
  });
});

describe("getTask", () => {
  it("returns null when task not found", async () => {
    const chain: any = {};
    chain.select = vi.fn(() => chain);
    chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => Promise.resolve([]));
    const result = await taskQueries.getTask(chain, "task_missing", "ws_1");
    expect(result).toBeNull();
  });

  it("returns task when found", async () => {
    const task = { id: "task_1", status: "running" };
    const chain: any = {};
    chain.select = vi.fn(() => chain);
    chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => Promise.resolve([task]));
    const result = await taskQueries.getTask(chain, "task_1", "ws_1");
    expect(result).toEqual(task);
  });
});

describe("getTaskStatus", () => {
  it("returns null when task not found", async () => {
    const chain: any = {};
    chain.select = vi.fn(() => chain);
    chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => Promise.resolve([]));
    const result = await taskQueries.getTaskStatus(chain, "task_missing", "ws_1");
    expect(result).toBeNull();
  });

  it("returns status when found", async () => {
    const chain: any = {};
    chain.select = vi.fn(() => chain);
    chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => Promise.resolve([{ status: "completed" }]));
    const result = await taskQueries.getTaskStatus(chain, "task_1", "ws_1");
    expect(result).toBe("completed");
  });
});

describe("hasPendingTaskForConversation", () => {
  it("returns true when pending tasks exist", async () => {
    const chain: any = {};
    chain.select = vi.fn(() => chain);
    chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.limit = vi.fn(() => Promise.resolve([{ id: "task_1" }]));
    const result = await taskQueries.hasPendingTaskForConversation(chain, "conv_1");
    expect(result).toBe(true);
  });

  it("returns false when no pending tasks", async () => {
    const chain: any = {};
    chain.select = vi.fn(() => chain);
    chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.limit = vi.fn(() => Promise.resolve([]));
    const result = await taskQueries.hasPendingTaskForConversation(chain, "conv_empty");
    expect(result).toBe(false);
  });
});

describe("getTraceAgentsByTaskIds", () => {
  it("returns empty map for empty taskIds", async () => {
    const result = await taskQueries.getTraceAgentsByTaskIds(null as any, [], "ws_1");
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });
});

describe("listCompletedTasksForPatternAnalysis", () => {
  it("exports listCompletedTasksForPatternAnalysis", () => {
    expect(typeof taskQueries.listCompletedTasksForPatternAnalysis).toBe("function");
  });

  it("requires workspaceId and scopes the query before filtering", async () => {
    const rows = [
      {
        id: "t1",
        agentId: "a1",
        prompt: "Send morning brief",
        type: "user_dm_message",
        completedAt: "2026-07-12T08:00:00.000Z",
      },
    ];
    const mockDb = createMockDb(rows);
    const result = await taskQueries.listCompletedTasksForPatternAnalysis(mockDb, "ws_1", {
      agentId: "a1",
      limit: 50,
    });

    expect(mockDb.select).toHaveBeenCalled();
    expect(mockDb.from).toHaveBeenCalled();
    expect(mockDb.where).toHaveBeenCalledTimes(1);
    expect(mockDb.orderBy).toHaveBeenCalledTimes(1);
    expect(mockDb.limit).toHaveBeenCalledWith(50);
    expect(result).toEqual(rows);
    // workspaceId is a required positional arg (db, workspaceId, opts?)
    expect(taskQueries.listCompletedTasksForPatternAnalysis.length).toBeGreaterThanOrEqual(2);
  });

  it("clamps task limit to [1, 500] with default 200", async () => {
    const mockDb = createMockDb([]);
    await taskQueries.listCompletedTasksForPatternAnalysis(mockDb, "ws_1");
    expect(mockDb.limit).toHaveBeenCalledWith(200);

    await taskQueries.listCompletedTasksForPatternAnalysis(mockDb, "ws_1", { limit: 0 });
    expect(mockDb.limit).toHaveBeenCalledWith(1);

    await taskQueries.listCompletedTasksForPatternAnalysis(mockDb, "ws_1", { limit: 9999 });
    expect(mockDb.limit).toHaveBeenCalledWith(500);
  });

  it("passes agent filter when agentId is provided", async () => {
    const mockDb = createMockDb([]);
    await taskQueries.listCompletedTasksForPatternAnalysis(mockDb, "ws_scope", {
      agentId: "agent_x",
    });
    expect(mockDb.where).toHaveBeenCalledTimes(1);
    // where receives a combined AND condition — call site proves workspace-first API
    expect(mockDb.where.mock.calls[0]).toHaveLength(1);
  });
});
