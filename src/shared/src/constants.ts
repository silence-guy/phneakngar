export const AgentStatus = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  ERROR: "error",
} as const;

export type AgentStatusType = (typeof AgentStatus)[keyof typeof AgentStatus];

export const RuntimeStatus = {
  ONLINE: "online",
  OFFLINE: "offline",
  ERROR: "error",
} as const;

export type RuntimeStatusType =
  (typeof RuntimeStatus)[keyof typeof RuntimeStatus];

export const TaskStatus = {
  QUEUED: "queued",
  DISPATCHED: "dispatched",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
  SUPERSEDED: "superseded",
} as const;

export const TERMINAL_TASK_STATUSES: readonly TaskStatusType[] = [
  TaskStatus.COMPLETED,
  TaskStatus.FAILED,
  TaskStatus.CANCELLED,
  TaskStatus.SUPERSEDED,
] as const;

export function isTerminalTaskStatus(status: string): boolean {
  return (TERMINAL_TASK_STATUSES as readonly string[]).includes(status);
}

export type TaskStatusType = (typeof TaskStatus)[keyof typeof TaskStatus];

export const TASK_TYPES = {
  USER_DM_MESSAGE: "user_dm_message",
  EMAIL_NOTIFICATION: "email_notification",
  CALENDAR_EVENT: "calendar_event",
  ISSUE_EVENT: "issue_event",
  AUTOMATION_EVENT: "automation_event",
  PLAYBOOK_STEP: "playbook_step",
  KILL_TASK: "kill_task",
} as const;

export type TaskType = (typeof TASK_TYPES)[keyof typeof TASK_TYPES];

export const IssueStatus = {
  TODO: "todo",
  IN_PROGRESS: "in_progress",
  REVIEW: "review",
  BLOCKED: "blocked",
  DONE: "done",
  CLOSED: "closed",
  CANCELED: "canceled",
  FAILED: "failed",
} as const;

export type IssueStatusType = (typeof IssueStatus)[keyof typeof IssueStatus];

export const ACTIVE_ISSUE_STATUSES: readonly IssueStatusType[] = [
  IssueStatus.TODO,
  IssueStatus.IN_PROGRESS,
  IssueStatus.REVIEW,
  IssueStatus.BLOCKED,
] as const;

export const TERMINAL_ISSUE_STATUSES: readonly IssueStatusType[] = [
  IssueStatus.DONE,
  IssueStatus.CLOSED,
  IssueStatus.CANCELED,
  IssueStatus.FAILED,
] as const;

export function isTerminalIssueStatus(status: string): boolean {
  return (TERMINAL_ISSUE_STATUSES as readonly string[]).includes(status);
}

export const MessageRole = {
  USER: "user",
  ASSISTANT: "assistant",
  EVENT: "event",
} as const;

export type MessageRoleType = (typeof MessageRole)[keyof typeof MessageRole];

/** Metadata.kind values for assistant/event message chrome. */
export const MessageKind = {
  DM: "dm",
  LIFECYCLE: "lifecycle",
  CHANNEL_DELIVERY: "channel_delivery",
} as const;

export type MessageKindType = (typeof MessageKind)[keyof typeof MessageKind];

// Timing constants
export const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS) || 3_000;
export const OFFLINE_THRESHOLD_MS = Number(process.env.OFFLINE_THRESHOLD_MS) || 30_000;
export const EVENT_POLL_INTERVAL_MS = Number(process.env.EVENT_POLL_INTERVAL_MS) || 2_000;
export const AGENT_HANDLE_MIN_LENGTH = 4;
export const MAX_TASKS_PER_TRACE = 256;
export const MAX_POLL_TASKS = 8;
export const MAX_PENDING_TASK_CANDIDATES_PER_POLL = 64;
export const MAX_POLL_FILE_REQUESTS = 16;
export const MAX_POLL_MEETINGS = 4;

