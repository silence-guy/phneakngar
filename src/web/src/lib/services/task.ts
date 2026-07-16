import type { Database } from "@phneakngar/shared";
import {
  queries,
  TASK_TYPES,
  MAX_TASKS_PER_TRACE,
  MAX_POLL_TASKS,
  isTerminalTaskStatus,
  DEFAULT_AGENT_MEMORY_PROMPT_LIMIT,
  formatMemoryForPrompt,
  toMemoryPromptItems,
} from "@phneakngar/shared";
import { log } from "@/lib/logger";
import { broadcastToUser, broadcastToChhlat } from "@/lib/broadcast";
import { messageToResponse } from "@/lib/api/responses";
import { invalidate, cacheKeys } from "@/lib/cache";
import { TaskPayloadBuilder } from "@/lib/services/task-payload-builder";
import {
  deliverTaskResultToChannel,
  type DeliverTaskToChannelResult,
} from "@/lib/services/channel-delivery";

const taskQueries = queries.task;
const agentQueries = queries.agent;
const messageQueries = queries.message;
const conversationQueries = queries.conversation;
const issueQueries = queries.issue;
const inboxQueries = queries.inbox;
const agentMemoryQueries = queries.agentMemory;

/** Task types that receive top-N agent memory snippets in the durable context bag. */
const MEMORY_INJECT_TASK_TYPES = new Set<string>([
  TASK_TYPES.ISSUE_EVENT,
  TASK_TYPES.AUTOMATION_EVENT,
]);

export const TASK_ALREADY_TERMINAL_CODE = "TASK_ALREADY_TERMINAL";

export class TaskAlreadyTerminalError extends Error {
  readonly code = TASK_ALREADY_TERMINAL_CODE;

  constructor(public readonly taskStatus: string) {
    super("task is already in a terminal state");
    this.name = "TaskAlreadyTerminalError";
  }
}

export class TaskService {
  constructor(private db: Database, private emailDomain?: string) {}

  /**
   * Attach top-N agent (+ workspace-wide) memory notes into the task context bag
   * for issue/automation events so chhlat can surface them in the agent prompt.
   * Best-effort: failures leave context unchanged so enqueue still succeeds.
   * Callers that already set `memories` / `memory_prompt` are left as-is.
   */
  private async withAgentMemoryContext(
    agentId: string,
    workspaceId: string,
    type: string,
    context?: Record<string, unknown>,
  ): Promise<Record<string, unknown> | undefined> {
    if (!MEMORY_INJECT_TASK_TYPES.has(type)) return context;
    if (context?.memories != null || context?.memory_prompt != null) return context;

    try {
      const rows = await agentMemoryQueries.listMemoryForAgent(
        this.db,
        workspaceId,
        agentId,
        DEFAULT_AGENT_MEMORY_PROMPT_LIMIT,
      );
      const memories = toMemoryPromptItems(rows, DEFAULT_AGENT_MEMORY_PROMPT_LIMIT);
      if (memories.length === 0) return context;

      const memory_prompt = formatMemoryForPrompt(memories);
      return {
        ...(context ?? {}),
        memories,
        memory_prompt,
      };
    } catch (err) {
      log.warn("enqueueTask: memory inject failed", {
        agentId,
        workspaceId,
        type,
        err: String(err),
      });
      return context;
    }
  }

