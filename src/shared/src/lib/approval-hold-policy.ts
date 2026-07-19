/**
 * Approval hold/resume policy: when high-stakes tools create a durable
 * approval, the CLI may poll until the human decides (hold) instead of
 * immediately denying with an approval_id pointer.
 *
 * Pure helpers only — no I/O.
 */

export type ApprovalHoldSettings = {
  /** When true, CLI holds the tool call until approval is decided (or timeout). */
  enabled: boolean;
};

/** Product default: hold is on so Approvals inbox is the human desk. */
export const DEFAULT_APPROVAL_HOLD: ApprovalHoldSettings = {
  enabled: true,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function truthyFlag(v: unknown): boolean {
  return v === true || v === 1 || v === "1" || v === "true" || v === "yes" || v === "on";
}

function falsyFlag(v: unknown): boolean {
  return v === false || v === 0 || v === "0" || v === "false" || v === "no" || v === "off";
}

/**
 * Read hold settings from agent `runtime_config.approvalHold` (or snake_case).
 * Missing / invalid config defaults to product default (enabled).
 */
export function readApprovalHoldPolicy(runtimeConfig: unknown): ApprovalHoldSettings {
  const config = asRecord(runtimeConfig);
  const hold =
    asRecord(config?.approvalHold) ??
    asRecord(config?.approval_hold) ??
    null;
  if (!hold) return { ...DEFAULT_APPROVAL_HOLD };

  if (falsyFlag(hold.enabled)) return { enabled: false };
  if (truthyFlag(hold.enabled)) return { enabled: true };
  // Key present but unreadable → keep default on
  return { ...DEFAULT_APPROVAL_HOLD };
}

/**
 * Merge hold settings into runtime_config. Always writes explicit `approvalHold.enabled`
 * so operators can see the choice in stored JSON.
 */
export function applyApprovalHoldPolicyToRuntimeConfig(
  baseRuntimeConfig: unknown,
  settings: ApprovalHoldSettings,
): Record<string, unknown> {
  const base = asRecord(baseRuntimeConfig) ?? {};
  const next: Record<string, unknown> = { ...base };
  const existing =
    asRecord(base.approvalHold) ?? asRecord(base.approval_hold) ?? {};
  next.approvalHold = {
    ...existing,
    enabled: settings.enabled,
  };
  if ("approval_hold" in next) delete next.approval_hold;
  return next;
}

export type ResolveApprovalHoldInput = {
  runtimeConfig?: unknown;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
};

/**
 * Resolve whether hold is enabled for this process/task.
 * Env overrides runtime_config when set to a recognized truthy/falsy token.
 */
export function resolveApprovalHoldEnabled(
  input: ResolveApprovalHoldInput = {},
): boolean {
  const env = input.env ?? {};
  const raw = (
    env.CHHLAT_APPROVAL_HOLD ??
    env.PHNEAKNGAR_APPROVAL_HOLD ??
    ""
  )
    .toString()
    .trim()
    .toLowerCase();

  if (raw === "0" || raw === "false" || raw === "no" || raw === "off") {
    return false;
  }
  if (raw === "1" || raw === "true" || raw === "yes" || raw === "on") {
    return true;
  }

  return readApprovalHoldPolicy(input.runtimeConfig).enabled;
}
