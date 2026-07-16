/**
 * Thin Helio scenario runtime glue (SC).
 *
 * Links template presets (Day Planner / Task Digest / Inbox AI / Feedback Loop /
 * Content Pipeline / Research Brief) to durable automation + delivery context.
 * Day Planner calendar path is owned by morning-brief.ts; this module unifies
 * detection, seeding, and snapshot builders without inventing new foundations.
 *
 * STATELESS: all durable state lives in D1 (automation / calendar / issues / emails).
 * Queries are always workspace-scoped first.
 */

import type { Database } from "@phneakngar/shared";
import {
  AutomationDeliveryMode,
  IssueStatus,
  OutboundEmailDeliveryStatus,
  queries,
  type IssueStatusType,
} from "@phneakngar/shared";
import { log } from "@/lib/logger";
import {
  ensureDayPlannerMorningBriefPath,
  isMorningBriefAutomation,
  nextUtcWallClock,
} from "@/lib/services/morning-brief";
import {
  HELIO_SCENARIO_TEMPLATE_IDS,
  type HelioScenarioTemplateId,
} from "@/lib/templates/types";

/**
 * Stable runtime ids — single-sourced from HELIO_SCENARIO_TEMPLATE_IDS so the
 * template registry and scenario runtime cannot diverge at compile time.
 */
export const SCENARIO_RUNTIME_IDS = HELIO_SCENARIO_TEMPLATE_IDS;

export type ScenarioRuntimeId = HelioScenarioTemplateId;

export type ScenarioRuntimeSpec = {
  id: ScenarioRuntimeId;
  /** Template preset id (1:1 with runtime id for Helio scenarios). */
  templateId: ScenarioRuntimeId;
  /**
   * Optional richer catalog template that pairs with this Helio scenario
   * (e.g. research-brief → research-analyst). Not used for seed skillName.
   */
  relatedTemplateId?: string | null;
  skillName: string;
  defaultTitle: string;
  /** Simple UTC cron `M H * * *` accepted by automation runner. */
  defaultSchedule: string;
  defaultHourUtc: number;
  defaultMinuteUtc: number;
  defaultSop: string;
  /** Title / skill / sop detection. */
  hintRe: RegExp;
};

export const TASK_DIGEST_DEFAULT_TITLE = "Task digest";
export const INBOX_AI_DEFAULT_TITLE = "Inbox digest";
export const FEEDBACK_LOOP_DEFAULT_TITLE = "Feedback loop";
export const CONTENT_PIPELINE_DEFAULT_TITLE = "Content pipeline";
export const RESEARCH_BRIEF_DEFAULT_TITLE = "Research brief";

export const FEEDBACK_LOOP_DEFAULT_SOP = `Collect product/user feedback signals, cluster themes, and post a channel digest of what needs a human decision.

## Digest structure
1. New feedback since last run
2. Themes / frequency
3. Severity / blocked users
4. Proposed owners / issues to open
5. Decisions needed

## Rules
- Prefer channel delivery when delivery_mode is channel.
- Do not invent feedback; only use provided context and open issues.
- Keep the loop scannable and utilitarian.`;

export const CONTENT_PIPELINE_DEFAULT_SOP = `Advance the editorial content pipeline: topics in research, drafts due, reviews waiting, and publish candidates.

## Digest structure
1. Ready to publish
2. In review / needs human
3. Drafts in motion
4. Research queue
5. Risks (stale, blocked sources)

## Rules
- Prefer channel delivery when delivery_mode is channel.
- Never invent draft status; use board_snapshot / context.
- Keep tone warm, sharp, and utilitarian.`;

export const RESEARCH_BRIEF_DEFAULT_SOP = `Produce a research brief from open questions, sources, and prior notes; post a channel summary of findings and open questions.

## Brief structure
1. Question / scope
2. Key findings (sourced)
3. Contradictions / unknowns
4. Recommended next probes
5. Decisions needed from humans

## Rules
- Prefer channel delivery when delivery_mode is channel.
- Cite sources when present in context; never invent citations.
- Keep scannable; escalate only decisions.`;