  async enqueueTask(
    agentId: string,
    conversationId: string,
    workspaceId: string,
    prompt: string,
    type: string = TASK_TYPES.USER_DM_MESSAGE,
    opts?: {
      contextKey?: string | null;
      context?: Record<string, unknown>;
      traceId?: string | null;
      parentTaskId?: string | null;
      localeOverride?: string | null;
      retryOfTaskId?: string | null;
      idempotencyId?: string;
    },
  ) {
    const agent = await agentQueries.getAgent(this.db, agentId, workspaceId);
    if (!agent) {
      throw new Error("agent not found");
    }
    if (!agent.runtimeId) {
      throw new Error("agent has no runtime");
    }

    if (opts?.traceId && opts.parentTaskId) {
      const traceCount = await taskQueries.countTasksByTrace(this.db, opts.traceId, workspaceId);
      if (traceCount >= MAX_TASKS_PER_TRACE) {
        throw new Error(`Trace limit reached (${MAX_TASKS_PER_TRACE} tasks). This may indicate an infinite loop between agents.`);
      }
    }

    const context = await this.withAgentMemoryContext(
      agentId,
      workspaceId,
      type,
      opts?.context,
    );

    const taskData = {
      agentId,
      runtimeId: agent.runtimeId,
      workspaceId,
      conversationId,
      prompt,
      type,
      contextKey: opts?.contextKey ?? null,
      priority: 0,
      context,
      traceId: opts?.traceId ?? null,
      parentTaskId: opts?.parentTaskId ?? null,
      localeOverride: opts?.localeOverride ?? null,
      retryOfTaskId: opts?.retryOfTaskId ?? null,
    };
    const task = opts?.idempotencyId
      ? (await taskQueries.createTaskIfAbsent(this.db, {
          id: opts.idempotencyId,
          ...taskData,
        })).task
      : await taskQueries.createTask(this.db, taskData);
    invalidate(cacheKeys.activeTaskCounts(workspaceId)).catch(() => {});
    // Push task to chhlat via WS (best-effort). Awaited to ensure task state
    // settles (dispatched on success, reverted to queued on failure) before
    // the HTTP response returns, preventing races with subsequent poll calls.
    await this.pushTaskToChhlat(task, workspaceId).catch(() => {});
    return task;
  }

  async claimTask(agentId: string, workspaceId: string) {
    const agent = await agentQueries.getAgent(this.db, agentId, workspaceId);
    return this.claimTaskWithAgent(agentId, workspaceId, agent);
  }

  private async claimTaskWithAgent(agentId: string, workspaceId: string, agent: Awaited<ReturnType<typeof agentQueries.getAgent>>) {
    if (!agent) {
      return null;
    }

    const running = await taskQueries.countRunningTasks(this.db, agentId, workspaceId);
    if (running >= agent.maxConcurrentTasks) {
      const steerable = await taskQueries.findSteerableReplacement(this.db, agentId, workspaceId);
      if (!steerable) return null;
      const runningExcluding = await taskQueries.countRunningTasks(this.db, agentId, workspaceId, steerable.predecessorId);
      if (runningExcluding >= agent.maxConcurrentTasks) return null;
    }

    const task = await taskQueries.claimTask(this.db, agentId, workspaceId);
    if (!task) {
      return null;
    }

    await agentQueries.updateAgentStatus(this.db, agentId, workspaceId, "working");
    return task;
  }

  async claimTasksForRuntimes(runtimeIds: string[], maxTasks: number, workspaceId: string) {
    const boundedMaxTasks = Math.max(1, Math.min(maxTasks, MAX_POLL_TASKS));
    const killTasks = await taskQueries.claimKillTasks(this.db, runtimeIds, workspaceId, boundedMaxTasks);
    const remaining = boundedMaxTasks - killTasks.length;

    const tasks = remaining > 0
      ? await taskQueries.listPendingTasksByRuntimes(this.db, runtimeIds, workspaceId, remaining)
      : [];
    const runtimeIdSet = new Set(runtimeIds);
    const triedAgents = new Set<string>();
    const claimed: NonNullable<Awaited<ReturnType<typeof this.claimTask>>>[] = [...killTasks];

    const uniqueCandidates: { agentId: string; workspaceId: string }[] = [];
    for (const candidate of tasks) {
      if (uniqueCandidates.length >= remaining) break;
      const key = `${candidate.agentId}:${candidate.workspaceId}`;
      if (triedAgents.has(key)) continue;
      triedAgents.add(key);
      uniqueCandidates.push(candidate);
    }

    if (uniqueCandidates.length === 0) return claimed;

    const agentIds = [...new Set(uniqueCandidates.map((c) => c.agentId))];
    const agents = await agentQueries.getAgentsByIds(this.db, agentIds, workspaceId);
    const agentMap = new Map(agents.map((a) => [a.id, a]));

    const results = await Promise.all(
      uniqueCandidates.map((c) => this.claimTaskWithAgent(c.agentId, c.workspaceId, agentMap.get(c.agentId) ?? null))
    );

    for (const task of results) {
      if (task && runtimeIdSet.has(task.runtimeId)) {
        claimed.push(task);
      }
    }

    return claimed;
  }

  async startTask(taskId: string, workspaceId: string) {
    const task = await taskQueries.startTask(this.db, taskId, workspaceId);
    if (!task) {
      throw new Error("task not in dispatched status");
    }
    return task;
  }

