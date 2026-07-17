/**
 * Shared approval policy engine for high-stakes tool classes.
 *
 * Pure / stateless: no I/O. Used by web decide paths and the CLI tool gate so
 * outbound email is not the only gated class.
 */

import { ApprovalKind, type ApprovalKindType } from "../constants";

/** Logical tool classes used by the policy engine. */
export const ToolClass = {
  READ: "read",
  SEARCH: "search",
  WRITE: "write",
  SHELL: "shell",
  NETWORK: "network",
  OUTBOUND_EMAIL: "outbound_email",
  TOOL_WRITEBACK: "tool_writeback",
  SKILL_INSTALL: "skill_install",
  AUTOMATION_PROMOTE: "automation_promote",
  UNKNOWN: "unknown",
} as const;

export type ToolClassType = (typeof ToolClass)[keyof typeof ToolClass];

/** Classes that require human approval by default. */
export const HIGH_STAKES_TOOL_CLASSES: ReadonlySet<ToolClassType> = new Set([
  ToolClass.WRITE,
  ToolClass.SHELL,
  ToolClass.NETWORK,
  ToolClass.OUTBOUND_EMAIL,
  ToolClass.TOOL_WRITEBACK,
  ToolClass.SKILL_INSTALL,
  ToolClass.AUTOMATION_PROMOTE,
]);

/** Classes that are auto-allowed (low-stakes) by default. */
export const LOW_STAKES_TOOL_CLASSES: ReadonlySet<ToolClassType> = new Set([
  ToolClass.READ,
  ToolClass.SEARCH,
]);

const TOOL_CLASS_VALUES = new Set<string>(Object.values(ToolClass));

/** Case-insensitive tool name → class. Keys stored lowercase. */
const TOOL_NAME_TO_CLASS: Record<string, ToolClassType> = {
  // Low-stakes reads / search
  read: ToolClass.READ,
  read_file: ToolClass.READ,
  readdir: ToolClass.READ,
  cat: ToolClass.READ,
  ls: ToolClass.READ,
  list: ToolClass.READ,
  glob: ToolClass.SEARCH,
  grep: ToolClass.SEARCH,
  search: ToolClass.SEARCH,
  websearch: ToolClass.SEARCH,
  web_search: ToolClass.SEARCH,
  webfetch: ToolClass.READ,
  web_fetch: ToolClass.READ,
  // Lean web-brain MCP / tool aliases (low-stakes public read/search)
  web_cache: ToolClass.READ,
  web_cache_search: ToolClass.SEARCH,
  web_extract: ToolClass.READ,
  web_crawl: ToolClass.SEARCH,
  web_diff: ToolClass.READ,
  mcp_web_search: ToolClass.SEARCH,
  mcp_web_fetch: ToolClass.READ,
  mcp_web_extract: ToolClass.READ,
  mcp_web_crawl: ToolClass.SEARCH,
  mcp_web_diff: ToolClass.READ,
  phneakngar_web_search: ToolClass.SEARCH,
  phneakngar_web_fetch: ToolClass.READ,
  phneakngar_web_extract: ToolClass.READ,
  phneakngar_web_crawl: ToolClass.SEARCH,
  phneakngar_web_diff: ToolClass.READ,
  get: ToolClass.READ,
  fetch: ToolClass.READ,

  // Local write / shell
  write: ToolClass.WRITE,
  write_file: ToolClass.WRITE,
  edit: ToolClass.WRITE,
  edit_file: ToolClass.WRITE,
  multiedit: ToolClass.WRITE,
  delete: ToolClass.WRITE,
  delete_file: ToolClass.WRITE,
  apply_patch: ToolClass.WRITE,
  bash: ToolClass.SHELL,
  shell: ToolClass.SHELL,
  terminal: ToolClass.SHELL,
  run_terminal_cmd: ToolClass.SHELL,
  execute: ToolClass.SHELL,

  // Network / external side effects
  http: ToolClass.NETWORK,
  http_request: ToolClass.NETWORK,
  curl: ToolClass.NETWORK,
  fetch_post: ToolClass.NETWORK,

  // Product high-stakes classes
  send_email: ToolClass.OUTBOUND_EMAIL,
  outbound_email: ToolClass.OUTBOUND_EMAIL,
  email_send: ToolClass.OUTBOUND_EMAIL,
  github_create_issue: ToolClass.TOOL_WRITEBACK,
  github_comment: ToolClass.TOOL_WRITEBACK,
  github_create_pr: ToolClass.TOOL_WRITEBACK,
  linear_create_issue: ToolClass.TOOL_WRITEBACK,
  linear_comment: ToolClass.TOOL_WRITEBACK,
  tool_writeback: ToolClass.TOOL_WRITEBACK,
  skill_install: ToolClass.SKILL_INSTALL,
  install_skill: ToolClass.SKILL_INSTALL,
  automation_promote: ToolClass.AUTOMATION_PROMOTE,
  promote_automation: ToolClass.AUTOMATION_PROMOTE,
};