export const TASK_DIGEST_DEFAULT_SOP = `Scan the workspace issue board, own blocked work, and post a channel digest.

## Digest structure
1. Shipped / done since last digest
2. In motion
3. Blocked — owner, reason, next probe
4. At risk / aging
5. Decisions needed from humans
6. Proposed next claims

## Rules
- Use the provided board_snapshot; never invent issue state.
- Prefer channel delivery when delivery_mode is channel.
- Keep the digest scannable and utilitarian.`;

export const INBOX_AI_DEFAULT_SOP = `Triage the agent inbox, draft replies that need review, and post an inbox digest.

## Digest structure
1. Decisions needed / urgent inbound
2. Drafts awaiting approval
3. Aging quiet threads
4. Safe-to-ignore volume

## Rules
- Use the provided inbox_snapshot; never invent email content.
- Outbound high-stakes mail stays pending_approval — never auto-send.
- Prefer channel delivery when delivery_mode is channel.
- Keep tone warm, sharp, and utilitarian.`;

export const SCENARIO_RUNTIMES: Record<ScenarioRuntimeId, ScenarioRuntimeSpec> = {
  "day-planner": {
    id: "day-planner",
    templateId: "day-planner",
    skillName: "day-planner",
    defaultTitle: "Morning brief",
    defaultSchedule: "0 8 * * *",
    defaultHourUtc: 8,
    defaultMinuteUtc: 0,
    defaultSop: `Build today's morning brief from calendar and open commitments, then deliver it to the configured channel.`,
    hintRe: /morning\s*brief|day\s*planner|daily\s*brief|daily\s*plan|អ្នករៀបចំថ្ងៃ/i,
  },
  "task-digest": {
    id: "task-digest",
    templateId: "task-digest",
    skillName: "task-digest",
    defaultTitle: TASK_DIGEST_DEFAULT_TITLE,
    defaultSchedule: "0 17 * * *",
    defaultHourUtc: 17,
    defaultMinuteUtc: 0,
    defaultSop: TASK_DIGEST_DEFAULT_SOP,
    hintRe: /task\s*digest|board\s*digest|issue\s*digest|សង្ខេបភារកិច្ច/i,
  },
  "inbox-ai": {
    id: "inbox-ai",
    templateId: "inbox-ai",
    skillName: "inbox-ai",
    defaultTitle: INBOX_AI_DEFAULT_TITLE,
    defaultSchedule: "0 16 * * *",
    defaultHourUtc: 16,
    defaultMinuteUtc: 0,
    defaultSop: INBOX_AI_DEFAULT_SOP,
    hintRe: /inbox\s*(ai|digest|triage)|email\s*digest|email\s*triage/i,
  },
  "feedback-loop": {
    id: "feedback-loop",
    templateId: "feedback-loop",
    skillName: "feedback-loop",
    defaultTitle: FEEDBACK_LOOP_DEFAULT_TITLE,
    defaultSchedule: "0 15 * * 1-5",
    defaultHourUtc: 15,
    defaultMinuteUtc: 0,
    defaultSop: FEEDBACK_LOOP_DEFAULT_SOP,
    hintRe: /feedback\s*loop|user\s*feedback|product\s*feedback|រង្វិលជុំមតិ/i,
  },
  "content-pipeline": {
    id: "content-pipeline",
    templateId: "content-pipeline",
    skillName: "content-pipeline",
    defaultTitle: CONTENT_PIPELINE_DEFAULT_TITLE,
    defaultSchedule: "0 14 * * 1-5",
    defaultHourUtc: 14,
    defaultMinuteUtc: 0,
    defaultSop: CONTENT_PIPELINE_DEFAULT_SOP,
    hintRe: /content\s*pipeline|editorial\s*pipeline|blog\s*pipeline|បំពង់ខ្លឹមសារ/i,
  },
  "research-brief": {
    id: "research-brief",
    templateId: "research-brief",
    /** Deeper multi-member research catalog template when present. */
    relatedTemplateId: "research-analyst",
    skillName: "research-brief",
    defaultTitle: RESEARCH_BRIEF_DEFAULT_TITLE,
    defaultSchedule: "0 10 * * 1",
    defaultHourUtc: 10,
    defaultMinuteUtc: 0,
    defaultSop: RESEARCH_BRIEF_DEFAULT_SOP,
    hintRe: /research\s*brief|research\s*digest|analyst\s*brief|សង្ខេបស្រាវជ្រាវ/i,
  },
};

