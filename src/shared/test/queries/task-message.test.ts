import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, asc } from "drizzle-orm";
import { taskMessage, agentTaskQueue } from "../../src/db/schema";
import * as taskMessageQueries from "../../src/db/queries/task-message";

const fakeDb = drizzle({} as never);

// Chainable mock that captures the .where() argument so we can exercise the REAL
// query fn (it's async + awaits its builder internally, so we can't .toSQL() the
// fn's return value directly — the runtime would auto-await a dead connection).
function createCapturingDb(rows: unknown[]) {
  const calls: { where?: unknown } = {};
  const chain: any = {};
  chain.select = vi.fn(() => chain);
  chain.from = vi.fn(() => chain);
  chain.innerJoin = vi.fn(() => chain);
  chain.where = vi.fn((cond: unknown) => {
    calls.where = cond;
    return chain;
  });
  chain.orderBy = vi.fn(() => Promise.resolve(rows));
  return { chain, calls };
}

describe("task-message query module exports", () => {
  it("exports createTaskMessage", () => {
    expect(typeof taskMessageQueries.createTaskMessage).toBe("function");
  });

  it("exports listTaskMessages", () => {
    expect(typeof taskMessageQueries.listTaskMessages).toBe("function");
  });

  it("exports listTaskErrorMessages", () => {
    expect(typeof taskMessageQueries.listTaskErrorMessages).toBe("function");
  });

  it("exports listTaskMessagesSince", () => {
    expect(typeof taskMessageQueries.listTaskMessagesSince).toBe("function");
  });

  it("exports deleteTaskMessages", () => {
    expect(typeof taskMessageQueries.deleteTaskMessages).toBe("function");
  });

  it("exports taskMessagePayloadFingerprint", () => {
    expect(typeof taskMessageQueries.taskMessagePayloadFingerprint).toBe("function");
  });

  it("exports TASK_MESSAGE_CONFLICT_PREFLIGHT_SQL", () => {
    expect(typeof taskMessageQueries.TASK_MESSAGE_CONFLICT_PREFLIGHT_SQL).toBe("string");
  });
});

describe("createTaskMessage", () => {
  const data = {
    taskId: "task-1",
    seq: 7,
    type: "text",
    tool: "",
    callId: "call-1",
    content: "hello",
    input: { nested: { b: 2, a: 1 } },
    output: "",
  };

  function createInsertDb(
    inserted: unknown[],
    existing: unknown[],
  ) {
    const insertChain: any = {};
    insertChain.values = vi.fn(() => insertChain);
    insertChain.onConflictDoNothing = vi.fn(() => insertChain);
    insertChain.returning = vi.fn(() => Promise.resolve(inserted));

    const selectChain: any = {};
    selectChain.from = vi.fn(() => selectChain);
    selectChain.where = vi.fn(() => selectChain);
    selectChain.limit = vi.fn(() => Promise.resolve(existing));

    return {
      insert: vi.fn(() => insertChain),
      select: vi.fn(() => selectChain),
      insertChain,
      selectChain,
    } as any;
  }

  it("returns a newly inserted durable row", async () => {
    const row = { id: "tm-1", ...data, createdAt: "2026-01-01T00:00:00.000Z" };
    const db = createInsertDb([row], []);

    await expect(taskMessageQueries.createTaskMessage(db, data)).resolves.toEqual({
      message: row,
      created: true,
    });
    expect(db.insertChain.onConflictDoNothing).toHaveBeenCalledOnce();
    expect(db.select).not.toHaveBeenCalled();
  });

  it("treats an exact replay as an idempotent success", async () => {
    const row = { id: "tm-1", ...data, input: { nested: { a: 1, b: 2 } }, createdAt: "2026-01-01T00:00:00.000Z" };
    const db = createInsertDb([], [row]);

    await expect(taskMessageQueries.createTaskMessage(db, data)).resolves.toEqual({
      message: row,
      created: false,
    });
  });

  it("rejects a replay with a conflicting payload", async () => {
    const row = { id: "tm-1", ...data, content: "different", createdAt: "2026-01-01T00:00:00.000Z" };
    const db = createInsertDb([], [row]);

    await expect(taskMessageQueries.createTaskMessage(db, data)).rejects.toBeInstanceOf(
      taskMessageQueries.TaskMessageConflictError,
    );
  });

  it("fingerprints equivalent payloads with canonical JSON object key order", () => {
    expect(taskMessageQueries.taskMessagePayloadFingerprint(data)).toBe(
      taskMessageQueries.taskMessagePayloadFingerprint({
        ...data,
        input: { nested: { a: 1, b: 2 } },
      }),
    );
  });
});

