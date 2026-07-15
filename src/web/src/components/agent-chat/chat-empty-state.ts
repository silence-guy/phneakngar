/**
 * Pure decision for the agent-chat empty frame.
 *
 * TaskStream only surfaces errors (not intermediate “thinking”). Presence line
 * owns reading/typing. When messages are empty we must still paint a frame —
 * especially after registration while welcome tasks are queued/dispatched, or
 * when the user opens an active task from the canvas notification panel.
 */

export type ChatEmptyStateKind =
  | "none"
  | "welcome-email"
  | "active-working"
  | "active-stuck"
  | "say-hi";

/** Queued/dispatched longer than this → treat as stuck (show runtime guidance). */
export const ACTIVE_TASK_STUCK_AFTER_MS = 2 * 60 * 1000;

const TERMINAL_TASK = new Set([
  "completed",
  "failed",
  "cancelled",
  "superseded",
]);

export interface ChatEmptyStateInput {
  readonly messageCount: number;
  readonly isNewAgent: boolean;
  readonly hasEmailTask: boolean;
  readonly activeChannel: string;
  /** Active task status on this conversation, or null when idle. */
  readonly activeTaskStatus: string | null;
  /** Active task type (e.g. email_notification), or null. */
  readonly activeTaskType: string | null;
  /** Age of the active task in ms, or null. */
  readonly activeTaskAgeMs: number | null;
}

function isActiveStatus(status: string | null): boolean {
  return status != null && !TERMINAL_TASK.has(status);
}

/** True when a task is still live but has not left queued/dispatched long enough. */
export function isActiveTaskStuck(
  status: string | null,
  ageMs: number | null,
): boolean {
  if (!isActiveStatus(status)) return false;
  if (status !== "queued" && status !== "dispatched") return false;
  return (ageMs ?? 0) >= ACTIVE_TASK_STUCK_AFTER_MS;
}

/**
 * Given chat load facts, which empty-state kind to render.
 * Active tasks do NOT suppress empty states — presence handles social status.
 */
export function resolveChatEmptyState(
  input: ChatEmptyStateInput,
): ChatEmptyStateKind {
  if (input.messageCount > 0) return "none";

  const taskActive = isActiveStatus(input.activeTaskStatus);
  const stuck = isActiveTaskStuck(
    input.activeTaskStatus,
    input.activeTaskAgeMs,
  );

  if (taskActive && stuck) return "active-stuck";

  // Only email_notification is a welcome-email frame — not "any active task".
  if (taskActive && input.activeTaskType === "email_notification") {
    return "welcome-email";
  }
  if (taskActive) return "active-working";

  // Idle empty: optional welcome hint when caller knows an email welcome is pending.
  if (
    input.isNewAgent &&
    input.hasEmailTask &&
    input.activeChannel === "default"
  ) {
    return "welcome-email";
  }

  return "say-hi";
}
