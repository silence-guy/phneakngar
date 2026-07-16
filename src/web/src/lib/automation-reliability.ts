/**
 * Pure helpers for automation reliability UX (overdue / last-run visibility).
 * STATELESS — no I/O.
 */

export type AutomationRunHealth = {
  /** next_run_at is in the past while enabled. */
  overdue: boolean;
  /** Human-facing status chip. */
  statusLabel: "enabled" | "paused" | "overdue";
};

/**
 * Classify automation schedule health for list UI.
 * `nowIso` defaults to caller-supplied clock for tests.
 */
export function classifyAutomationRunHealth(input: {
  enabled: boolean;
  nextRunAt: string | null | undefined;
  nowIso?: string;
}): AutomationRunHealth {
  if (!input.enabled) {
    return { overdue: false, statusLabel: "paused" };
  }
  const next = input.nextRunAt?.trim() || "";
  if (!next) {
    return { overdue: false, statusLabel: "enabled" };
  }
  const now = Date.parse(input.nowIso ?? new Date().toISOString());
  const nextMs = Date.parse(next);
  if (Number.isNaN(now) || Number.isNaN(nextMs)) {
    return { overdue: false, statusLabel: "enabled" };
  }
  const overdue = nextMs < now;
  return {
    overdue,
    statusLabel: overdue ? "overdue" : "enabled",
  };
}
