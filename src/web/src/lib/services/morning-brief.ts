import type { Database } from "@phneakngar/shared";
import {
  AutomationDeliveryMode,
  MessageRole,
  queries,
} from "@phneakngar/shared";
import { log } from "@/lib/logger";

/** Default UTC morning-brief fire time (08:00). */
export const MORNING_BRIEF_DEFAULT_SCHEDULE = "0 8 * * *";

export const MORNING_BRIEF_DEFAULT_TITLE = "Morning brief";

export const MORNING_BRIEF_DEFAULT_SOP = `Build today's morning brief from calendar and open commitments, then deliver it to the configured channel.

## Structure (scannable, ~60–90 seconds)
1. Headline — shape of the day
2. Top 3 priorities
3. Meetings — time, purpose, prep, risks
4. Commitments & follow-ups
5. Watchouts
6. Suggested focus blocks

## Rules
- Use the provided calendar_events context; never invent meetings.
- Prefer channel delivery when delivery_mode is channel and delivery_channel is set.
- Keep tone warm, sharp, and utilitarian.`;

const MORNING_BRIEF_HINT_RE =
  /morning[\s_-]*brief|day[\s_-]*planner|daily[\s_-]*brief|daily[\s_-]*plan|អ្នករៀបចំថ្ងៃ/i;

export type DayWindow = {
  /** YYYY-MM-DD (UTC) */
  date: string;
  from: string;
  to: string;
};

export type BriefCalendarEvent = {
  id: string;
  title: string;
  scheduled_at: string;
  description?: string | null;
  is_recurring: boolean;
};

export type ResolvedDeliveryChannel = {
  id: string;
  name: string;
};

/**
 * Inclusive UTC day bounds for `nowIso` (used to load calendar context for a brief).
 */
export function utcDayWindow(nowIso: string): DayWindow {
  const d = new Date(nowIso);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`invalid nowIso: ${nowIso}`);
  }
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  const from = new Date(Date.UTC(y, m, day, 0, 0, 0, 0)).toISOString();
  const to = new Date(Date.UTC(y, m, day, 23, 59, 59, 999)).toISOString();
  return { date: from.slice(0, 10), from, to };
}

/**
 * Next UTC wall-clock fire at hour:minute on or after `nowIso`.
 * Used when seeding a morning-brief automation / calendar cue.
 */
