/**
 * CLI tool permission gate.
 *
 * Wraps the shared approval-policy engine for agent control_request handling.
 * High-stakes tool classes are denied and (when configured) create a durable
 * tool_action approval pointer; low-stakes tools and allow-listed names are allowed.
 *
 * No hold/wait/resume-after-decide: deny is immediate; human decides later in web UI.
 */

import {
  ApprovalKind,
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

/** Input for creating a durable tool_action approval from a control_request. */
export type CreateToolActionApprovalInput = {
  toolName: string | null;
  toolClass: string;
  requestId: string;
  input: unknown;
  policyReason: string;
  /** Always tool_action for the CLI control_request bridge. */
  approvalKind: typeof ApprovalKind.TOOL_ACTION;
};

export type CreateToolActionApprovalResult = {
  approvalId: string;
};

/**
 * Injectable creator used by the CLI process to POST durable approvals.
 * Null means deny without a durable pointer (tests / unconfigured backends).
 */
export type ToolActionApprovalCreator = (
  input: CreateToolActionApprovalInput,
) => Promise<CreateToolActionApprovalResult | null>;

let toolActionApprovalCreator: ToolActionApprovalCreator | null = null;

/** Register (or clear) the process-level tool_action approval creator. */
export function setToolActionApprovalCreator(
  creator: ToolActionApprovalCreator | null,
): void {
  toolActionApprovalCreator = creator;
}

export function getToolActionApprovalCreator(): ToolActionApprovalCreator | null {
  return toolActionApprovalCreator;
}

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
  extras?: { approvalId?: string | null },
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

  if (behavior === "deny" && extras?.approvalId) {
    responseBody.approval_id = extras.approvalId;
  }

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

/** Default deny copy when approval is required (optional durable pointer). */
export function buildRequiresApprovalDenyMessage(
  decision: ToolGateDecision,
  approvalId?: string | null,
): string {
  const base = `Blocked by approval policy (${decision.policy.reason}). High-stakes tool class "${decision.policy.toolClass}" requires human approval.`;
  if (approvalId) {
    return `${base} Approval id: ${approvalId}.`;
  }
  return base;
}

/**
 * Pure draft for a tool_action approval row from a gated control_request.
 * Returns null when the event should not create an approval.
 */
export function buildToolActionApprovalRequest(
  event: Record<string, unknown>,
  decision: ToolGateDecision,
): CreateToolActionApprovalInput | null {
  if (!decision.requiresApproval) return null;
  const requestId = event.request_id;
  if (typeof requestId !== "string" || !requestId.trim()) return null;

  const { input } = extractToolPermissionRequest(event.payload);
  return {
    toolName: decision.toolName,
    toolClass: decision.policy.toolClass,
    requestId: requestId.trim(),
    input,
    policyReason: decision.policy.reason,
    approvalKind: ApprovalKind.TOOL_ACTION,
  };
}

export function defaultToolActionApprovalTitle(
  input: CreateToolActionApprovalInput,
): string {
  if (input.toolName) return `Tool: ${input.toolName}`;
  return `Tool class: ${input.toolClass}`;
}

export function defaultToolActionApprovalSummary(
  input: CreateToolActionApprovalInput,
): string {
  return input.policyReason;
}

/**
 * Pure helper: given a control_request event, return the stdin line to write
 * (or null when request_id is missing). Does not create durable approvals.
 */
export function handleToolControlRequest(
  event: Record<string, unknown>,
  opts: CliToolGateOptions = {},
): { line: string; decision: ToolGateDecision; approvalId?: string | null } | null {
  const requestId = event.request_id as string | undefined;
  if (!requestId) return null;

  const payload = event.payload;
  const decision = decideToolGate(payload, opts);
  const updatedInput = resolveUpdatedInput(payload);
  const message = decision.requiresApproval
    ? buildRequiresApprovalDenyMessage(decision)
    : undefined;
  const line = buildControlResponseLine(
    requestId,
    decision.behavior,
    updatedInput,
    message,
  );
  return { line, decision };
}

/**
 * Async gate: deny high-stakes tools and optionally create a durable tool_action
 * approval, embedding the approval id in the control_response deny pointer.
 * Never holds/waits for web decide — deny is always immediate.
 */
export async function handleToolControlRequestAsync(
  event: Record<string, unknown>,
  opts: CliToolGateOptions = {},
  createApproval: ToolActionApprovalCreator | null = toolActionApprovalCreator,
): Promise<
  { line: string; decision: ToolGateDecision; approvalId?: string | null } | null
> {
  const requestId = event.request_id as string | undefined;
  if (!requestId) return null;

  const payload = event.payload;
  const decision = decideToolGate(payload, opts);
  const updatedInput = resolveUpdatedInput(payload);

  let approvalId: string | null = null;
  if (decision.requiresApproval && createApproval) {
    const draft = buildToolActionApprovalRequest(event, decision);
    if (draft) {
      try {
        const created = await createApproval(draft);
        if (created?.approvalId && typeof created.approvalId === "string") {
          approvalId = created.approvalId;
        }
      } catch {
        // Fail open on the pointer only: still deny the tool without an id.
        approvalId = null;
      }
    }
  }

  const message = decision.requiresApproval
    ? buildRequiresApprovalDenyMessage(decision, approvalId)
    : undefined;
  const line = buildControlResponseLine(
    requestId,
    decision.behavior,
    updatedInput,
    message,
    { approvalId },
  );
  return { line, decision, approvalId };
}

/** Re-export evaluate for callers that already extracted tool metadata. */
export {
  evaluateApprovalPolicy,
  extractToolPermissionRequest,
  gateToolPermission,
  ToolClass,
  ApprovalKind,
};
