/**
 * CLI tool permission gate.
 *
 * Wraps the shared approval-policy engine for agent control_request handling.
 * High-stakes tool classes are denied and (when configured) create a durable
 * tool_action approval pointer; low-stakes tools and allow-listed names are allowed.
 *
 * Optional hold/resume: when hold opts are set, poll durable approval until
 * approved/denied/timeout, then emit allow or deny control_response.
 * Default remains immediate deny + approval_id pointer (stateless-friendly).
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

/** Poll terminal approval status for hold/resume. */
export type ApprovalStatusPoller = (
  approvalId: string,
) => Promise<{ status: string } | null>;

export type ToolControlHoldOptions = {
  /** When true, wait for web decide after creating approval. */
  enabled: boolean;
  /** Max wait ms (default 120_000). */
  timeoutMs?: number;
  /** Poll interval ms (default 2_000). */
  intervalMs?: number;
  poll: ApprovalStatusPoller;
  /** Inject sleep for tests. */
  sleep?: (ms: number) => Promise<void>;
  /** Inject now for tests. */
  now?: () => number;
};

export type ToolControlAsyncOptions = CliToolGateOptions & {
  hold?: ToolControlHoldOptions | null;
};

/**
 * Wait until approval is approved/denied/rejected or timeout.
 * Returns terminal status or "timeout".
 */
export async function waitForApprovalDecision(
  approvalId: string,
  hold: ToolControlHoldOptions,
): Promise<"approved" | "denied" | "rejected" | "timeout" | "error"> {
  const timeoutMs = hold.timeoutMs ?? 120_000;
  const intervalMs = hold.intervalMs ?? 2_000;
  const sleep = hold.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const now = hold.now ?? (() => Date.now());
  const deadline = now() + timeoutMs;

  while (now() < deadline) {
    try {
      const row = await hold.poll(approvalId);
      const status = (row?.status ?? "").trim().toLowerCase();
      if (status === "approved") return "approved";
      if (status === "denied" || status === "rejected") {
        return status === "rejected" ? "rejected" : "denied";
      }
    } catch {
      // keep polling until timeout
    }
    const remaining = deadline - now();
    if (remaining <= 0) break;
    await sleep(Math.min(intervalMs, remaining));
  }
  return "timeout";
}

/**
 * Async gate: for high-stakes tools create a durable tool_action approval.
 * Default: deny immediately with approval_id pointer.
 * With hold.enabled: poll until approve → allow, or deny/timeout → deny.
 */
export async function handleToolControlRequestAsync(
  event: Record<string, unknown>,
  opts: ToolControlAsyncOptions = {},
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

  // Optional hold/resume after durable approval exists.
  if (decision.requiresApproval && approvalId && opts.hold?.enabled) {
    const outcome = await waitForApprovalDecision(approvalId, opts.hold);
    if (outcome === "approved") {
      const allowLine = buildControlResponseLine(
        requestId,
        "allow",
        updatedInput,
      );
      return {
        line: allowLine,
        decision: { ...decision, behavior: "allow", requiresApproval: false },
        approvalId,
      };
    }
    const reason =
      outcome === "timeout"
        ? `Approval timed out (${opts.hold.timeoutMs ?? 120_000}ms).`
        : `Approval ${outcome}.`;
    const message = `${buildRequiresApprovalDenyMessage(decision, approvalId)} ${reason}`;
    const line = buildControlResponseLine(
      requestId,
      "deny",
      updatedInput,
      message,
      { approvalId },
    );
    return { line, decision, approvalId };
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
