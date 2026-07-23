import { and, desc, eq, inArray, isNotNull, notInArray } from "drizzle-orm";
import { playbookRun, playbookStepRun } from "../schema";
import type { Database } from "../index";
import type { PlaybookDefinition } from "../../lib/playbook";

const TERMINAL_RUN_STATUSES = ["completed", "failed", "cancelled"];

export async function createPlaybookRun(
  db: Database,
  data: {
    workspaceId: string;
    playbookId: string;
    playbookVersion: number;
    agentId: string;
    runtimeId?: string | null;
    conversationId?: string | null;
    snapshot: PlaybookDefinition;
    input?: Record<string, unknown> | null;
    startedByUserId?: string | null;
    firstStepId: string;
  }
) {
  const now = new Date().toISOString();
  const rows = await db
    .insert(playbookRun)
    .values({
      workspaceId: data.workspaceId,
      playbookId: data.playbookId,
      playbookVersion: data.playbookVersion,
      agentId: data.agentId,
      runtimeId: data.runtimeId ?? null,
      conversationId: data.conversationId ?? null,
      status: "running",
      currentStepId: data.firstStepId,
      snapshot: data.snapshot,
      input: data.input ?? null,
      output: null,
      startedByUserId: data.startedByUserId ?? null,
      createdAt: now,
      startedAt: now,
    })
    .returning();
  return rows[0]!;
}

export async function getPlaybookRun(db: Database, id: string, workspaceId: string) {
  const rows = await db
    .select()
    .from(playbookRun)
    .where(and(eq(playbookRun.id, id), eq(playbookRun.workspaceId, workspaceId)));
  return rows[0] ?? null;
}

export async function listPlaybookRuns(
  db: Database,
  workspaceId: string,
  opts?: { playbookId?: string; agentId?: string; status?: string; limit?: number }
) {
  const conditions = [eq(playbookRun.workspaceId, workspaceId)];
  if (opts?.playbookId) conditions.push(eq(playbookRun.playbookId, opts.playbookId));
  if (opts?.agentId) conditions.push(eq(playbookRun.agentId, opts.agentId));
  if (opts?.status) conditions.push(eq(playbookRun.status, opts.status));
  return db
    .select()
    .from(playbookRun)
    .where(and(...conditions))
    .orderBy(desc(playbookRun.createdAt))
    .limit(opts?.limit ?? 50);
}

/**
 * Non-terminal runs whose current step_run is already resolved
 * (completed/failed) but was never advanced — e.g. the advance call threw
 * after the step CAS committed. The sweeper re-drives `advancePlaybookRun`
 * for these; advance is idempotent so concurrent re-drive is safe.
 */
export async function listStuckPlaybookRuns(db: Database, workspaceId: string, limit = 20) {
  return db
    .select({ runId: playbookRun.id })
    .from(playbookRun)
    .innerJoin(
      playbookStepRun,
      and(
        eq(playbookStepRun.runId, playbookRun.id),
        eq(playbookStepRun.workspaceId, playbookRun.workspaceId),
        eq(playbookStepRun.stepId, playbookRun.currentStepId),
        inArray(playbookStepRun.status, ["completed", "failed"])
      )
    )
    .where(
      and(
        eq(playbookRun.workspaceId, workspaceId),
        isNotNull(playbookRun.currentStepId),
        notInArray(playbookRun.status, TERMINAL_RUN_STATUSES)
      )
    )
    .limit(limit);
}

export async function updatePlaybookRun(
  db: Database,
  id: string,
  workspaceId: string,
  patch: {
    status?: string;
    currentStepId?: string | null;
    output?: Record<string, string> | null;
    currentTaskId?: string | null;
    currentApprovalId?: string | null;
    finishedAt?: string | null;
    error?: string | null;
  }
) {
  const rows = await db
    .update(playbookRun)
    .set(patch)
    .where(and(eq(playbookRun.id, id), eq(playbookRun.workspaceId, workspaceId)))
    .returning();
  return rows[0] ?? null;
}