  /**
   * Settle a running task and optionally post channel delivery (C3).
   * Returns the completed task plus channel-delivery result so callers (C9)
   * can attach artifacts to the channel conversation when delivery landed there.
   */
  async completeTask(
    taskId: string,
    workspaceId: string,
    result: string,
    sessionId: string
  ): Promise<{
    task: NonNullable<Awaited<ReturnType<typeof taskQueries.completeTask>>>;
    channelDelivery: DeliverTaskToChannelResult | null;
  }> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(result);
    } catch {
      parsed = { raw: result };
    }

    const task = await taskQueries.completeTask(this.db, taskId, workspaceId, {
      result: parsed,
      sessionId: sessionId || null,
    });

    if (!task) {
      const existing = await taskQueries.getTask(this.db, taskId, workspaceId);
      const status = existing?.status ?? "unknown";
      log.warn(`completeTask failed: task is in '${status}' status`, { taskId });
      if (isTerminalTaskStatus(status)) throw new TaskAlreadyTerminalError(status);
      throw new Error(`cannot complete task in '${status}' status`);
    }

    // The agent owns its voice: the success reply bubble is now authored
    // explicitly via `phneakngar sync send-dm` (the agent-DM endpoint), NOT extracted
    // from the task's final `output` for ordinary DMs. completeTask only settles
    // the task lifecycle for those paths. `output` is still persisted on the task
    // row (in `result`) for debugging. (failTask still surfaces an error bubble —
    // a failed run must not go silent.)
    //
    // Exception (C3): when task context requests channel delivery
    // (`deliver_to_channel` or `delivery_mode: "channel"`), post a channel-visible
    // assistant message from the result so automations/digests land on the timeline.
    // Delivery may land on a different conversation (channel thread) than the task's
    // source conversation — do not reuse the delivery message id for source unread.
    let channelDelivery: DeliverTaskToChannelResult | null = null;
    try {
      channelDelivery = await deliverTaskResultToChannel(this.db, {
        id: task.id,
        agentId: task.agentId,
        workspaceId: task.workspaceId,
        conversationId: task.conversationId,
        context: task.context,
        result: parsed,
      }, { result: parsed });
    } catch (err) {
      log.warn("completeTask: channel delivery failed", { taskId, err });
    }

    let taskWithOutcome = task;
    try {
      const visibleOutcomeStatus = await taskQueries.detectTaskVisibleOutcome(this.db, taskId, workspaceId);
      taskWithOutcome = await taskQueries.updateTaskVisibleOutcomeStatus(
        this.db,
        taskId,
        workspaceId,
        visibleOutcomeStatus,
      ) ?? task;
    } catch (err) {
      log.warn("completeTask: failed to classify visible outcome", { taskId, err });
    }

    await this.reconcileAgentStatus(taskWithOutcome.agentId, taskWithOutcome.workspaceId);
    this.maybeUpsertUnread(taskWithOutcome, workspaceId, null).catch(() => {});
    return { task: taskWithOutcome, channelDelivery };
  }

  async failTask(taskId: string, workspaceId: string, error: string) {
    const task = await taskQueries.failTask(this.db, taskId, workspaceId, error);

    if (!task) {
      const existing = await taskQueries.getTask(this.db, taskId, workspaceId);
      const status = existing?.status ?? "unknown";
      log.warn(`failTask failed: task is in '${status}' status`, { taskId });
      if (isTerminalTaskStatus(status)) throw new TaskAlreadyTerminalError(status);
      throw new Error(`cannot fail task in '${status}' status`);
    }

    if (task.type === TASK_TYPES.KILL_TASK) {
      return task;
    }

    let errorMessageId: string | null = null;
    if (error) {
      // Attribute the error to the agent runtime (Claude Code / Codex /
      // OpenCode) so the chat UI can make clear it did NOT come from ភ្នាក់ងារ.
      // Resolve the provider from the task's runtime; never let this block the
      // task lifecycle (issue #236).
      let provider: string | null = null;
      try {
        if (task.runtimeId) {
          const rt = await queries.runtime.getAgentRuntime(this.db, task.runtimeId);
          provider = rt?.provider ?? null;
        }
      } catch {
        // non-critical: fall back to a generic runtime label
      }

      const msg = await messageQueries.createMessage(this.db, {
        conversationId: task.conversationId,
        role: "assistant",
        content: error,
        taskId,
        metadata: JSON.stringify({ error_source: "runtime", provider }),
      });
      errorMessageId = msg?.id ?? null;

      try {
        const conversation = await conversationQueries.getConversation(this.db, task.conversationId, workspaceId);
        if (conversation) {
          broadcastToUser(conversation.userId, {
            type: "conversation.message",
            conversationId: task.conversationId,
            message: messageToResponse(msg),
          }).catch(() => {});
        }
      } catch {
        // non-critical: don't let broadcast failure block task lifecycle
      }
    }

    await this.reconcileAgentStatus(task.agentId, task.workspaceId);
    await this.syncIssueStatusFromTask(task, "failed");
    this.maybeUpsertUnread(task, workspaceId, errorMessageId).catch(() => {});
    return task;
  }

  private async syncIssueStatusFromTask(
    task: { id: string; type?: string | null; contextKey?: string | null; workspaceId: string; conversationId: string },
    status: "failed",
  ) {
    if (task.type !== TASK_TYPES.ISSUE_EVENT) return;

    const issue = await issueQueries.getIssueByConversation(this.db, task.conversationId, task.workspaceId);
    if (!issue || issue.status === status) return;

    const updated = await issueQueries.updateIssue(this.db, issue.id, task.workspaceId, { status });
    if (!updated) return;

    const eventMsg = await messageQueries.createMessage(this.db, {
      conversationId: task.conversationId,
      role: "event",
      content: `Issue status changed: ${issue.status} -> ${status}`,
      taskId: task.id,
      metadata: JSON.stringify({ issueId: issue.id }),
    });

    try {
      const conversation = await conversationQueries.getConversation(this.db, task.conversationId, task.workspaceId);
      if (conversation) {
        broadcastToUser(conversation.userId, {
          type: "conversation.message",
          conversationId: task.conversationId,
          message: messageToResponse(eventMsg),
        }).catch(() => {});
      }
    } catch {
      // non-critical: don't let broadcast failure block task lifecycle
    }
  }

  private async maybeUpsertUnread(
    task: { id: string; conversationId: string; type: string; parentTaskId?: string | null; traceId?: string | null; prompt: string; status: string; completedAt?: string | null; context?: unknown; workspaceId: string; agentId: string },
    workspaceId: string,
    knownMessageId: string | null,
  ) {
    if (!inboxQueries.isUnreadEligible(task)) return;
    if (!task.completedAt) return;

    const conversation = await conversationQueries.getConversation(this.db, task.conversationId, workspaceId);
    if (!conversation) return;

    const latestMessageId = knownMessageId ?? await inboxQueries.findLatestAssistantMessageId(this.db, task.conversationId);

    await inboxQueries.upsertUnreadEntry(this.db, {
      conversationId: task.conversationId,
      userId: conversation.userId,
      workspaceId,
      agentId: conversation.agentId,
      taskId: task.id,
      taskType: task.type,
      taskStatus: task.status,
      taskPrompt: task.prompt,
      completedAt: task.completedAt,
      latestMessageId,
    });
  }

  async supersedeTask(taskId: string, workspaceId: string) {
    const task = await taskQueries.supersedeTask(this.db, taskId, workspaceId);

    if (!task) {
      const existing = await taskQueries.getTask(this.db, taskId, workspaceId);
      const status = existing?.status ?? "unknown";
      log.warn(`supersedeTask failed: task is in '${status}' status`, { taskId });
      throw new Error(`cannot supersede task in '${status}' status`);
    }

    await this.reconcileAgentStatus(task.agentId, task.workspaceId);
    return task;
  }

  async retryTask(taskId: string, workspaceId: string) {
    const original = await taskQueries.getTask(this.db, taskId, workspaceId);
    if (!original) throw new Error("task not found");
    if (original.status !== "failed") throw new Error("only failed tasks can be retried");

    const marked = await taskQueries.markFailedAsSuperseded(this.db, taskId, workspaceId);
    if (!marked) throw new Error("failed to mark task as superseded");

    const newTask = await this.enqueueTask(
      original.agentId,
      original.conversationId,
      workspaceId,
      original.prompt,
      original.type,
      {
        contextKey: original.contextKey ?? null,
        context: original.context as Record<string, unknown> | undefined,
        traceId: original.traceId ?? null,
        parentTaskId: original.parentTaskId ?? null,
        localeOverride: original.localeOverride ?? null,
        retryOfTaskId: original.id,
      },
    );

    return { oldTask: marked, newTask };
  }

  async cancelActiveTask(conversationId: string, workspaceId: string, opts?: { reason?: string }) {
    const activeTask = await taskQueries.getActiveTaskByConversation(this.db, conversationId, workspaceId);
    if (!activeTask) return null;

    const cancelled = await taskQueries.cancelTask(this.db, activeTask.id, workspaceId);
    if (!cancelled) return null;

    if (activeTask.status === "dispatched" || activeTask.status === "running") {
      const killTask = await taskQueries.createTask(this.db, {
        agentId: activeTask.agentId,
        runtimeId: activeTask.runtimeId,
        workspaceId,
        conversationId,
        prompt: "",
        type: TASK_TYPES.KILL_TASK,
        context: { target_task_id: activeTask.id },
      });

      // Dispatch (claim) the kill task so it arrives at the chhlat in "dispatched" status,
      // allowing the chhlat to call failTask without a status mismatch error.
      await taskQueries.dispatchTaskById(this.db, killTask.id, workspaceId);

      const runtime = await queries.runtime.getAgentRuntime(this.db, activeTask.runtimeId);
      if (runtime) {
        broadcastToChhlat(workspaceId, runtime.chhlatId, {
          type: "chhlat.kill",
          workspaceId,
          agentId: activeTask.agentId,
          taskId: killTask.id,
          targetTaskId: activeTask.id,
        }).catch((e) => log.warn("chhlat.kill broadcast failed, relying on poll fallback", e));
      }
    }

    // Stamp lifecycle messages (cancelled/superseded) so the chat renders them
    // as quiet centered system notes, not agent speech bubbles.
    await messageQueries.createMessage(this.db, {
      conversationId,
      role: "assistant",
      content: opts?.reason ?? "Task cancelled by you",
      taskId: activeTask.id,
      metadata: JSON.stringify({ kind: "lifecycle" }),
    });

    await this.reconcileAgentStatus(activeTask.agentId, workspaceId);
    return cancelled;
  }

  async reconcileAgentStatus(agentId: string, workspaceId: string) {
    const running = await taskQueries.countRunningTasks(this.db, agentId, workspaceId);
    const status = running > 0 ? "working" : "idle";
    await agentQueries.updateAgentStatus(this.db, agentId, workspaceId, status);
    invalidate(cacheKeys.activeTaskCounts(workspaceId)).catch(() => {});
  }

  async cancelTrace(traceId: string, workspaceId: string, opts?: { reason?: string }) {
    const tasks = await taskQueries.getTraceTree(this.db, traceId, workspaceId);
    const activeConvIds = [...new Set(
      tasks
        .filter(t => ["queued", "dispatched", "running"].includes(t.status))
        .map(t => t.conversationId)
    )];
    for (const convId of activeConvIds) {
      try {
        await this.cancelActiveTask(convId, workspaceId, { reason: opts?.reason });
      } catch (err) {
        log.warn("cancelTrace: failed to cancel task", { traceId, convId, err });
      }
    }
  }

  private async pushTaskToChhlat(
    task: Awaited<ReturnType<typeof taskQueries.createTask>>,
    workspaceId: string,
  ) {
    const runtime = await queries.runtime.getAgentRuntime(this.db, task.runtimeId);
    if (!runtime) return;

    const dispatched = await taskQueries.dispatchTaskById(this.db, task.id, workspaceId);
    if (!dispatched) return;

    if (!this.emailDomain) throw new Error("email domain configuration is required for task delivery");
    const builder = new TaskPayloadBuilder(this.db, this.emailDomain);
    const payloads = await builder.buildFullPayloads([dispatched], workspaceId);
    if (payloads.length === 0) {
      await taskQueries.revertDispatchedToQueued(this.db, task.id, workspaceId);
      return;
    }

    try {
      const { sent } = await broadcastToChhlat(workspaceId, runtime.chhlatId, {
        type: "chhlat.tasks",
        tasks: payloads,
      });
      if (sent === 0) {
        await taskQueries.revertDispatchedToQueued(this.db, task.id, workspaceId);
      }
    } catch {
      await taskQueries.revertDispatchedToQueued(this.db, task.id, workspaceId);
    }
  }
}
