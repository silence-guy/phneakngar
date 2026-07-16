import type { Database } from "@phneakngar/shared";
import {
  AutomationDeliveryMode,
  buildHeartbeatPrompt,
  isHeartbeatAutomation,
  queries,
  TASK_TYPES,
  computeNextScheduledAt,
} from "@phneakngar/shared";
import { nanoid } from "nanoid";
import { log } from "@/lib/logger";
import { TaskService } from "@/lib/services/task";
import {
  buildMorningBriefPrompt,
  buildMorningBriefTaskContext,
  isMorningBriefAutomation,
  loadDayCalendarEvents,
  resolveDeliveryChannel,
  utcDayWindow,
  type BriefCalendarEvent,
  type DayWindow,
} from "@/lib/services/morning-brief";
import {
  buildScenarioAutomationContext,
  type ScenarioRuntimeId,
} from "@/lib/services/scenario-runtime";

const INTERVAL_RE = /^(\d+)(min|hour|day|week|month)$/;
const SPACED_INTERVAL_RE = /^(\d+)\s*(min|hour|day|week|month)s?$/i;
const SIMPLE_CRON_RE = /^(\d{1,2})\s+(\d{1,2})\s+\*\s+\*\s+\*$/;

const ALIASES: Record<string, string> = {
  daily: "1day",
  hourly: "1hour",
  weekly: "1week",
  monthly: "1month",
};

/**
 * Advance an automation schedule past `nowIso` from `fromIso`.
 * Supports aliases (daily/hourly/weekly/monthly), calendar intervals
 * (`1day`, `2hour`, …), and simple daily UTC cron (`M H * * *`).
 * Falls back to +24h so the due loop stays live without cron deps.
 */
export function computeNextAutomationRunAt(
  schedule: string,
  fromIso: string,
  nowIso: string = new Date().toISOString(),
): string {
  const raw = schedule.trim();
  let interval = ALIASES[raw.toLowerCase()] ?? raw;

  const spaced = SPACED_INTERVAL_RE.exec(interval);
  if (spaced) {
    interval = `${spaced[1]}${spaced[2]!.toLowerCase()}`;
  }

  if (INTERVAL_RE.test(interval)) {
    try {
      const next = computeNextScheduledAt(fromIso, interval, null, nowIso, []);
      if (next) return next;
    } catch {
      // fall through
    }
  }

  const cron = SIMPLE_CRON_RE.exec(raw);
  if (cron) {
    const minute = Number(cron[1]);
    const hour = Number(cron[2]);
    if (minute >= 0 && minute <= 59 && hour >= 0 && hour <= 23) {
      const now = new Date(nowIso);
      let next = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          hour,
          minute,
          0,
          0,
        ),
      );
      if (next.getTime() <= now.getTime()) {
        next = new Date(next.getTime() + 86_400_000);
      }
      return next.toISOString();
    }
  }

  const baseMs = Math.max(new Date(fromIso).getTime(), new Date(nowIso).getTime());
  return new Date(baseMs + 86_400_000).toISOString();
}

function buildAutomationPrompt(auto: {
  title: string;
  sopMarkdown: string;
  skillName: string | null;
}): string {
  // Heartbeat ambient checks use quiet-by-default prompt contract (OpenClaw-class).
  // Full commercial Helio/OpenClaw parity is still not claimed.
  if (isHeartbeatAutomation({ skillName: auto.skillName, title: auto.title })) {
    return buildHeartbeatPrompt(auto.sopMarkdown);
  }
  const parts = [auto.title.trim()];
  const sop = (auto.sopMarkdown ?? "").trim();
  if (sop) parts.push(sop);
  if (auto.skillName) parts.push(`Skill: ${auto.skillName}`);
  return parts.join("\n\n");
}

/**
 * Load calendar / board / inbox + delivery surface for a due automation.
 * Morning-brief / Day Planner automations always get the UTC day calendar.
 * Task Digest / Inbox AI attach workspace-scoped snapshots (SC scenario glue).
 * Other automations still resolve delivery channel when configured.
 */
