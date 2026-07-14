import { eq, and, gt, asc, notInArray } from "drizzle-orm";
import { taskMessage, agentTaskQueue } from "../schema";
import type { Database } from "../index";

export const TASK_MESSAGE_CONFLICT_PREFLIGHT_SQL = `
SELECT DISTINCT
  candidate.task_id,
  candidate.seq
FROM task_message AS candidate
WHERE EXISTS (
  SELECT 1
  FROM task_message AS conflicting
  WHERE conflicting.task_id = candidate.task_id
    AND conflicting.seq = candidate.seq
    AND conflicting.id <> candidate.id
    AND (
      conflicting.type IS NOT candidate.type
      OR conflicting.tool IS NOT candidate.tool
      OR conflicting.call_id IS NOT candidate.call_id
      OR conflicting.content IS NOT candidate.content
      OR conflicting.input IS NOT candidate.input
      OR conflicting.output IS NOT candidate.output
    )
)
ORDER BY candidate.task_id, candidate.seq;
`.trim();

export interface TaskMessageInsert {
  taskId: string;
  seq: number;
  type: string;
  tool: string;
  callId?: string;
  content: string;
  input?: unknown;
  output: string;
}

export class TaskMessageConflictError extends Error {
  constructor(taskId: string, seq: number) {
    super(`task message payload conflict for ${taskId}:${seq}`);
    this.name = "TaskMessageConflictError";
  }
}

function canonicalJson(value: unknown): string {
  if (value == null) return "null";
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalJson(entryValue)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function payloadMatches(
  existing: typeof taskMessage.$inferSelect,
  data: TaskMessageInsert,
): boolean {
  return taskMessagePayloadFingerprint({
    taskId: existing.taskId,
    seq: existing.seq,
    type: existing.type,
    tool: existing.tool,
    callId: existing.callId,
    content: existing.content,
    input: existing.input,
    output: existing.output,
  }) === taskMessagePayloadFingerprint(data);
}

export function taskMessagePayloadFingerprint(data: TaskMessageInsert): string {
  return canonicalJson({
    type: data.type,
    tool: data.tool,
    callId: data.callId || "",
    content: data.content,
    input: data.input ?? null,
    output: data.output,
  });
}

export async function createTaskMessage(
  db: Database,
  data: TaskMessageInsert,
): Promise<{ message: typeof taskMessage.$inferSelect; created: boolean }> {
  const values = {
    taskId: data.taskId,
    seq: data.seq,
    type: data.type,
    tool: data.tool,
    callId: data.callId || "",
    content: data.content,
    input: data.input ?? null,
    output: data.output,
  };
  const inserted = await db
    .insert(taskMessage)
    .values(values)
    .onConflictDoNothing({ target: [taskMessage.taskId, taskMessage.seq] })
    .returning();
  if (inserted[0]) {
    return { message: inserted[0], created: true };
  }

  const existing = await db
    .select()
    .from(taskMessage)
    .where(and(eq(taskMessage.taskId, data.taskId), eq(taskMessage.seq, data.seq)))
    .limit(1);
  if (!existing[0] || !payloadMatches(existing[0], data)) {
    throw new TaskMessageConflictError(data.taskId, data.seq);
  }
  return { message: existing[0], created: false };
}

export async function listTaskMessages(db: Database, taskId: string, workspaceId: string) {
  return db
    .select({
      id: taskMessage.id,
      taskId: taskMessage.taskId,
      seq: taskMessage.seq,
      type: taskMessage.type,
      tool: taskMessage.tool,
      content: taskMessage.content,
      callId: taskMessage.callId,
      input: taskMessage.input,
      output: taskMessage.output,
      createdAt: taskMessage.createdAt,
    })
    .from(taskMessage)
    .innerJoin(agentTaskQueue, eq(taskMessage.taskId, agentTaskQueue.id))
    // Exclude tool-result/tool-use/thinking from the READ side only: the UI
    // doesn't render them. They ARE still written (see chhlat messages route)
    // and retained for future data analysis — do NOT take this filter as a
    // sign the rows are dead and stop persisting them.
    .where(and(eq(taskMessage.taskId, taskId), eq(agentTaskQueue.workspaceId, workspaceId), notInArray(taskMessage.type, ["tool-result", "tool-use", "thinking"])))
    .orderBy(asc(taskMessage.seq));
}

// Errors-only, workspace-scoped: the chat init routes preload only `type:"error"`
// rows so a persisted error survives a reload (the rest of a run's messages arrive
// live via the task.messages WS broadcast / send-dm). Filtering in SQL keeps the
// route's hot path lean and the workspace join enforces scoping. Kept separate
// from listTaskMessages (which is the UI-exclusion read) on purpose.
export async function listTaskErrorMessages(
  db: Database,
  taskId: string,
  workspaceId: string
) {
  return db
    .select({
      id: taskMessage.id,
      taskId: taskMessage.taskId,
      seq: taskMessage.seq,
      type: taskMessage.type,
      tool: taskMessage.tool,
      content: taskMessage.content,
      callId: taskMessage.callId,
      input: taskMessage.input,
      output: taskMessage.output,
      createdAt: taskMessage.createdAt,
    })
    .from(taskMessage)
    .innerJoin(agentTaskQueue, eq(taskMessage.taskId, agentTaskQueue.id))
    .where(
      and(
        eq(taskMessage.taskId, taskId),
        eq(agentTaskQueue.workspaceId, workspaceId),
        eq(taskMessage.type, "error")
      )
    )
    .orderBy(asc(taskMessage.seq));
}

export async function listTaskMessagesSince(
  db: Database,
  taskId: string,
  afterSeq: number,
  workspaceId: string,
) {
  return db
    .select({
      id: taskMessage.id,
      taskId: taskMessage.taskId,
      seq: taskMessage.seq,
      type: taskMessage.type,
      tool: taskMessage.tool,
      content: taskMessage.content,
      callId: taskMessage.callId,
      input: taskMessage.input,
      output: taskMessage.output,
      createdAt: taskMessage.createdAt,
    })
    .from(taskMessage)
    .innerJoin(agentTaskQueue, eq(taskMessage.taskId, agentTaskQueue.id))
    // Read-side UI exclusion only; rows are still stored for analysis (see listTaskMessages).
    .where(and(eq(taskMessage.taskId, taskId), eq(agentTaskQueue.workspaceId, workspaceId), gt(taskMessage.seq, afterSeq), notInArray(taskMessage.type, ["tool-result", "tool-use", "thinking"])))
    .orderBy(asc(taskMessage.seq));
}

export async function deleteTaskMessages(db: Database, taskId: string) {
  await db.delete(taskMessage).where(eq(taskMessage.taskId, taskId));
}
