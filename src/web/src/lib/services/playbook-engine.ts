import type { Database } from "@phneakngar/shared";
import {
  queries,
  ApprovalKind,
  TASK_TYPES,
  playbookDefinitionSchema,
  renderPlaybookPrompt,
  isTerminalPlaybookRunStatus,
  PlaybookRunStatus,
  PlaybookStepRunStatus,
  PlaybookStepKind,
  type PlaybookStepDef,
} from "@phneakngar/shared";
import { log } from "@/lib/logger";
import { TaskService } from "@/lib/services/task";

const runQueries = queries.playbookRun;
const playbookQueries = queries.playbook;

export class PlaybookEngineError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "INVALID_STATE" | "VALIDATION" = "INVALID_STATE",
  ) {
    super(message);
    this.name = "PlaybookEngineError";
  }
}

function stepOutputMap(run: { output: unknown }): Record<string, string> {
  if (run.output && typeof run.output === "object") {
    return { ...(run.output as Record<string, string>) };
  }
  return {};
}

function nextStepAfter(snapshot: PlaybookStepDef[], stepId: string): PlaybookStepDef | null {
  const idx = snapshot.findIndex((s) => s.id === stepId);
  if (idx < 0 || idx + 1 >= snapshot.length) return null;
  return snapshot[idx + 1]!;
}

async function recordActivity(
  db: Database,
  data: {
    workspaceId: string;
    kind: string;
    summary: string;
    subjectId: string;
    dedupeKey: string;
    payload: Record<string, unknown>;
  },
) {
  try {
    await queries.activityEvent.createActivityEvent(db, {
      workspaceId: data.workspaceId,
      kind: data.kind,
      summary: data.summary,
      actorType: "system",
      actorId: null,
      subjectType: "playbook_run",
      subjectId: data.subjectId,
      dedupeKey: data.dedupeKey,
      payloadJson: JSON.stringify(data.payload),
    });
  } catch (err) {
    log.warn("playbook: activity event failed", { kind: data.kind, err: String(err) });
  }
}

/**
 * Fail a run whose step could not be dispatched (enqueue error, lost runtime,
 * deleted conversation). Uses the active-only CAS so a concurrent cancel wins.
 * Ensures no run is ever stranded in `running` without a live task/approval.
 */
async function failRunAtStep(
  db: Database,
  workspaceId: string,
  runId: string,
  stepId: string,
  error: string,
) {
  const cappedError = error.slice(0, 500);
  await runQueries
    .updateStepRun(db, runId, stepId, workspaceId, {
      status: PlaybookStepRunStatus.FAILED,
      error: cappedError,
      finishedAt: new Date().toISOString(),
    })
    .catch(() => {});
  const failed = await runQueries.updatePlaybookRunIfActive(db, runId, workspaceId, {
    status: PlaybookRunStatus.FAILED,
    finishedAt: new Date().toISOString(),
    error: cappedError,
    currentTaskId: null,
    currentApprovalId: null,
  });
  // Only record failure when this transition actually won the CAS; a
  // concurrent cancel keeps its own audit event.
  if (failed) {
    await recordActivity(db, {
      workspaceId,
      kind: "playbook_run_failed",
      summary: `Playbook run failed at step ${stepId}`,
      subjectId: runId,
      dedupeKey: `playbook-run-failed:${runId}`,
      payload: { step_id: stepId, error: cappedError },
    });
  }
  return failed;
}