/**
 * Compare-and-swap update that only applies while the run is non-terminal.
 * Returns null when the run is already completed/failed/cancelled, letting
 * callers abort concurrent advances (e.g. completion racing a cancel).
 */
export async function updatePlaybookRunIfActive(
  db: Database,
  id: string,
  workspaceId: string,
  patch: {
    status?: string;
    currentStepId?: string | null;
    output?: Record<string, string> | null;
    currentTaskId?: string | null;
    currentApprovalId?: string | null;
    finishedAt?: string | null;
    error?: string | null;
  }
) {
  const rows = await db
    .update(playbookRun)
    .set(patch)
    .where(
      and(
        eq(playbookRun.id, id),
        eq(playbookRun.workspaceId, workspaceId),
        notInArray(playbookRun.status, TERMINAL_RUN_STATUSES)
      )
    )
    .returning();
  return rows[0] ?? null;
}

/**
 * Idempotent step creation: unique(runId, stepId) means a duplicate dispatch
 * delivery returns the existing row instead of inserting twice.
 */
export async function ensureStepRun(
  db: Database,
  data: {
    runId: string;
    workspaceId: string;
    stepId: string;
    stepKind: string;
  }
) {
  await db
    .insert(playbookStepRun)
    .values({
      runId: data.runId,
      workspaceId: data.workspaceId,
      stepId: data.stepId,
      stepKind: data.stepKind,
      status: "pending",
    })
    .onConflictDoNothing();
  const rows = await db
    .select()
    .from(playbookStepRun)
    .where(
      and(
        eq(playbookStepRun.runId, data.runId),
        eq(playbookStepRun.stepId, data.stepId),
        eq(playbookStepRun.workspaceId, data.workspaceId)
      )
    );
  return rows[0] ?? null;
}

export async function getStepRun(
  db: Database,
  runId: string,
  stepId: string,
  workspaceId: string
) {
  const rows = await db
    .select()
    .from(playbookStepRun)
    .where(
      and(
        eq(playbookStepRun.runId, runId),
        eq(playbookStepRun.stepId, stepId),
        eq(playbookStepRun.workspaceId, workspaceId)
      )
    );
  return rows[0] ?? null;
}

export async function listStepRuns(db: Database, runId: string, workspaceId: string) {
  return db
    .select()
    .from(playbookStepRun)
    .where(
      and(eq(playbookStepRun.runId, runId), eq(playbookStepRun.workspaceId, workspaceId))
    );
}

export async function updateStepRun(
  db: Database,
  runId: string,
  stepId: string,
  workspaceId: string,
  patch: {
    status?: string;
    output?: string | null;
    taskId?: string | null;
    approvalId?: string | null;
    startedAt?: string | null;
    finishedAt?: string | null;
    error?: string | null;
  }
) {
  const rows = await db
    .update(playbookStepRun)
    .set(patch)
    .where(
      and(
        eq(playbookStepRun.runId, runId),
        eq(playbookStepRun.stepId, stepId),
        eq(playbookStepRun.workspaceId, workspaceId)
      )
    )
    .returning();
  return rows[0] ?? null;
}

/**
 * Compare-and-swap step resolution: applies the patch only when the step is
 * still in `expectedStatus`. Returns null when a concurrent delivery already
 * resolved it, making duplicate task/approval callbacks safe.
 */
export async function resolveStepRunIfStatus(
  db: Database,
  runId: string,
  stepId: string,
  workspaceId: string,
  expectedStatus: string,
  patch: {
    status?: string;
    output?: string | null;
    error?: string | null;
    finishedAt?: string | null;
  }
) {
  const rows = await db
    .update(playbookStepRun)
    .set(patch)
    .where(
      and(
        eq(playbookStepRun.runId, runId),
        eq(playbookStepRun.stepId, stepId),
        eq(playbookStepRun.workspaceId, workspaceId),
        eq(playbookStepRun.status, expectedStatus)
      )
    )
    .returning();
  return rows[0] ?? null;
}
