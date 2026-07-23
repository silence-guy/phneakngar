import type { Database } from "@phneakngar/shared";
import { queries, TASK_TYPES } from "@phneakngar/shared";
import { TaskService } from "./task";
import { throttled, invalidate, cacheKeys } from "@/lib/cache";
import { handlePlaybookTaskTerminal, advancePlaybookRun } from "./playbook-engine";
import { log } from "@/lib/logger";

const SWEEP_INTERVAL_S = 30;

/** @internal test-only */
export function _resetSweepThrottle() {}

/**
 * Unified workspace housekeeping. Any code path that wants to ensure
 * stale state is cleaned up just calls this one function.
 * Rate-limited to once per 30s per workspace via KV (timestamp-based).
 */
export async function sweepStaleState(
  db: Database,
  workspaceId: string,
  opts?: { emailDomain?: string },
) {
  const lockKey = `sweep:${workspaceId}`;
  let shouldRun = false;
  try {
    shouldRun = await throttled(lockKey, SWEEP_INTERVAL_S, async () => {});
  } catch {
    shouldRun = true;
  }
  if (!shouldRun) return;

  // 1. Fail tasks stuck in "dispatched" for >20s (chhlat crashed between claim and start)
  const staleDispatched = await queries.task.failStaleDispatchedTasks(db, workspaceId);

  // 1b. Fail kill_tasks stuck for >30s (chhlat offline or crashed after claim)
  await queries.task.failStaleKillTasks(db, workspaceId);

  // 2. Fail tasks stuck in "running" with no message activity for >1h
  const staleRunning = await queries.task.failStaleRunningTasks(db, workspaceId);

  // 2b. Recover playbook runs whose step task was failed by the sweeper.
  // Without this, a stranded playbook-step task would leave the run stuck in
  // "running" forever (the failure path needs no emailDomain: it never
  // dispatches a next step).
  const allStale = [...staleDispatched, ...staleRunning];
  for (const r of allStale) {
    if (r.type !== TASK_TYPES.PLAYBOOK_STEP) continue;
    await handlePlaybookTaskTerminal(
      db,
      { id: r.id, workspaceId: r.workspaceId, type: r.type, context: r.context },
      "failed",
      { error: "step task timed out (runtime likely disconnected)" },
    ).catch((err) => {
      log.warn("playbook: sweep recovery failed", { taskId: r.id, err: String(err) });
    });
  }

  // 2c. Re-drive playbook runs whose current step is resolved but was never
  // advanced (advance threw after the step CAS committed). Idempotent.
  const stuckRuns = await queries.playbookRun.listStuckPlaybookRuns(db, workspaceId);
  for (const r of stuckRuns) {
    await advancePlaybookRun(db, workspaceId, r.runId, {
      emailDomain: opts?.emailDomain,
    }).catch((err) => {
      log.warn("playbook: stuck-run advance failed", { runId: r.runId, err: String(err) });
    });
  }

  // 3. Reconcile agent status for all affected agents
  if (allStale.length > 0) {
    const taskService = new TaskService(db);
    const seenAgents = new Set<string>();
    for (const r of allStale) {
      const key = `${r.agentId}:${r.workspaceId}`;
      if (seenAgents.has(key)) continue;
      seenAgents.add(key);
      await taskService.reconcileAgentStatus(r.agentId, r.workspaceId);
    }

    // Invalidate caches that sweep modified
    const dateStr = new Date().toISOString().slice(0, 10);
    await Promise.all([
      invalidate(cacheKeys.overviewTaskStats(workspaceId, dateStr)),
      invalidate(cacheKeys.activeTaskCounts(workspaceId)),
    ]).catch(() => {});
  }
}