export function isScenarioRuntimeId(value: string): value is ScenarioRuntimeId {
  return (SCENARIO_RUNTIME_IDS as readonly string[]).includes(value);
}

export function getScenarioRuntimeSpec(
  id: ScenarioRuntimeId,
): ScenarioRuntimeSpec {
  return SCENARIO_RUNTIMES[id];
}

export function listScenarioRuntimeSpecs(): ScenarioRuntimeSpec[] {
  return SCENARIO_RUNTIME_IDS.map((id) => SCENARIO_RUNTIMES[id]);
}

/**
 * Detect which Helio scenario runtime an automation belongs to.
 * Day Planner reuses morning-brief heuristics; others use skill/title/sop hints.
 */
export function detectScenarioRuntime(auto: {
  title: string;
  sopMarkdown?: string | null;
  skillName?: string | null;
}): ScenarioRuntimeId | null {
  const skill = (auto.skillName ?? "").trim().toLowerCase();
  if (skill && isScenarioRuntimeId(skill)) return skill;

  if (isMorningBriefAutomation(auto)) return "day-planner";

  const hay = [auto.title, auto.sopMarkdown ?? "", auto.skillName ?? ""].join(
    "\n",
  );
  for (const id of SCENARIO_RUNTIME_IDS) {
    if (id === "day-planner") continue; // already handled
    if (SCENARIO_RUNTIMES[id].hintRe.test(hay)) return id;
  }
  return null;
}

export function isTaskDigestAutomation(auto: {
  title: string;
  sopMarkdown?: string | null;
  skillName?: string | null;
}): boolean {
  return detectScenarioRuntime(auto) === "task-digest";
}

export function isInboxAiAutomation(auto: {
  title: string;
  sopMarkdown?: string | null;
  skillName?: string | null;
}): boolean {
  return detectScenarioRuntime(auto) === "inbox-ai";
}

// ---------------------------------------------------------------------------
// Task Digest — board snapshot pure helpers
// ---------------------------------------------------------------------------

export type DigestIssueItem = {
  id: string;
  title: string;
  status: string;
  claimed_by_agent_id: string | null;
  updated_at: string;
  aging_hours: number;
  is_aging: boolean;
};

export type BoardSnapshot = {
  generated_at: string;
  aging_threshold_hours: number;
  counts: Record<string, number>;
  items: DigestIssueItem[];
  summary: string;
};

const DEFAULT_AGING_HOURS = 72;

export function toDigestIssueItems(
  rows: Array<{
    id: string;
    title: string;
    status: string;
    claimedByAgentId?: string | null;
    updatedAt: string;
  }>,
  opts?: { nowIso?: string; agingThresholdHours?: number },
): DigestIssueItem[] {
  const nowMs = new Date(opts?.nowIso ?? new Date().toISOString()).getTime();
  const threshold = opts?.agingThresholdHours ?? DEFAULT_AGING_HOURS;
  return rows.map((r) => {
    const updatedMs = new Date(r.updatedAt).getTime();
    const agingHours = Number.isFinite(updatedMs)
      ? Math.max(0, Math.floor((nowMs - updatedMs) / 3_600_000))
      : 0;
    return {
      id: r.id,
      title: (r.title ?? "").trim() || "(untitled)",
      status: r.status,
      claimed_by_agent_id: r.claimedByAgentId ?? null,
      updated_at: r.updatedAt,
      aging_hours: agingHours,
      is_aging: agingHours >= threshold,
    };
  });
}