async function dispatchStep(
  db: Database,
  taskService: TaskService,
  run: {
    id: string;
    workspaceId: string;
    agentId: string;
    conversationId: string | null;
    input: unknown;
    output: unknown;
  },
  step: PlaybookStepDef,
): Promise<void> {
  const now = new Date().toISOString();

  if (step.kind === PlaybookStepKind.APPROVAL) {
    const approval = await queries.approval.createApproval(db, {
      workspaceId: run.workspaceId,
      agentId: run.agentId,
      kind: ApprovalKind.PLAYBOOK_STEP_GATE,
      title: step.approvalTitle ?? `Playbook gate: ${step.title}`,
      summary: step.approvalSummary ?? step.title,
      payload: { runId: run.id, stepId: step.id },
    });
    // CAS: if the run went terminal (e.g. cancel landed mid-dispatch), expire
    // the just-created approval so no orphan stays pending in the inbox.
    const claimed = await runQueries.updatePlaybookRunIfActive(db, run.id, run.workspaceId, {
      status: PlaybookRunStatus.AWAITING_APPROVAL,
      currentApprovalId: approval.id,
      currentTaskId: null,
    });
    if (!claimed) {
      await queries.approval.expireApproval(db, approval.id, run.workspaceId).catch(() => {});
      return;
    }
    await runQueries.updateStepRun(db, run.id, step.id, run.workspaceId, {
      status: PlaybookStepRunStatus.AWAITING_APPROVAL,
      approvalId: approval.id,
      startedAt: now,
    });
    return;
  }

  if (step.kind === PlaybookStepKind.HUMAN_INPUT) {
    const claimed = await runQueries.updatePlaybookRunIfActive(db, run.id, run.workspaceId, {
      status: PlaybookRunStatus.AWAITING_INPUT,
      currentApprovalId: null,
      currentTaskId: null,
    });
    if (!claimed) return;
    await runQueries.updateStepRun(db, run.id, step.id, run.workspaceId, {
      status: PlaybookStepRunStatus.AWAITING_INPUT,
      startedAt: now,
    });
    return;
  }

  const prompt = renderPlaybookPrompt(step.prompt ?? "", {
    input: (run.input as Record<string, unknown> | null) ?? null,
    steps: stepOutputMap(run),
  });
  if (!run.conversationId) {
    throw new PlaybookEngineError("run has no conversation for agent step dispatch");
  }
  const task = await taskService.enqueueTask(
    run.agentId,
    run.conversationId,
    run.workspaceId,
    prompt,
    TASK_TYPES.PLAYBOOK_STEP,
    {
      contextKey: run.conversationId,
      context: { playbook_run_id: run.id, playbook_step_id: step.id },
      idempotencyId: `pbrun_${run.id}_${step.id}`,
    },
  );
  // CAS: if the run went terminal while the task was being created (cancel
  // race), supersede the task so no orphaned work executes on a dead run.
  const claimed = await runQueries.updatePlaybookRunIfActive(db, run.id, run.workspaceId, {
    status: PlaybookRunStatus.RUNNING,
    currentTaskId: task.id,
    currentApprovalId: null,
  });
  if (!claimed) {
    await queries.task.supersedeTask(db, task.id, run.workspaceId).catch((err) => {
      log.warn("playbook: supersede after terminal race failed", {
        runId: run.id,
        taskId: task.id,
        err: String(err),
      });
    });
    return;
  }
  await runQueries.updateStepRun(db, run.id, step.id, run.workspaceId, {
    status: PlaybookStepRunStatus.RUNNING,
    taskId: task.id,
    startedAt: now,
  });
}