export async function buildAutomationDeliveryContext(
  db: Database,
  workspaceId: string,
  auto: {
    id: string;
    agentId: string;
    title: string;
    sopMarkdown: string;
    skillName: string | null;
    schedule: string;
    nextRunAt: string;
    deliveryMode: string;
    deliveryChannelId: string | null;
  },
  nowIso: string,
  opts?: { ownerUserId?: string | null },
): Promise<{
  prompt: string;
  context: Record<string, unknown>;
  deliveryChannelName: string | null;
  isMorningBrief: boolean;
  scenarioId: ScenarioRuntimeId | null;
  day: DayWindow | null;
  calendarEvents: BriefCalendarEvent[];
}> {
  const isMorningBrief = isMorningBriefAutomation(auto);
  const deliveryChannel = await resolveDeliveryChannel(
    db,
    workspaceId,
    auto.deliveryChannelId,
  );
  const deliveryChannelName = deliveryChannel?.name ?? null;

  let day: DayWindow | null = null;
  let calendarEvents: BriefCalendarEvent[] = [];
  if (isMorningBrief) {
    // Always pin the UTC day window so a calendar DB failure still yields a
    // morning-brief task context (empty calendar, still deliverable).
    try {
      day = utcDayWindow(nowIso);
    } catch (err) {
      log.warn("automation: morning-brief day window invalid", {
        id: auto.id,
        err: String(err),
      });
    }
    try {
      const loaded = await loadDayCalendarEvents(db, workspaceId, {
        // Workspace-wide day picture for the brief (not only this agent).
        nowIso,
      });
      day = loaded.day;
      calendarEvents = loaded.events;
    } catch (err) {
      log.warn("automation: morning-brief calendar load failed", {
        id: auto.id,
        err: String(err),
      });
    }
  }

  const basePrompt = buildAutomationPrompt(auto);

  if (isMorningBrief && day) {
    const context = buildMorningBriefTaskContext({
      automationId: auto.id,
      schedule: auto.schedule,
      deliveryMode: auto.deliveryMode,
      deliveryChannelId: auto.deliveryChannelId ?? null,
      deliveryChannelName,
      skillName: auto.skillName ?? null,
      observedNextRunAt: auto.nextRunAt,
      day,
      calendarEvents,
    });
    const prompt = buildMorningBriefPrompt(basePrompt, {
      calendarSummary: context.calendar_summary as string,
      deliveryMode: auto.deliveryMode,
      deliveryChannelName,
      dayDate: day.date,
    });
    return {
      prompt,
      context,
      deliveryChannelName,
      isMorningBrief,
      scenarioId: "day-planner",
      day,
      calendarEvents,
    };
  }

  // Task Digest / Inbox AI scenario snapshots (thin SC glue).
  const scenarioCtx = await buildScenarioAutomationContext(
    db,
    workspaceId,
    auto,
    {
      nowIso,
      deliveryChannelName,
      ownerUserId: opts?.ownerUserId ?? null,
    },
  );
  if (scenarioCtx) {
    return {
      prompt: scenarioCtx.prompt,
      context: scenarioCtx.context,
      deliveryChannelName,
      isMorningBrief: false,
      scenarioId: scenarioCtx.scenarioId,
      day,
      calendarEvents,
    };
  }

  const context: Record<string, unknown> = {
    automation_id: auto.id,
    schedule: auto.schedule,
    delivery_mode: auto.deliveryMode,
    delivery_channel_id: auto.deliveryChannelId ?? null,
    delivery_channel_name: deliveryChannelName,
    skill_name: auto.skillName ?? null,
    observed_next_run_at: auto.nextRunAt,
  };
  if (auto.deliveryMode === AutomationDeliveryMode.CHANNEL) {
    // C3/C6: opt into channel post on task complete (same flag as parent acceptance).
    context.deliver_to_channel = true;
  }
  if (
    auto.deliveryMode === AutomationDeliveryMode.CHANNEL &&
    deliveryChannelName
  ) {
    context.delivery_hint = `Post results to channel "${deliveryChannelName}".`;
  }

  const prompt = buildMorningBriefPrompt(basePrompt, {
    deliveryMode: auto.deliveryMode,
    deliveryChannelName,
  });

  return {
    prompt,
    context,
    deliveryChannelName,
    isMorningBrief,
    scenarioId: null,
    day,
    calendarEvents,
  };
}

/**
 * Promote due automations in the given workspace into queued tasks.
 *
 * Concurrency uses `claimAutomationRun` (exact nextRunAt + enabled guard).
 * Task ids are pre-allocated so the claim can record lastTaskId atomically;
 * the task is then created with that id via TaskService idempotency.
 *
 * Morning-brief automations attach workspace day calendar context and resolve
 * the delivery channel name into the task context bag for channel delivery.
 *
 * Returns the number of automations enqueued as tasks.
 */