export function formatBoardSnapshot(
  items: DigestIssueItem[],
  opts?: { nowIso?: string; agingThresholdHours?: number },
): BoardSnapshot {
  const agingThresholdHours = opts?.agingThresholdHours ?? DEFAULT_AGING_HOURS;
  const generated_at = opts?.nowIso ?? new Date().toISOString();
  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
  }

  if (items.length === 0) {
    return {
      generated_at,
      aging_threshold_hours: agingThresholdHours,
      counts,
      items: [],
      summary: "No active issues on the board (workspace-scoped snapshot).",
    };
  }

  const byStatus = (status: IssueStatusType | string) =>
    items.filter((i) => i.status === status);

  const sections: string[] = [
    `Board snapshot (${items.length} active, aging ≥ ${agingThresholdHours}h):`,
  ];

  const blocked = byStatus(IssueStatus.BLOCKED);
  if (blocked.length) {
    sections.push(`Blocked (${blocked.length}):`);
    for (const i of blocked) {
      const owner = i.claimed_by_agent_id ?? "unclaimed";
      sections.push(
        `- [${i.id}] ${i.title} · owner=${owner} · age=${i.aging_hours}h`,
      );
    }
  }

  const inMotion = [
    ...byStatus(IssueStatus.IN_PROGRESS),
    ...byStatus(IssueStatus.REVIEW),
  ];
  if (inMotion.length) {
    sections.push(`In motion (${inMotion.length}):`);
    for (const i of inMotion) {
      sections.push(`- [${i.id}] ${i.title} · ${i.status}`);
    }
  }

  const aging = items.filter(
    (i) =>
      i.is_aging &&
      i.status !== IssueStatus.BLOCKED &&
      i.status !== IssueStatus.DONE,
  );
  if (aging.length) {
    sections.push(`Aging (${aging.length}):`);
    for (const i of aging.slice(0, 12)) {
      sections.push(
        `- [${i.id}] ${i.title} · ${i.status} · age=${i.aging_hours}h`,
      );
    }
  }

  const todo = byStatus(IssueStatus.TODO);
  if (todo.length) {
    sections.push(`Todo (${todo.length}) — high-signal only if needed later.`);
  }

  return {
    generated_at,
    aging_threshold_hours: agingThresholdHours,
    counts,
    items,
    summary: sections.join("\n"),
  };
}

export function buildTaskDigestTaskContext(input: {
  automationId: string;
  schedule: string;
  deliveryMode: string;
  deliveryChannelId: string | null;
  deliveryChannelName: string | null;
  skillName: string | null;
  observedNextRunAt: string;
  board: BoardSnapshot;
}): Record<string, unknown> {
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
    scenario: "task-digest" satisfies ScenarioRuntimeId,
    task_digest: true,
    board_snapshot: {
      generated_at: input.board.generated_at,
      aging_threshold_hours: input.board.aging_threshold_hours,
      counts: input.board.counts,
      items: input.board.items,
      summary: input.board.summary,
    },
  };
}

export function buildScenarioDeliveryPrompt(
  basePrompt: string,
  opts: {
    snapshotSummary?: string | null;
    deliveryMode?: string | null;
    deliveryChannelName?: string | null;
    scenarioLabel?: string | null;
  },
): string {
  const parts = [basePrompt.trim()].filter(Boolean);
  if (opts.scenarioLabel) {
    parts.push(`Scenario: ${opts.scenarioLabel}`);
  }
  if (opts.snapshotSummary?.trim()) {
    parts.push(opts.snapshotSummary.trim());
  }
  const mode = (opts.deliveryMode ?? "").trim();
  const channel = (opts.deliveryChannelName ?? "").trim();
  if (mode === AutomationDeliveryMode.CHANNEL && channel) {
    parts.push(
      `Delivery: post the finished digest to channel "${channel}" (delivery_mode=channel).`,
    );
  } else if (mode === AutomationDeliveryMode.DM) {
    parts.push("Delivery: send the finished digest as a direct message to the owner.");
  } else if (mode) {
    parts.push(
      `Delivery mode: ${mode}${channel ? ` (channel: ${channel})` : ""}.`,
    );
  }
  return parts.join("\n\n");
}