const TOOL_CLASS_TO_APPROVAL_KIND: Partial<Record<ToolClassType, ApprovalKindType>> = {
  [ToolClass.OUTBOUND_EMAIL]: ApprovalKind.OUTBOUND_EMAIL,
  [ToolClass.TOOL_WRITEBACK]: ApprovalKind.TOOL_ACTION,
  [ToolClass.WRITE]: ApprovalKind.TOOL_ACTION,
  [ToolClass.SHELL]: ApprovalKind.TOOL_ACTION,
  [ToolClass.NETWORK]: ApprovalKind.TOOL_ACTION,
  [ToolClass.SKILL_INSTALL]: ApprovalKind.SKILL_INSTALL,
  [ToolClass.AUTOMATION_PROMOTE]: ApprovalKind.AUTOMATION_PROMOTE,
};

/**
 * Shell commands treated as read-only when the tool class would otherwise be SHELL.
 * Used only as a soft downgrade; allowList still wins for high-stakes.
 */
const READ_ONLY_SHELL_HEAD =
  /^(?:ls|pwd|cat|head|tail|echo|which|type|env|printenv|date|whoami|id|uname|file|stat|wc|true|false|basename|dirname|realpath|readlink)\b/;

export type ApprovalPolicyInput = {
  /** Explicit tool name (e.g. "Bash", "send_email"). */
  toolName?: string | null;
  /** Pre-classified tool class; wins over toolName when set to a known class. */
  toolClass?: string | null;
  /** Approval kind string (outbound_email, tool_action, …). */
  kind?: string | null;
  /** Tool / command input payload for heuristics (e.g. shell command). */
  input?: unknown;
  /** Force require approval regardless of class. */
  forceRequire?: boolean;
  /** Force allow (no approval) regardless of class. */
  forceAllow?: boolean;
  /**
   * Tool names (case-insensitive) that never require approval even if
   * classified high-stakes. Empty/undefined = no bypass names.
   */
  allowList?: readonly string[] | null;
};

export type ApprovalPolicyDecision = {
  requiresApproval: boolean;
  toolClass: ToolClassType;
  /** Mapped approval kind when approval is (or would be) required; null for low-stakes. */
  approvalKind: ApprovalKindType | null;
  reason: string;
  /** True when the tool class is low-stakes by default. */
  lowStakes: boolean;
  /** True when allowList caused a high-stakes bypass. */
  allowListed: boolean;
};