export async function startPlaybookRun(
  db: Database,
  opts: {
    workspaceId: string;
    playbookId: string;
    agentId: string;
    input?: Record<string, unknown> | null;
    startedByUserId: string;
    conversationId?: string | null;
    emailDomain?: string;
  },
) {
  const pb = await playbookQueries.getPlaybook(db, opts.playbookId, opts.workspaceId);
  if (!pb) throw new PlaybookEngineError("playbook not found", "NOT_FOUND");
  if (pb.status !== "published") {
    throw new PlaybookEngineError("playbook is not published");
  }
  if (pb.agentId && pb.agentId !== opts.agentId) {
    throw new PlaybookEngineError("playbook is bound to a different agent");
  }

  const parsed = playbookDefinitionSchema.safeParse(pb.definition);
  if (!parsed.success) {
    throw new PlaybookEngineError("playbook definition is invalid", "VALIDATION");
  }
  const definition = parsed.data;

  const agent = await queries.agent.getAgent(
    db,
    opts.agentId,
    opts.workspaceId,
    opts.startedByUserId,
  );
  if (!agent) throw new PlaybookEngineError("agent not found", "NOT_FOUND");
  if (!agent.runtimeId) throw new PlaybookEngineError("agent has no runtime");

  let conversationId = opts.conversationId ?? null;
  if (conversationId) {
    // Validate caller-supplied conversations: must exist in this workspace and
    // belong to the executing agent (prevents cross-workspace task injection).
    const conv = await queries.conversation.getConversation(
      db,
      conversationId,
      opts.workspaceId,
    );
    if (!conv || conv.agentId !== opts.agentId) {
      throw new PlaybookEngineError("conversation not found for this agent", "NOT_FOUND");
    }
  } else {
    const conv = await queries.conversation.createConversation(db, {
      workspaceId: opts.workspaceId,
      agentId: opts.agentId,
      userId: agent.ownerId ?? opts.startedByUserId,
      title: `[Playbook] ${pb.title}`.slice(0, 120),
      type: TASK_TYPES.PLAYBOOK_STEP,
    });
    conversationId = conv.id;
  }

  const firstStep = definition[0]!;
  const run = await runQueries.createPlaybookRun(db, {
    workspaceId: opts.workspaceId,
    playbookId: pb.id,
    playbookVersion: pb.version,
    agentId: opts.agentId,
    runtimeId: agent.runtimeId,
    conversationId,
    snapshot: definition,
    input: opts.input ?? null,
    startedByUserId: opts.startedByUserId,
    firstStepId: firstStep.id,
  });
  await runQueries.ensureStepRun(db, {
    runId: run.id,
    workspaceId: opts.workspaceId,
    stepId: firstStep.id,
    stepKind: firstStep.kind,
  });

  await recordActivity(db, {
    workspaceId: opts.workspaceId,
    kind: "playbook_run_started",
    summary: `Playbook run started: ${pb.title}`,
    subjectId: run.id,
    dedupeKey: `playbook-run-started:${run.id}`,
    payload: { playbook_id: pb.id, agent_id: opts.agentId },
  });

  const taskService = new TaskService(db, opts.emailDomain);
  try {
    await dispatchStep(db, taskService, { ...run, conversationId }, firstStep);
  } catch (err) {
    const message = err instanceof Error ? err.message : "dispatch failed";
    await failRunAtStep(db, opts.workspaceId, run.id, firstStep.id, message);
    throw new PlaybookEngineError(`failed to dispatch first step: ${message}`);
  }

  return runQueries.getPlaybookRun(db, run.id, opts.workspaceId);
}

/**
 * Idempotent state-machine advance. Safe under duplicate delivery: only acts
 * when the current step_run is resolved and the run is non-terminal.
 */