export function nextUtcWallClock(
  hour: number,
  minute: number,
  nowIso: string = new Date().toISOString(),
): string {
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

/**
 * Heuristic: automation is a Day Planner / morning-brief style routine.
 */
export function isMorningBriefAutomation(auto: {
  title: string;
  sopMarkdown?: string | null;
  skillName?: string | null;
}): boolean {
  const hay = [auto.title, auto.sopMarkdown ?? "", auto.skillName ?? ""].join("\n");
  return MORNING_BRIEF_HINT_RE.test(hay);
}

/**
 * Normalize DB calendar rows into brief items, expanding recurring rows that
 * already expose a concrete `scheduledAt` inside the day window.
 */
export function toBriefCalendarEvents(
  rows: Array<{
    id: string;
    title: string;
    scheduledAt: string;
    description?: string | null;
    repeatInterval?: string | null;
  }>,
): BriefCalendarEvent[] {
  return rows
    .map((r) => ({
      id: r.id,
      title: (r.title ?? "").trim() || "(untitled)",
      scheduled_at: r.scheduledAt,
      description: r.description ?? null,
      is_recurring: !!r.repeatInterval,
    }))
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
}

/**
 * Scannable calendar block for the automation prompt + structured items for context.
 */
export function formatCalendarEventsForBrief(events: BriefCalendarEvent[]): {
  summary: string;
  items: BriefCalendarEvent[];
} {
  if (events.length === 0) {
    return {
      summary: "No calendar events scheduled for this day (workspace-scoped).",
      items: [],
    };
  }
  const lines = events.map((e) => {
    const time = e.scheduled_at.slice(11, 16); // HH:MM UTC
    const desc = e.description?.trim() ? ` — ${e.description.trim().slice(0, 120)}` : "";
    const rec = e.is_recurring ? " (recurring)" : "";
    return `- ${time} UTC · ${e.title}${rec}${desc}`;
  });
  return {
    summary: [`Calendar for the day (${events.length}):`, ...lines].join("\n"),
    items: events,
  };
}

export function buildMorningBriefPrompt(
  basePrompt: string,
  opts: {
    calendarSummary?: string | null;
    deliveryMode?: string | null;
    deliveryChannelName?: string | null;
    dayDate?: string | null;
  },
): string {
  const parts = [basePrompt.trim()].filter(Boolean);
  if (opts.dayDate) {
    parts.push(`Date (UTC): ${opts.dayDate}`);
  }
  if (opts.calendarSummary?.trim()) {
    parts.push(opts.calendarSummary.trim());
  }
  const mode = (opts.deliveryMode ?? "").trim();
  const channel = (opts.deliveryChannelName ?? "").trim();
  if (mode === AutomationDeliveryMode.CHANNEL && channel) {
    parts.push(
      `Delivery: post the finished brief to channel "${channel}" (delivery_mode=channel).`,
    );
  } else if (mode === AutomationDeliveryMode.DM) {
    parts.push("Delivery: send the finished brief as a direct message to the owner.");
  } else if (mode) {
    parts.push(`Delivery mode: ${mode}${channel ? ` (channel: ${channel})` : ""}.`);
  }
  return parts.join("\n\n");
}

/**
 * Task context bag for a morning-brief automation run (stateless; all data from D1).
 */
export function buildMorningBriefTaskContext(input: {
  automationId: string;
  schedule: string;
  deliveryMode: string;
  deliveryChannelId: string | null;
  deliveryChannelName: string | null;
  skillName: string | null;
  observedNextRunAt: string;
  day: DayWindow;
  calendarEvents: BriefCalendarEvent[];
}): Record<string, unknown> {
  const formatted = formatCalendarEventsForBrief(input.calendarEvents);
  // C3: channel deliveryMode must set deliver_to_channel so completeTask posts.
  const channelDelivery = input.deliveryMode === AutomationDeliveryMode.CHANNEL;
  return {
    automation_id: input.automationId,
    schedule: input.schedule,
    delivery_mode: input.deliveryMode,
    delivery_channel_id: input.deliveryChannelId,
    delivery_channel_name: input.deliveryChannelName,
    ...(channelDelivery ? { deliver_to_channel: true as const } : {}),
    skill_name: input.skillName,
    observed_next_run_at: input.observedNextRunAt,
    scenario: "day-planner",
    morning_brief: true,
    day_window: {
      date: input.day.date,
      from: input.day.from,
      to: input.day.to,
    },
    calendar_events: formatted.items,
    calendar_summary: formatted.summary,
  };
}

/** Load workspace-scoped calendar rows for the UTC day containing `nowIso`. */
export async function loadDayCalendarEvents(
  db: Database,
  workspaceId: string,
  opts?: { agentId?: string; nowIso?: string },
): Promise<{ day: DayWindow; events: BriefCalendarEvent[] }> {
  const nowIso = opts?.nowIso ?? new Date().toISOString();
  const day = utcDayWindow(nowIso);
  const rows = await queries.calendarEvent.listCalendarEvents(db, workspaceId, {
    agentId: opts?.agentId,
    from: day.from,
    to: day.to,
  });
  return { day, events: toBriefCalendarEvents(rows) };
}

/** Resolve delivery channel by id with workspace scope first. */
export async function resolveDeliveryChannel(
  db: Database,
  workspaceId: string,
  deliveryChannelId: string | null | undefined,
): Promise<ResolvedDeliveryChannel | null> {
  if (!deliveryChannelId) return null;
  const channel = await queries.channel.getChannelById(
    db,
    deliveryChannelId,
    workspaceId,
  );
  if (!channel) return null;
  return { id: channel.id, name: channel.name };
}

export type DeliverMorningBriefInput = {
  workspaceId: string;
  agentId: string;
  ownerUserId: string;
  /** Channel table id (preferred) or omit when channelName is provided. */
  deliveryChannelId?: string | null;
  /** Channel name; used when id is absent or as fallback after resolve. */
  channelName?: string | null;
  content: string;
  taskId?: string | null;
  automationId?: string | null;
  /** UTC day key for idempotent re-delivery (YYYY-MM-DD). Defaults to today UTC. */
  dayDate?: string | null;
};

export type DeliverMorningBriefResult = {
  messageId: string;
  conversationId: string;
  channelName: string;
  created: boolean;
};

/**
 * Post a finished morning brief into the agent's conversation on the target channel.
 * Workspace-scoped channel resolve first. Idempotent per (automationId|agentId)+dayDate
 * when those keys are present (deterministic message id + createMessageIfAbsent).
 */
export async function deliverMorningBriefToChannel(
  db: Database,
  input: DeliverMorningBriefInput,
): Promise<DeliverMorningBriefResult | null> {
  const content = input.content.trim();
  if (!content) return null;

  let channelName = (input.channelName ?? "").trim() || null;
  if (input.deliveryChannelId) {
    const resolved = await resolveDeliveryChannel(
      db,
      input.workspaceId,
      input.deliveryChannelId,
    );
    if (!resolved) {
      log.warn("morning-brief: delivery channel not found", {
        workspaceId: input.workspaceId,
        deliveryChannelId: input.deliveryChannelId,
      });
      return null;
    }
    channelName = resolved.name;
  }
  if (!channelName) {
    log.warn("morning-brief: no channel for delivery", {
      workspaceId: input.workspaceId,
      agentId: input.agentId,
    });
    return null;
  }

  const conv = await queries.conversation.getOrCreateAgentConversation(
    db,
    input.workspaceId,
    input.ownerUserId,
    input.agentId,
    channelName,
  );

  const dayDate =
    input.dayDate?.trim() || new Date().toISOString().slice(0, 10);
  const idempotencySeed =
    input.automationId?.trim() ||
    input.taskId?.trim() ||
    `${input.agentId}:${channelName}`;
  // Deterministic id keeps retries from double-posting the same daily brief.
  // dayDate is placed before the seed so a long seed cannot truncate the day key.
  const messageId = `mb_${dayDate}_${idempotencySeed}`.slice(0, 64);

  const metadata = JSON.stringify({
    kind: "morning_brief",
    scenario: "day-planner",
    automationId: input.automationId ?? null,
    taskId: input.taskId ?? null,
    dayDate,
    channelName,
    deliveryMode: AutomationDeliveryMode.CHANNEL,
  });

  const { message, created } = await queries.message.createMessageIfAbsent(db, {
    id: messageId,
    conversationId: conv.id,
    role: MessageRole.ASSISTANT,
    content,
    taskId: input.taskId ?? null,
    metadata,
  });

  return {
    messageId: message.id,
    conversationId: conv.id,
    channelName,
    created,
  };
}

export type EnsureMorningBriefAutomationInput = {
  workspaceId: string;
  agentId: string;
  deliveryChannelId?: string | null;
  schedule?: string;
  title?: string;
  sopMarkdown?: string;
  skillName?: string | null;
  nowIso?: string;
  /** Override first fire; default next 08:00 UTC from nowIso. */
  nextRunAt?: string;
};

/**
 * Idempotent seed: return an existing morning-brief automation for the agent, or create one.
 * Does not invent a channel — callers pass deliveryChannelId when channel delivery is desired.
 */
export async function ensureMorningBriefAutomation(
  db: Database,
  input: EnsureMorningBriefAutomationInput,
) {
  const existing = await queries.automation.listAutomations(db, input.workspaceId, {
    agentId: input.agentId,
  });
  const found = existing.find((a) => isMorningBriefAutomation(a));
  if (found) return { automation: found, created: false as const };

  const nowIso = input.nowIso ?? new Date().toISOString();
  const nextRunAt = input.nextRunAt ?? nextUtcWallClock(8, 0, nowIso);
  const automation = await queries.automation.createAutomation(db, {
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    title: input.title ?? MORNING_BRIEF_DEFAULT_TITLE,
    sopMarkdown: input.sopMarkdown ?? MORNING_BRIEF_DEFAULT_SOP,
    schedule: input.schedule ?? MORNING_BRIEF_DEFAULT_SCHEDULE,
    nextRunAt,
    deliveryMode: AutomationDeliveryMode.CHANNEL,
    deliveryChannelId: input.deliveryChannelId ?? null,
    skillName: input.skillName ?? "day-planner",
    enabled: true,
  });
  return { automation, created: true as const };
}

export type EnsureMorningBriefCalendarCueInput = {
  workspaceId: string;
  agentId: string;
  nowIso?: string;
  /** Default: next 08:00 UTC. */
  scheduledAt?: string;
  title?: string;
  description?: string | null;
  /** When true (default), daily recurrence. */
  recurring?: boolean;
};

/**
 * Seed a calendar cue that can fire / appear in Day Planner morning context.
 * If a same-title event already exists for the agent, returns it (no duplicate).
 */
export async function ensureMorningBriefCalendarCue(
  db: Database,
  input: EnsureMorningBriefCalendarCueInput,
) {
  const title = input.title ?? MORNING_BRIEF_DEFAULT_TITLE;
  const nowIso = input.nowIso ?? new Date().toISOString();
  const scheduledAt = input.scheduledAt ?? nextUtcWallClock(8, 0, nowIso);

  const existing = await queries.calendarEvent.listCalendarEvents(
    db,
    input.workspaceId,
    { agentId: input.agentId },
  );
  const found = existing.find(
    (e) => e.title.trim().toLowerCase() === title.trim().toLowerCase(),
  );
  if (found) return { event: found, created: false as const };

  const event = await queries.calendarEvent.createCalendarEvent(db, {
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    title,
    description:
      input.description ??
      "Day Planner morning brief cue — build and post the daily channel digest.",
    scheduledAt,
    repeatInterval: input.recurring === false ? null : "1day",
  });
  return { event, created: true as const };
}

/**
 * Wire Day Planner path: ensure channel delivery automation + calendar cue.
 * Channel must already exist; pass its id for delivery_mode=channel.
 */
export async function ensureDayPlannerMorningBriefPath(
  db: Database,
  input: {
    workspaceId: string;
    agentId: string;
    deliveryChannelId?: string | null;
    nowIso?: string;
  },
) {
  const [autoResult, calResult] = await Promise.all([
    ensureMorningBriefAutomation(db, {
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      deliveryChannelId: input.deliveryChannelId ?? null,
      nowIso: input.nowIso,
    }),
    ensureMorningBriefCalendarCue(db, {
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      nowIso: input.nowIso,
    }),
  ]);
  return {
    automation: autoResult.automation,
    automationCreated: autoResult.created,
    calendarEvent: calResult.event,
    calendarCreated: calResult.created,
  };
}