export const MeetingStatus = {
  PENDING: "pending",
  SCHEDULED: "scheduled",
  JOINING: "joining",
  RECORDING: "recording",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export type MeetingStatusType = (typeof MeetingStatus)[keyof typeof MeetingStatus];

export const TERMINAL_MEETING_STATUSES: readonly MeetingStatusType[] = [
  MeetingStatus.COMPLETED,
  MeetingStatus.FAILED,
] as const;

// Dev mode auth (shared between web frontend and @phneakngar/app CLI)
export const DEV_PASSWORD = "dev-password-000";

// Local dev URLs (used for service-binding fallbacks)
export const DEV_WEB_URL = process.env.PHNEAKNGAR_SERVER_URL || "http://localhost:3000";
export const DEV_WS_DO_URL = process.env.DEV_WS_DO_URL || "http://localhost:15212";
export const DEV_EMAIL_WORKER_URL = process.env.DEV_EMAIL_WORKER_URL || "http://localhost:8787";

export const EMAIL_NOTIFY_SECRET_HEADER = "X-Phneakngar-Email-Notify-Secret";
export const EMAIL_DOMAIN_EXPECTATION_HEADER = "X-Phneakngar-Expected-Email-Domain";
export const WS_SERVICE_SECRET_HEADER = "X-Phneakngar-WS-Service-Secret";
export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";

/** Durable outbound send claim states on `emails.status` (direction=outbound). */
export const OutboundEmailDeliveryStatus = {
  PENDING: "pending",
  /** Awaiting human approve/edit before send (Helio-style high-stakes gate). */
  PENDING_APPROVAL: "pending_approval",
  SENDING: "sending",
  SENT: "sent",
  FAILED: "failed",
  AMBIGUOUS: "ambiguous",
  REJECTED: "rejected",
} as const;

export type OutboundEmailDeliveryStatusType =
  (typeof OutboundEmailDeliveryStatus)[keyof typeof OutboundEmailDeliveryStatus];

export function buildOutboundDeliveryKey(agentId: string, idempotencyKey: string): string {
  return `outbound:${agentId}:${idempotencyKey}`;
}

/** Generic high-stakes approval queue (email, tool write-back, skill install). */
export const ApprovalKind = {
  OUTBOUND_EMAIL: "outbound_email",
  TOOL_ACTION: "tool_action",
  SKILL_INSTALL: "skill_install",
  AUTOMATION_PROMOTE: "automation_promote",
  /** Workflow gate inside a playbook run; created by the playbook engine. */
  PLAYBOOK_STEP_GATE: "playbook_step_gate",
} as const;

export type ApprovalKindType = (typeof ApprovalKind)[keyof typeof ApprovalKind];

export const ApprovalStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  EXPIRED: "expired",
} as const;

export type ApprovalStatusType = (typeof ApprovalStatus)[keyof typeof ApprovalStatus];

export const MemoryKind = {
  PREFERENCE: "preference",
  DECISION: "decision",
  FACT: "fact",
  ROLE: "role",
  /** Written by the memory compaction job only. */
  SUMMARY: "summary",
} as const;

export type MemoryKindType = (typeof MemoryKind)[keyof typeof MemoryKind];

export const AutomationDeliveryMode = {
  CHANNEL: "channel",
  DM: "dm",
  EMAIL_DRAFT: "email_draft",
  ISSUE: "issue",
} as const;

export type AutomationDeliveryModeType =
  (typeof AutomationDeliveryMode)[keyof typeof AutomationDeliveryMode];

/** How an artifact row was produced (chat upload vs delivery product surface). */
export const ArtifactSource = {
  AGENT: "agent",
  ATTACHMENT: "attachment",
  DELIVERY: "delivery",
} as const;

export type ArtifactSourceType = (typeof ArtifactSource)[keyof typeof ArtifactSource];

/** Delivery product kinds stored under source=delivery. */
export const DeliveryArtifactKind = {
  DELIVERY: "delivery",
  DIGEST: "digest",
  DRAFT: "draft",
  REPORT: "report",
} as const;

export type DeliveryArtifactKindType =
  (typeof DeliveryArtifactKind)[keyof typeof DeliveryArtifactKind];
