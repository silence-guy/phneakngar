/**
 * CLI tool permission gate.
 *
 * Wraps the shared approval-policy engine for agent control_request handling.
 * High-stakes tool classes are denied until a human approval path exists;
 * low-stakes tools and allow-listed names are allowed.
 */

import {
  ToolClass,
  evaluateApprovalPolicy,
  extractToolPermissionRequest,
  gateToolPermission,
  type ApprovalPolicyDecision,
  type ToolGateDecision,
} from "@phneakngar/shared";

export type { ToolGateDecision, ApprovalPolicyDecision };

export type CliToolGateOptions = {
  /** Tool names that never require approval (case-insensitive). */
  allowList?: readonly string[] | null;
  /** When true, always require approval (tests / strict mode). */
  forceRequire?: boolean;
  /** When true, always allow (operator override). */
  forceAllow?: boolean;
  /**
   * Default tool class when the payload has no tool name (legacy control_request
   * that only carries `{ input: '{"command":"ls"}' }`). Defaults to SHELL so
   * read-only command heuristics can still downgrade.
   */
  defaultToolClass?: string | null;
};

/**
 * Decide allow/deny for a Claude-style control_request payload.
 */
export function decideToolGate(
  payload: unknown,
  opts: CliToolGateOptions = {},
): ToolGateDecision {
  const { toolName } = extractToolPermissionRequest(payload);

  // Legacy payloads without tool_name only carry command input — treat as shell
  // so read-only heuristics (e.g. `ls`) can still auto-allow.
  const toolClass =
    toolName != null
      ? undefined
      : (opts.defaultToolClass ?? ToolClass.SHELL);

  return gateToolPermission(payload, {
    allowList: opts.allowList,
    forceRequire: opts.forceRequire,
    forceAllow: opts.forceAllow,
    toolClass,
  });
}

/**
 * Build the control_response JSON line for Claude stdin.
 */
export function buildControlResponseLine(
  requestId: string,
  behavior: "allow" | "deny",
  updatedInput: unknown,
  message?: string,
): string {
  const responseBody: Record<string, unknown> =
    behavior === "allow"
      ? {
          behavior: "allow",
          updatedInput,
        }
      : {
          behavior: "deny",
          message:
            message ??
            "This tool class requires human approval before it can run.",
        };

  return JSON.stringify({
    type: "control_response",
    response: {
      subtype: "success",
      request_id: requestId,
      response: responseBody,
    },
  });
}

/**
 * Resolve updatedInput the same way handleControlRequest historically did
 * (string JSON input → parsed object).
 */
export function resolveUpdatedInput(payload: unknown): unknown {
  const rec =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : null;
  if (!rec) return undefined;

  const input = rec.input;
  if (typeof input === "string") {
    try {
      return JSON.parse(input);
    } catch {
      return input;
    }
  }
  if (input !== undefined) return input;
  return undefined;
}

/**
 * Pure helper: given a control_request event, return the stdin line to write
 * (or null when request_id is missing).
 */
export function handleToolControlRequest(
  event: Record<string, unknown>,
  opts: CliToolGateOptions = {},
): { line: string; decision: ToolGateDecision } | null {
  const requestId = event.request_id as string | undefined;
  if (!requestId) return null;

  const payload = event.payload;
  const decision = decideToolGate(payload, opts);
  const updatedInput = resolveUpdatedInput(payload);
  const message = decision.requiresApproval
    ? `Blocked by approval policy (${decision.policy.reason}). High-stakes tool class "${decision.policy.toolClass}" requires human approval.`
    : undefined;
  const line = buildControlResponseLine(
    requestId,
    decision.behavior,
    updatedInput,
    message,
  );
  return { line, decision };
}

/** Re-export evaluate for callers that already extracted tool metadata. */
export { evaluateApprovalPolicy, extractToolPermissionRequest, gateToolPermission, ToolClass };