export async function advancePlaybookRun(
  db: Database,
  workspaceId: string,
  runId: string,
  opts?: { emailDomain?: string },
) {
  const run = await runQueries.getPlaybookRun(db, runId, workspaceId);
  if (!run || isTerminalPlaybookRunStatus(run.status)) return run;
  if (!run.currentStepId) return run;

  const stepRun = await runQueries.getStepRun(db, run.id, run.currentStepId, workspaceId);
  if (!stepRun) return run;

  const resolved =
    stepRun.status === PlaybookStepRunStatus.COMPLETED ||
    stepRun.status === PlaybookStepRunStatus.FAILED;
  if (!resolved) return run;

  if (stepRun.status === PlaybookStepRunStatus.FAILED) {
    const failed = await runQueries.updatePlaybookRunIfActive(db, run.id, workspaceId, {
      status: PlaybookRunStatus.FAILED,
      finishedAt: new Date().toISOString(),
      error: stepRun.error ?? "step failed",
      currentTaskId: null,
      currentApprovalId: null,
    });
    if (!failed) return runQueries.getPlaybookRun(db, run.id, workspaceId);
    await recordActivity(db, {
      workspaceId,
      kind: "playbook_run_failed",
      summary: `Playbook run failed at step ${run.currentStepId}`,
      subjectId: run.id,
      dedupeKey: `playbook-run-failed:${run.id}`,
      payload: { step_id: run.currentStepId, error: stepRun.error ?? null },
    });
    return failed;
  }

  const snapshot = run.snapshot as PlaybookStepDef[];
  const outputs = stepOutputMap(run);
  if (stepRun.output != null) outputs[run.currentStepId] = stepRun.output;

  const next = nextStepAfter(snapshot, run.currentStepId);
  if (!next) {
    const completed = await runQueries.updatePlaybookRunIfActive(db, run.id, workspaceId, {
      status: PlaybookRunStatus.COMPLETED,
      output: outputs,
      finishedAt: new Date().toISOString(),
      currentStepId: null,
      currentTaskId: null,
      currentApprovalId: null,
    });
    if (!completed) return runQueries.getPlaybookRun(db, run.id, workspaceId);
    await recordActivity(db, {
      workspaceId,
      kind: "playbook_run_completed",
      summary: "Playbook run completed",
      subjectId: run.id,
      dedupeKey: `playbook-run-completed:${run.id}`,
      payload: { playbook_id: run.playbookId },
    });
    return completed;
  }

  // CAS: only move forward if the run is still active. A concurrent cancel
  // wins and this returns null, so no task/approval is dispatched on a
  // terminal run.
  const moved = await runQueries.updatePlaybookRunIfActive(db, run.id, workspaceId, {
    output: outputs,
    currentStepId: next.id,
    currentTaskId: null,
    currentApprovalId: null,
  });
  if (!moved) return runQueries.getPlaybookRun(db, run.id, workspaceId);

  await runQueries.ensureStepRun(db, {
    runId: run.id,
    workspaceId,
    stepId: next.id,
    stepKind: next.kind,
  });

  const taskService = new TaskService(db, opts?.emailDomain);
  try {
    await dispatchStep(db, taskService, moved, next);
  } catch (err) {
    const message = err instanceof Error ? err.message : "dispatch failed";
    log.warn("playbook: dispatch failed, failing run", { runId: run.id, stepId: next.id, err: message });
    await failRunAtStep(db, workspaceId, run.id, next.id, message);
  }
  return runQueries.getPlaybookRun(db, run.id, workspaceId);
}

/** Called from task complete/fail routes for PLAYBOOK_STEP tasks. */
export async function handlePlaybookTaskTerminal(
  db: Database,
  task: {
    id: string;
    workspaceId: string;
    type: string;
    context: unknown;
  },
  outcome: "completed" | "failed",
  opts?: { output?: string | null; error?: string | null; emailDomain?: string },
) {
  if (task.type !== TASK_TYPES.PLAYBOOK_STEP) return;
  const ctx = (task.context ?? {}) as { playbook_run_id?: string; playbook_step_id?: string };
  const runId = ctx.playbook_run_id;
  const stepId = ctx.playbook_step_id;
  if (!runId || !stepId) return;

  const run = await runQueries.getPlaybookRun(db, runId, task.workspaceId);
  if (!run || isTerminalPlaybookRunStatus(run.status)) return;

  const now = new Date().toISOString();
  // Atomic compare-and-swap: only the first delivery resolves the step.
  // Cap stored output so a rogue runtime cannot bloat D1 / run responses.
  const rawOutput = opts?.output ?? "";
  const resolved = await runQueries.resolveStepRunIfStatus(
    db,
    runId,
    stepId,
    task.workspaceId,
    PlaybookStepRunStatus.RUNNING,
    {
      status: outcome === "completed" ? PlaybookStepRunStatus.COMPLETED : PlaybookStepRunStatus.FAILED,
      output: outcome === "completed" ? rawOutput.slice(0, 100_000) : null,
      error: outcome === "failed" ? (opts?.error ?? "task failed").slice(0, 500) : null,
      finishedAt: now,
    },
  );
  if (!resolved) return;

  await advancePlaybookRun(db, task.workspaceId, runId, { emailDomain: opts?.emailDomain });
}