function normalizeName(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Extract a shell-like command string from common tool input shapes. */
export function extractCommandFromInput(input: unknown): string | null {
  if (typeof input === "string") {
    const t = input.trim();
    return t || null;
  }
  const rec = asRecord(input);
  if (!rec) return null;
  for (const key of ["command", "cmd", "script", "code"] as const) {
    const v = rec[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/**
 * Classify a free-form tool name into a ToolClass.
 * Unknown names stay UNKNOWN (fail-open for agent ergonomics).
 */
export function classifyToolName(toolName?: string | null): ToolClassType {
  const key = normalizeName(toolName);
  if (!key) return ToolClass.UNKNOWN;
  if (TOOL_NAME_TO_CLASS[key]) return TOOL_NAME_TO_CLASS[key];

  // Prefix / contains heuristics for MCP-style names (github__create_issue, mcp_linear_create)
  if (/(^|[_-])(send[_-]?email|outbound[_-]?email)([_-]|$)/.test(key)) {
    return ToolClass.OUTBOUND_EMAIL;
  }
  if (/(github|linear|jira|notion|slack[_-]?post)/.test(key) && /(create|write|comment|update|delete|post|merge)/.test(key)) {
    return ToolClass.TOOL_WRITEBACK;
  }
  if (/(skill).*(install)|(^|[_-])install[_-]?skill([_-]|$)/.test(key)) {
    return ToolClass.SKILL_INSTALL;
  }
  if (/(^|[_-])(bash|shell|terminal)([_-]|$)/.test(key)) {
    return ToolClass.SHELL;
  }
  if (/(^|[_-])(write|edit|delete|apply[_-]?patch)([_-]|$)/.test(key)) {
    return ToolClass.WRITE;
  }
  if (/(^|[_-])(read|cat|ls|glob|grep|search)([_-]|$)/.test(key)) {
    return key.includes("search") || key.includes("grep") || key.includes("glob")
      ? ToolClass.SEARCH
      : ToolClass.READ;
  }
  // phneakngar web-brain / wigolo-style MCP names: public web read/search
  if (
    /(web[_-]?(search|fetch|cache|extract|crawl|diff)|wigolo__(search|fetch|crawl|extract|diff))/.test(
      key,
    )
  ) {
    return key.includes("search") || key.includes("crawl")
      ? ToolClass.SEARCH
      : ToolClass.READ;
  }
  return ToolClass.UNKNOWN;
}

/** Normalize an explicit toolClass string; falls back to UNKNOWN. */
export function normalizeToolClass(toolClass?: string | null): ToolClassType {
  const key = normalizeName(toolClass);
  if (TOOL_CLASS_VALUES.has(key)) return key as ToolClassType;
  return ToolClass.UNKNOWN;
}

/**
 * Map a tool class to the durable approval.kind used in D1.
 * Low-stakes / unknown → null.
 */
export function mapToolClassToApprovalKind(
  toolClass: ToolClassType,
): ApprovalKindType | null {
  return TOOL_CLASS_TO_APPROVAL_KIND[toolClass] ?? null;
}

/** Approval kinds that run external side effects on decide (today: outbound email). */
export function approvalKindRequiresSideEffect(kind: string | null | undefined): boolean {
  return normalizeName(kind) === ApprovalKind.OUTBOUND_EMAIL;
}

export function isHighStakesToolClass(toolClass: ToolClassType): boolean {
  return HIGH_STAKES_TOOL_CLASSES.has(toolClass);
}

export function isToolAllowListed(
  toolName: string | null | undefined,
  allowList?: readonly string[] | null,
): boolean {
  if (!allowList || allowList.length === 0) return false;
  const key = normalizeName(toolName);
  if (!key) return false;
  return allowList.some((entry) => normalizeName(entry) === key);
}

/**
 * Optionally downgrade SHELL → READ when the command looks read-only
 * (no pipes, redirects, chains, or dangerous tokens).
 */
export function maybeDowngradeShellClass(
  toolClass: ToolClassType,
  input: unknown,
): ToolClassType {
  if (toolClass !== ToolClass.SHELL) return toolClass;
  const cmd = extractCommandFromInput(input);
  if (!cmd) return toolClass;
  // Reject multi-command / redirection / substitution patterns.
  if (/[|;&><`$]/.test(cmd) || /\n/.test(cmd)) return toolClass;
  if (READ_ONLY_SHELL_HEAD.test(cmd)) return ToolClass.READ;
  return toolClass;
}

function classFromKind(kind: string | null | undefined): ToolClassType | null {
  const k = normalizeName(kind);
  if (!k) return null;
  if (k === ApprovalKind.OUTBOUND_EMAIL) return ToolClass.OUTBOUND_EMAIL;
  if (k === ApprovalKind.SKILL_INSTALL) return ToolClass.SKILL_INSTALL;
  if (k === ApprovalKind.AUTOMATION_PROMOTE) return ToolClass.AUTOMATION_PROMOTE;
  if (k === ApprovalKind.TOOL_ACTION) return ToolClass.TOOL_WRITEBACK;
  return null;
}

/**
 * Evaluate whether a tool invocation / product action requires human approval.
 *
 * Precedence:
 * 1. forceAllow → never require
 * 2. forceRequire → always require
 * 3. allowList match on toolName → never require
 * 4. high-stakes tool class → require
 * 5. otherwise allow (low-stakes / unknown)
 */
export function evaluateApprovalPolicy(
  input: ApprovalPolicyInput = {},
): ApprovalPolicyDecision {
  let toolClass: ToolClassType = ToolClass.UNKNOWN;

  if (input.toolClass) {
    const normalized = normalizeToolClass(input.toolClass);
    toolClass = normalized !== ToolClass.UNKNOWN ? normalized : classifyToolName(input.toolClass);
  } else if (input.kind) {
    toolClass = classFromKind(input.kind) ?? ToolClass.UNKNOWN;
  } else if (input.toolName) {
    toolClass = classifyToolName(input.toolName);
  }

  toolClass = maybeDowngradeShellClass(toolClass, input.input);

  const allowListed = isToolAllowListed(input.toolName, input.allowList);
  const lowStakes = LOW_STAKES_TOOL_CLASSES.has(toolClass);
  const approvalKind = mapToolClassToApprovalKind(toolClass);

  if (input.forceAllow) {
    return {
      requiresApproval: false,
      toolClass,
      approvalKind: null,
      reason: "forceAllow",
      lowStakes,
      allowListed,
    };
  }

  if (input.forceRequire) {
    return {
      requiresApproval: true,
      toolClass,
      approvalKind: approvalKind ?? ApprovalKind.TOOL_ACTION,
      reason: "forceRequire",
      lowStakes,
      allowListed,
    };
  }

  if (allowListed) {
    return {
      requiresApproval: false,
      toolClass,
      approvalKind: null,
      reason: "allowList",
      lowStakes,
      allowListed: true,
    };
  }

  if (isHighStakesToolClass(toolClass)) {
    return {
      requiresApproval: true,
      toolClass,
      approvalKind: approvalKind ?? ApprovalKind.TOOL_ACTION,
      reason: `high_stakes:${toolClass}`,
      lowStakes: false,
      allowListed: false,
    };
  }

  return {
    requiresApproval: false,
    toolClass,
    approvalKind: null,
    reason: lowStakes ? `low_stakes:${toolClass}` : `default_allow:${toolClass}`,
    lowStakes,
    allowListed: false,
  };
}

/**
 * CLI / control_request gate decision.
 * High-stakes tools that require approval are denied until a human path exists;
 * low-stakes and allow-listed tools are allowed.
 */
export type ToolGateBehavior = "allow" | "deny";

export type ToolGateDecision = {
  behavior: ToolGateBehavior;
  requiresApproval: boolean;
  policy: ApprovalPolicyDecision;
  toolName: string | null;
};

/**
 * Extract tool name + input from Claude-style control_request payloads.
 * Accepts both nested `{ tool_name, input }` and loose shapes.
 */
export function extractToolPermissionRequest(payload: unknown): {
  toolName: string | null;
  input: unknown;
} {
  const rec = asRecord(payload);
  if (!rec) return { toolName: null, input: undefined };

  const toolNameRaw =
    rec.tool_name ?? rec.toolName ?? rec.name ?? rec.tool ?? null;
  const toolName =
    typeof toolNameRaw === "string" && toolNameRaw.trim()
      ? toolNameRaw.trim()
      : null;

  let input: unknown = rec.input ?? rec.tool_input ?? rec.args ?? undefined;
  if (typeof input === "string") {
    try {
      input = JSON.parse(input);
    } catch {
      // keep string
    }
  }

  return { toolName, input };
}

/**
 * Gate a tool permission request for the CLI agent backends.
 * Returns allow for low-stakes / allow-listed; deny when approval is required
 * (human queue integration can later upgrade deny → hold).
 */
export function gateToolPermission(
  payload: unknown,
  opts?: {
    allowList?: readonly string[] | null;
    forceRequire?: boolean;
    forceAllow?: boolean;
    toolClass?: string | null;
    kind?: string | null;
  },
): ToolGateDecision {
  const { toolName, input } = extractToolPermissionRequest(payload);
  const policy = evaluateApprovalPolicy({
    toolName,
    input,
    allowList: opts?.allowList,
    forceRequire: opts?.forceRequire,
    forceAllow: opts?.forceAllow,
    toolClass: opts?.toolClass,
    kind: opts?.kind,
  });

  return {
    behavior: policy.requiresApproval ? "deny" : "allow",
    requiresApproval: policy.requiresApproval,
    policy,
    toolName,
  };
}