/** Load active issues for the board snapshot (workspace + creator scope). */
export async function loadBoardSnapshot(
  db: Database,
  workspaceId: string,
  opts: {
    ownerUserId: string;
    agentId?: string;
    nowIso?: string;
    agingThresholdHours?: number;
  },
): Promise<BoardSnapshot> {
  const nowIso = opts.nowIso ?? new Date().toISOString();
  const rows = await queries.issue.listIssues(db, workspaceId, {
    userId: opts.ownerUserId,
    agentId: opts.agentId,
    terminal: false,
  });
  const items = toDigestIssueItems(rows, {
    nowIso,
    agingThresholdHours: opts.agingThresholdHours,
  });
  return formatBoardSnapshot(items, {
    nowIso,
    agingThresholdHours: opts.agingThresholdHours,
  });
}

// ---------------------------------------------------------------------------
// Inbox AI — inbox snapshot pure helpers
// ---------------------------------------------------------------------------

export type InboxDigestItem = {
  id: string;
  direction: string;
  status: string;
  from_email: string;
  to_email: string;
  subject: string;
  created_at: string;
  needs_approval: boolean;
  is_inbound: boolean;
};

export type InboxSnapshot = {
  generated_at: string;
  counts: {
    total: number;
    inbound: number;
    pending_approval: number;
    other: number;
  };
  items: InboxDigestItem[];
  summary: string;
};

export function toInboxDigestItems(
  rows: Array<{
    id: string;
    direction?: string | null;
    status?: string | null;
    fromEmail?: string | null;
    toEmail?: string | null;
    subject?: string | null;
    createdAt: string;
  }>,
): InboxDigestItem[] {
  return rows.map((r) => {
    const status = (r.status ?? "").trim() || "unknown";
    const direction = (r.direction ?? "").trim() || "unknown";
    return {
      id: r.id,
      direction,
      status,
      from_email: (r.fromEmail ?? "").trim(),
      to_email: (r.toEmail ?? "").trim(),
      subject: (r.subject ?? "").trim() || "(no subject)",
      created_at: r.createdAt,
      needs_approval: status === OutboundEmailDeliveryStatus.PENDING_APPROVAL,
      is_inbound: direction === "inbound",
    };
  });
}

export function formatInboxSnapshot(
  items: InboxDigestItem[],
  opts?: { nowIso?: string },
): InboxSnapshot {
  const generated_at = opts?.nowIso ?? new Date().toISOString();
  const pending = items.filter((i) => i.needs_approval);
  const inbound = items.filter((i) => i.is_inbound);
  // Count non-overlapping remainder so dual-tagged rows never double-subtract.
  const other = items.filter((i) => !i.is_inbound && !i.needs_approval).length;
  const counts = {
    total: items.length,
    inbound: inbound.length,
    pending_approval: pending.length,
    other,
  };

  if (items.length === 0) {
    return {
      generated_at,
      counts,
      items: [],
      summary: "No recent emails for this agent (workspace-scoped snapshot).",
    };
  }

  const sections: string[] = [
    `Inbox snapshot (${counts.total} recent · ${counts.inbound} inbound · ${counts.pending_approval} pending approval):`,
  ];

  if (pending.length) {
    sections.push(`Awaiting approval (${pending.length}):`);
    for (const i of pending.slice(0, 10)) {
      sections.push(`- [${i.id}] → ${i.to_email} · ${i.subject}`);
    }
  }

  if (inbound.length) {
    sections.push(`Inbound (${inbound.length}):`);
    for (const i of inbound.slice(0, 15)) {
      sections.push(
        `- [${i.id}] ${i.status} · from ${i.from_email} · ${i.subject}`,
      );
    }
  }

  return {
    generated_at,
    counts,
    items,
    summary: sections.join("\n"),
  };
}

export function buildInboxAiTaskContext(input: {
  automationId: string;
  schedule: string;
  deliveryMode: string;
  deliveryChannelId: string | null;
  deliveryChannelName: string | null;
  skillName: string | null;
  observedNextRunAt: string;
  inbox: InboxSnapshot;
}): Record<string, unknown> {
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
    scenario: "inbox-ai" satisfies ScenarioRuntimeId,
    inbox_ai: true,
    inbox_snapshot: {
      generated_at: input.inbox.generated_at,
      counts: input.inbox.counts,
      items: input.inbox.items,
      summary: input.inbox.summary,
    },
  };
}