describe("TASK_MESSAGE_CONFLICT_PREFLIGHT_SQL", () => {
  it("uses null-aware column comparisons instead of delimiter concatenation", () => {
    const sql = taskMessageQueries.TASK_MESSAGE_CONFLICT_PREFLIGHT_SQL;

    expect(sql).toContain("WHERE EXISTS");
    expect(sql).not.toContain("char(31)");
    expect(sql).not.toContain(" || ");
    for (const column of ["type", "tool", "call_id", "content", "input", "output"]) {
      expect(sql).toContain(`conflicting.${column} IS NOT candidate.${column}`);
    }
  });

  it("covers payloads that collide under the old delimiter fingerprint", () => {
    const delimiter = String.fromCharCode(31);
    const left = ["text", `tool${delimiter}call`, "id", "content", "null", ""];
    const right = ["text", "tool", `call${delimiter}id`, "content", "null", ""];

    expect(left.join(delimiter)).toBe(right.join(delimiter));
    expect(taskMessageQueries.TASK_MESSAGE_CONFLICT_PREFLIGHT_SQL).toContain(
      "conflicting.tool IS NOT candidate.tool",
    );
    expect(taskMessageQueries.TASK_MESSAGE_CONFLICT_PREFLIGHT_SQL).toContain(
      "conflicting.call_id IS NOT candidate.call_id",
    );
  });

  it("keeps docs/migrations.md aligned with the shared preflight SQL", () => {
    const docs = readFileSync(new URL("../../../../docs/migrations.md", import.meta.url), "utf8");
    expect(docs).toContain(taskMessageQueries.TASK_MESSAGE_CONFLICT_PREFLIGHT_SQL);
  });
});

describe("listTaskMessages", () => {
  it("requires (db, taskId, workspaceId)", () => {
    expect(taskMessageQueries.listTaskMessages.length).toBe(3);
  });
});

describe("listTaskErrorMessages", () => {
  it("accepts (db, taskId, workspaceId)", () => {
    expect(taskMessageQueries.listTaskErrorMessages.length).toBe(3);
  });

  it("runs the real query: joins, builds a WHERE, and returns the rows", async () => {
    const rows = [{ id: "tm1", type: "error" }];
    const { chain, calls } = createCapturingDb(rows);
    const result = await taskMessageQueries.listTaskErrorMessages(
      chain,
      "task-1",
      "ws-1",
    );
    // Exercises the actual fn (not a mirror): it joins, filters, and returns rows.
    expect(chain.innerJoin).toHaveBeenCalled();
    expect(chain.where).toHaveBeenCalledTimes(1);
    expect(calls.where).toBeDefined();
    expect(result).toEqual(rows);
  });

  it("compiles the expected WHERE clause (type='error', task + workspace scope)", () => {
    // Reference SQL for the query above. This documents the intended shape and
    // catches a regression in the column/filter set; it is a sibling check to
    // the real-fn test above, not a stand-in for it.
    const { sql, params } = fakeDb
      .select()
      .from(taskMessage)
      .innerJoin(agentTaskQueue, eq(taskMessage.taskId, agentTaskQueue.id))
      .where(
        and(
          eq(taskMessage.taskId, "task-1"),
          eq(agentTaskQueue.workspaceId, "ws-1"),
          eq(taskMessage.type, "error"),
        ),
      )
      .orderBy(asc(taskMessage.seq))
      .toSQL();

    expect(sql).toContain('inner join "agent_task_queue"');
    expect(sql).toContain('"task_message"."task_id" = ?');
    expect(sql).toContain('"agent_task_queue"."workspace_id" = ?');
    expect(sql).toContain('"task_message"."type" = ?');
    expect(sql).toContain('order by "task_message"."seq" asc');
    expect(params).toEqual(["task-1", "ws-1", "error"]);
  });
});

describe("listTaskMessagesSince", () => {
  it("requires (db, taskId, afterSeq, workspaceId)", () => {
    expect(taskMessageQueries.listTaskMessagesSince.length).toBe(4);
  });
});