export async function promoteDueAutomationsForWorkspace(
  db: Database,
  workspaceId: string,
  opts?: { nowIso?: string; emailDomain?: string },
): Promise<number> {
  const nowIso = opts?.nowIso ?? new Date().toISOString();
  const candidates = await queries.automation.listDueAutomations(db, workspaceId, nowIso);
  const taskService = new TaskService(db, opts?.emailDomain);
  let enqueued = 0;

  for (const auto of candidates) {
    const agent = await queries.agent.getAgent(db, auto.agentId, auto.workspaceId);
    if (!agent) {
      log.warn("automation: agent missing, skipping", { id: auto.id });
      continue;
    }
    if (!agent.runtimeId) {
      log.warn("automation: agent has no runtime, skipping", { id: auto.id });
      continue;
    }
    if (!agent.ownerId) {
      log.warn("automation: agent has no owner, skipping", { id: auto.id });
      continue;
    }

    const nextRunAt = computeNextAutomationRunAt(auto.schedule, auto.nextRunAt, nowIso);
    const taskId = nanoid();
    const previous = {
      nextRunAt: auto.nextRunAt,
      lastRunAt: auto.lastRunAt ?? null,
      lastTaskId: auto.lastTaskId ?? null,
    };

    const claimed = await queries.automation.claimAutomationRun(
      db,
      auto.id,
      workspaceId,
      auto.nextRunAt,
      nextRunAt,
      taskId,
    );
    if (!claimed) continue;

    try {
      const delivery = await buildAutomationDeliveryContext(
        db,
        workspaceId,
        {
          id: auto.id,
          agentId: auto.agentId,
          title: auto.title,
          sopMarkdown: auto.sopMarkdown ?? "",
          skillName: auto.skillName ?? null,
          schedule: auto.schedule,
          nextRunAt: auto.nextRunAt,
          deliveryMode: auto.deliveryMode,
          deliveryChannelId: auto.deliveryChannelId ?? null,
        },
        nowIso,
        { ownerUserId: agent.ownerId },
      );

      const conv = await queries.conversation.createConversation(db, {
        workspaceId,
        agentId: auto.agentId,
        userId: agent.ownerId,
        title: `[Automation] ${auto.title}`.slice(0, 120),
        type: TASK_TYPES.AUTOMATION_EVENT,
        // Surface channel name on the conversation when channel delivery is configured.
        channel:
          auto.deliveryMode === AutomationDeliveryMode.CHANNEL &&
          delivery.deliveryChannelName
            ? delivery.deliveryChannelName
            : undefined,
      });

      await queries.message.createMessage(db, {
        conversationId: conv.id,
        role: "event",
        content: `Automation: ${auto.title}`,
        metadata: JSON.stringify({
          automationId: auto.id,
          title: auto.title,
          event: "automation_due" as const,
          agentId: auto.agentId,
          morningBrief: delivery.isMorningBrief,
          scenarioId: delivery.scenarioId,
          deliveryMode: auto.deliveryMode,
          deliveryChannelId: auto.deliveryChannelId ?? null,
          deliveryChannelName: delivery.deliveryChannelName,
        }),
      });

      await taskService.enqueueTask(
        auto.agentId,
        conv.id,
        workspaceId,
        delivery.prompt,
        TASK_TYPES.AUTOMATION_EVENT,
        {
          contextKey: conv.id,
          context: delivery.context,
          traceId: "tr_" + nanoid(),
          parentTaskId: null,
          idempotencyId: taskId,
        },
      );

      enqueued++;
    } catch (err) {
      log.warn("automation: post-claim dispatch failed, reverting", {
        id: auto.id,
        err: String(err),
      });
      // Compensating revert — schedule becomes due again on the next poll.
      try {
        await queries.automation.revertAutomationRunClaim(
          db,
          auto.id,
          workspaceId,
          nextRunAt,
          previous,
        );
      } catch (revertErr) {
        log.error("automation: compensating revert failed", {
          id: auto.id,
          err: String(revertErr),
        });
      }
    }
  }

  if (enqueued > 0) {
    log.info("automation: promoted due automations", { workspaceId, enqueued });
  }
  return enqueued;
}