/**
 * Thin delivery context for deeper scenarios (feedback-loop / content-pipeline /
 * research-brief). Optional board_snapshot reuses the task-digest board shape;
 * omit or pass null when no durable snapshot source is available (documented
 * for research-brief — agent relies on SOP + workspace knowledge only).
 */
export function buildLightScenarioTaskContext(input: {
  automationId: string;
  schedule: string;
  deliveryMode: string;
  deliveryChannelId: string | null;
  deliveryChannelName: string | null;
  skillName: string | null;
  observedNextRunAt: string;
  scenarioId: Extract<
    ScenarioRuntimeId,
    "feedback-loop" | "content-pipeline" | "research-brief"
  >;
  board?: BoardSnapshot | null;
}): Record<string, unknown> {
  const channelDelivery = input.deliveryMode === AutomationDeliveryMode.CHANNEL;
  const context: Record<string, unknown> = {
    automation_id: input.automationId,
    schedule: input.schedule,
    delivery_mode: input.deliveryMode,
    delivery_channel_id: input.deliveryChannelId,
    delivery_channel_name: input.deliveryChannelName,
    ...(channelDelivery ? { deliver_to_channel: true as const } : {}),
    skill_name: input.skillName,
    observed_next_run_at: input.observedNextRunAt,
    scenario: input.scenarioId,
    [input.scenarioId.replace(/-/g, "_")]: true,
  };
  if (input.board) {
    context.board_snapshot = {
      generated_at: input.board.generated_at,
      aging_threshold_hours: input.board.aging_threshold_hours,
      counts: input.board.counts,
      items: input.board.items,
      summary: input.board.summary,
    };
  } else {
    // Explicit null documents "no durable snapshot for this run".
    context.board_snapshot = null;
  }
  return context;
}

/** Load recent agent emails (workspace + agent scope). */
export async function loadInboxSnapshot(
  db: Database,
  workspaceId: string,
  agentId: string,
  opts?: { nowIso?: string; limit?: number },
): Promise<InboxSnapshot> {
  const limit = opts?.limit ?? 40;
  const rows = await queries.email.getEmailsByAgent(
    db,
    agentId,
    workspaceId,
    undefined,
    { limit, offset: 0 },
  );
  const items = toInboxDigestItems(rows);
  return formatInboxSnapshot(items, { nowIso: opts?.nowIso });
}

// ---------------------------------------------------------------------------
// Ensure / seed automations (idempotent)
// ---------------------------------------------------------------------------

export type EnsureScenarioAutomationInput = {
  workspaceId: string;
  agentId: string;
  scenarioId: ScenarioRuntimeId;
  deliveryChannelId?: string | null;
  schedule?: string;
  title?: string;
  sopMarkdown?: string;
  skillName?: string | null;
  nowIso?: string;
  nextRunAt?: string;
};

/**
 * Idempotent seed for a scenario automation.
 * Day Planner delegates to morning-brief ensure (calendar + automation).
 * Task Digest / Inbox AI create channel-delivery automations when absent.
 */
export async function ensureScenarioAutomation(
  db: Database,
  input: EnsureScenarioAutomationInput,
): Promise<{ automation: Awaited<ReturnType<typeof queries.automation.createAutomation>>; created: boolean }> {
  const spec = getScenarioRuntimeSpec(input.scenarioId);

  if (input.scenarioId === "day-planner") {
    const result = await ensureDayPlannerMorningBriefPath(db, {
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      deliveryChannelId: input.deliveryChannelId ?? null,
      nowIso: input.nowIso,
    });
    return { automation: result.automation, created: result.automationCreated };
  }

  const existing = await queries.automation.listAutomations(db, input.workspaceId, {
    agentId: input.agentId,
  });
  const found = existing.find((a) => detectScenarioRuntime(a) === input.scenarioId);
  if (found) return { automation: found, created: false };

  const nowIso = input.nowIso ?? new Date().toISOString();
  const nextRunAt =
    input.nextRunAt ??
    nextUtcWallClock(spec.defaultHourUtc, spec.defaultMinuteUtc, nowIso);

  const automation = await queries.automation.createAutomation(db, {
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    title: input.title ?? spec.defaultTitle,
    sopMarkdown: input.sopMarkdown ?? spec.defaultSop,
    schedule: input.schedule ?? spec.defaultSchedule,
    nextRunAt,
    deliveryMode: AutomationDeliveryMode.CHANNEL,
    deliveryChannelId: input.deliveryChannelId ?? null,
    skillName: input.skillName ?? spec.skillName,
    enabled: true,
  });
  return { automation, created: true };
}