/** Called from the approval decision route for PLAYBOOK_STEP_GATE approvals. */
export async function handlePlaybookApprovalDecided(
  db: Database,
  approval: {
    id: string;
    workspaceId: string;
    kind: string;
    payload: unknown;
    status: string;
  },
  opts?: { emailDomain?: string },
) {
  if (approval.kind !== ApprovalKind.PLAYBOOK_STEP_GATE) return;
  const payload = (approval.payload ?? {}) as { runId?: string; stepId?: string };
  const runId = payload.runId;
  const stepId = payload.stepId;
  if (!runId || !stepId) return;

  const run = await runQueries.getPlaybookRun(db, runId, approval.workspaceId);
  if (!run || isTerminalPlaybookRunStatus(run.status)) return;

  const approved = approval.status === "approved";
  const now = new Date().toISOString();
  // Atomic compare-and-swap: a duplicate decide callback (or an orphan
  // approval from a raced dispatch) cannot resolve the step twice.
  const resolved = await runQueries.resolveStepRunIfStatus(
    db,
    runId,
    stepId,
    approval.workspaceId,
    PlaybookStepRunStatus.AWAITING_APPROVAL,
    {
      status: approved ? PlaybookStepRunStatus.COMPLETED : PlaybookStepRunStatus.FAILED,
      output: approved ? "approved" : null,
      error: approved ? null : "approval rejected",
      finishedAt: now,
    },
  );
  if (!resolved) return;
  await runQueries.updatePlaybookRunIfActive(db, runId, approval.workspaceId, {
    currentApprovalId: null,
  });

  await advancePlaybookRun(db, approval.workspaceId, runId, { emailDomain: opts?.emailDomain });
}

export async function answerPlaybookHumanInput(
  db: Database,
  workspaceId: string,
  runId: string,
  answer: string,
  opts?: { emailDomain?: string },
) {
  const run = await runQueries.getPlaybookRun(db, runId, workspaceId);
  if (!run) throw new PlaybookEngineError("run not found", "NOT_FOUND");
  if (run.status !== PlaybookRunStatus.AWAITING_INPUT) {
    throw new PlaybookEngineError("run is not awaiting input");
  }
  const stepId = run.currentStepId;
  if (!stepId) throw new PlaybookEngineError("run has no current step");

  // Atomic compare-and-swap: concurrent answers cannot double-resolve.
  const resolved = await runQueries.resolveStepRunIfStatus(
    db,
    runId,
    stepId,
    workspaceId,
    PlaybookStepRunStatus.AWAITING_INPUT,
    {
      status: PlaybookStepRunStatus.COMPLETED,
      output: answer,
      finishedAt: new Date().toISOString(),
    },
  );
  if (!resolved) throw new PlaybookEngineError("run is not awaiting input");
  return advancePlaybookRun(db, workspaceId, runId, { emailDomain: opts?.emailDomain });
}

export async function cancelPlaybookRun(db: Database, workspaceId: string, runId: string) {
  const run = await runQueries.getPlaybookRun(db, runId, workspaceId);
  if (!run) throw new PlaybookEngineError("run not found", "NOT_FOUND");
  if (isTerminalPlaybookRunStatus(run.status)) return run;

  if (run.currentTaskId) {
    await queries.task.supersedeTask(db, run.currentTaskId, workspaceId).catch((err) => {
      log.warn("playbook: supersede on cancel failed", { runId, err: String(err) });
    });
  }
  if (run.currentStepId) {
    await runQueries.updateStepRun(db, runId, run.currentStepId, workspaceId, {
      status: PlaybookStepRunStatus.SKIPPED,
      finishedAt: new Date().toISOString(),
    }).catch(() => {});
  }

  const cancelled = await runQueries.updatePlaybookRun(db, runId, workspaceId, {
    status: PlaybookRunStatus.CANCELLED,
    finishedAt: new Date().toISOString(),
    currentTaskId: null,
    currentApprovalId: null,
  });
  await recordActivity(db, {
    workspaceId,
    kind: "playbook_run_cancelled",
    summary: "Playbook run cancelled",
    subjectId: runId,
    dedupeKey: `playbook-run-cancelled:${runId}`,
    payload: { playbook_id: run.playbookId },
  });
  return cancelled;
}