/**
 * Day Planner "create-all": automation (channel delivery) + calendar cue.
 * Thin product-facing alias over ensureScenarioRuntimePath for template install.
 * Idempotent — second call returns created=false flags.
 */
export async function ensureDayPlannerCreateAll(
  db: Database,
  input: {
    workspaceId: string;
    agentId: string;
    deliveryChannelId?: string | null;
    nowIso?: string;
  },
) {
  const path = await ensureScenarioRuntimePath(db, {
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    scenarioId: "day-planner",
    deliveryChannelId: input.deliveryChannelId ?? null,
    nowIso: input.nowIso,
  });
  return {
    automation: path.automation,
    automationCreated: path.automationCreated,
    calendarEvent: path.calendarEvent,
    calendarCreated: path.calendarCreated,
    /** True when either automation or calendar was newly created. */
    anyCreated: path.automationCreated || path.calendarCreated,
  };
}

/**
 * Full scenario path wire-up for a template install / agent seed.
 * Day Planner also ensures the calendar cue; others only ensure automation.
 */
export async function ensureScenarioRuntimePath(
  db: Database,
  input: {
    workspaceId: string;
    agentId: string;
    scenarioId: ScenarioRuntimeId;
    deliveryChannelId?: string | null;
    nowIso?: string;
  },
): Promise<{
  scenarioId: ScenarioRuntimeId;
  automation: Awaited<ReturnType<typeof queries.automation.createAutomation>>;
  automationCreated: boolean;
  calendarEvent: Awaited<
    ReturnType<typeof ensureDayPlannerMorningBriefPath>
  >["calendarEvent"] | null;
  calendarCreated: boolean;
}> {
  if (input.scenarioId === "day-planner") {
    const result = await ensureDayPlannerMorningBriefPath(db, {
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      deliveryChannelId: input.deliveryChannelId ?? null,
      nowIso: input.nowIso,
    });
    return {
      scenarioId: "day-planner",
      automation: result.automation,
      automationCreated: result.automationCreated,
      calendarEvent: result.calendarEvent,
      calendarCreated: result.calendarCreated,
    };
  }

  const autoResult = await ensureScenarioAutomation(db, {
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    scenarioId: input.scenarioId,
    deliveryChannelId: input.deliveryChannelId ?? null,
    nowIso: input.nowIso,
  });
  return {
    scenarioId: input.scenarioId,
    automation: autoResult.automation,
    automationCreated: autoResult.created,
    calendarEvent: null,
    calendarCreated: false,
  };
}

/**
 * Attach scenario-specific snapshot context for due automation dispatch.
 * Returns null when the automation is not a Helio scenario runtime (caller
 * builds a generic context). Day Planner remains handled by morning-brief
 * helpers in the automation service.
 */
export async function buildScenarioAutomationContext(
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
  opts: {
    nowIso: string;
    deliveryChannelName: string | null;
    ownerUserId?: string | null;
  },
): Promise<{
  scenarioId: ScenarioRuntimeId;
  prompt: string;
  context: Record<string, unknown>;
} | null> {
  const scenarioId = detectScenarioRuntime(auto);
  if (!scenarioId) return null;

  // Day Planner context is built in morning-brief / automation path already.
  if (scenarioId === "day-planner") return null;

  const basePrompt = [auto.title.trim(), (auto.sopMarkdown ?? "").trim()]
    .filter(Boolean)
    .concat(auto.skillName ? [`Skill: ${auto.skillName}`] : [])
    .join("\n\n");

  if (scenarioId === "task-digest") {
    let board: BoardSnapshot = formatBoardSnapshot([], { nowIso: opts.nowIso });
    if (opts.ownerUserId) {
      try {
        board = await loadBoardSnapshot(db, workspaceId, {
          ownerUserId: opts.ownerUserId,
          nowIso: opts.nowIso,
        });
      } catch (err) {
        log.warn("scenario-runtime: task-digest board load failed", {
          id: auto.id,
          err: String(err),
        });
      }
    } else {
      log.warn("scenario-runtime: task-digest missing owner for board snapshot", {
        id: auto.id,
        agentId: auto.agentId,
      });
    }

    const context = buildTaskDigestTaskContext({
      automationId: auto.id,
      schedule: auto.schedule,
      deliveryMode: auto.deliveryMode,
      deliveryChannelId: auto.deliveryChannelId ?? null,
      deliveryChannelName: opts.deliveryChannelName,
      skillName: auto.skillName ?? null,
      observedNextRunAt: auto.nextRunAt,
      board,
    });
    const prompt = buildScenarioDeliveryPrompt(basePrompt, {
      snapshotSummary: board.summary,
      deliveryMode: auto.deliveryMode,
      deliveryChannelName: opts.deliveryChannelName,
      scenarioLabel: "task-digest",
    });
    return { scenarioId, prompt, context };
  }

  if (scenarioId === "inbox-ai") {
    let inbox: InboxSnapshot = formatInboxSnapshot([], { nowIso: opts.nowIso });
    try {
      inbox = await loadInboxSnapshot(db, workspaceId, auto.agentId, {
        nowIso: opts.nowIso,
      });
    } catch (err) {
      log.warn("scenario-runtime: inbox-ai snapshot load failed", {
        id: auto.id,
        err: String(err),
      });
    }

    const context = buildInboxAiTaskContext({
      automationId: auto.id,
      schedule: auto.schedule,
      deliveryMode: auto.deliveryMode,
      deliveryChannelId: auto.deliveryChannelId ?? null,
      deliveryChannelName: opts.deliveryChannelName,
      skillName: auto.skillName ?? null,
      observedNextRunAt: auto.nextRunAt,
      inbox,
    });
    const prompt = buildScenarioDeliveryPrompt(basePrompt, {
      snapshotSummary: inbox.summary,
      deliveryMode: auto.deliveryMode,
      deliveryChannelName: opts.deliveryChannelName,
      scenarioLabel: "inbox-ai",
    });
    return { scenarioId, prompt, context };
  }

  // Deeper scenarios: feedback-loop / content-pipeline / research-brief.
  // feedback + content optionally reuse the task-digest board shape.
  // research-brief intentionally leaves board_snapshot null (no durable
  // research snapshot source yet — agent relies on SOP + workspace knowledge).
  let board: BoardSnapshot | null = null;
  if (scenarioId === "feedback-loop" || scenarioId === "content-pipeline") {
    if (opts.ownerUserId) {
      try {
        board = await loadBoardSnapshot(db, workspaceId, {
          ownerUserId: opts.ownerUserId,
          nowIso: opts.nowIso,
        });
      } catch (err) {
        log.warn(`scenario-runtime: ${scenarioId} board load failed`, {
          id: auto.id,
          err: String(err),
        });
        board = formatBoardSnapshot([], { nowIso: opts.nowIso });
      }
    } else {
      board = formatBoardSnapshot([], { nowIso: opts.nowIso });
    }
  }

  const context = buildLightScenarioTaskContext({
    automationId: auto.id,
    schedule: auto.schedule,
    deliveryMode: auto.deliveryMode,
    deliveryChannelId: auto.deliveryChannelId ?? null,
    deliveryChannelName: opts.deliveryChannelName,
    skillName: auto.skillName ?? null,
    observedNextRunAt: auto.nextRunAt,
    scenarioId,
    board,
  });
  const prompt = buildScenarioDeliveryPrompt(basePrompt, {
    snapshotSummary: board?.summary ?? null,
    deliveryMode: auto.deliveryMode,
    deliveryChannelName: opts.deliveryChannelName,
    scenarioLabel: scenarioId,
  });
  return { scenarioId, prompt, context };
}
