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
import { ApprovalKind, ToolClass, evaluateApprovalPolicy, extractToolPermissionRequest, gateToolPermission, } from "@phneakngar/shared";
let toolActionApprovalCreator = null;
/** Register (or clear) the process-level tool_action approval creator. */
export function setToolActionApprovalCreator(creator) {
    toolActionApprovalCreator = creator;
}
export function getToolActionApprovalCreator() {
    return toolActionApprovalCreator;
}
/**
 * Decide allow/deny for a Claude-style control_request payload.
 */
export function decideToolGate(payload, opts = {}) {
    const { toolName } = extractToolPermissionRequest(payload);
    // Legacy payloads without tool_name only carry command input — treat as shell
    // so read-only heuristics (e.g. `ls`) can still auto-allow.
    const toolClass = toolName != null
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
export function buildControlResponseLine(requestId, behavior, updatedInput, message, extras) {
    const responseBody = behavior === "allow"
        ? {
            behavior: "allow",
            updatedInput,
        }
        : {
            behavior: "deny",
            message: message ??
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
export function resolveUpdatedInput(payload) {
    const rec = payload && typeof payload === "object" && !Array.isArray(payload)
        ? payload
        : null;
    if (!rec)
        return undefined;
    const input = rec.input;
    if (typeof input === "string") {
        try {
            return JSON.parse(input);
        }
        catch {
            return input;
        }
    }
    if (input !== undefined)
        return input;
    return undefined;
}
/** Default deny copy when approval is required (optional durable pointer). */
export function buildRequiresApprovalDenyMessage(decision, approvalId) {
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
export function buildToolActionApprovalRequest(event, decision) {
    if (!decision.requiresApproval)
        return null;
    const requestId = event.request_id;
    if (typeof requestId !== "string" || !requestId.trim())
        return null;
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
export function defaultToolActionApprovalTitle(input) {
    if (input.toolName)
        return `Tool: ${input.toolName}`;
    return `Tool class: ${input.toolClass}`;
}
export function defaultToolActionApprovalSummary(input) {
    return input.policyReason;
}
/**
 * Pure helper: given a control_request event, return the stdin line to write
 * (or null when request_id is missing). Does not create durable approvals.
 */
export function handleToolControlRequest(event, opts = {}) {
    const requestId = event.request_id;
    if (!requestId)
        return null;
    const payload = event.payload;
    const decision = decideToolGate(payload, opts);
    const updatedInput = resolveUpdatedInput(payload);
    const message = decision.requiresApproval
        ? buildRequiresApprovalDenyMessage(decision)
        : undefined;
    const line = buildControlResponseLine(requestId, decision.behavior, updatedInput, message);
    return { line, decision };
}
/**
 * Wait until approval is approved/denied/rejected or timeout.
 * Returns terminal status or "timeout".
 */
export async function waitForApprovalDecision(approvalId, hold) {
    const timeoutMs = hold.timeoutMs ?? 120_000;
    const intervalMs = hold.intervalMs ?? 2_000;
    const sleep = hold.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    const now = hold.now ?? (() => Date.now());
    const deadline = now() + timeoutMs;
    while (now() < deadline) {
        try {
            const row = await hold.poll(approvalId);
            const status = (row?.status ?? "").trim().toLowerCase();
            if (status === "approved")
                return "approved";
            if (status === "denied" || status === "rejected") {
                return status === "rejected" ? "rejected" : "denied";
            }
        }
        catch {
            // keep polling until timeout
        }
        const remaining = deadline - now();
        if (remaining <= 0)
            break;
        await sleep(Math.min(intervalMs, remaining));
    }
    return "timeout";
}
/**
 * Async gate: for high-stakes tools create a durable tool_action approval.
 * Default: deny immediately with approval_id pointer.
 * With hold.enabled: poll until approve → allow, or deny/timeout → deny.
 */
export async function handleToolControlRequestAsync(event, opts = {}, createApproval = toolActionApprovalCreator) {
    const requestId = event.request_id;
    if (!requestId)
        return null;
    const payload = event.payload;
    const decision = decideToolGate(payload, opts);
    const updatedInput = resolveUpdatedInput(payload);
    let approvalId = null;
    if (decision.requiresApproval && createApproval) {
        const draft = buildToolActionApprovalRequest(event, decision);
        if (draft) {
            try {
                const created = await createApproval(draft);
                if (created?.approvalId && typeof created.approvalId === "string") {
                    approvalId = created.approvalId;
                }
            }
            catch {
                // Fail open on the pointer only: still deny the tool without an id.
                approvalId = null;
            }
        }
    }
    // Optional hold/resume after durable approval exists.
    if (decision.requiresApproval && approvalId && opts.hold?.enabled) {
        const outcome = await waitForApprovalDecision(approvalId, opts.hold);
        if (outcome === "approved") {
            const allowLine = buildControlResponseLine(requestId, "allow", updatedInput);
            return {
                line: allowLine,
                decision: { ...decision, behavior: "allow", requiresApproval: false },
                approvalId,
            };
        }
        const reason = outcome === "timeout"
            ? `Approval timed out (${opts.hold.timeoutMs ?? 120_000}ms).`
            : `Approval ${outcome}.`;
        const message = `${buildRequiresApprovalDenyMessage(decision, approvalId)} ${reason}`;
        const line = buildControlResponseLine(requestId, "deny", updatedInput, message, { approvalId });
        return { line, decision, approvalId };
    }
    const message = decision.requiresApproval
        ? buildRequiresApprovalDenyMessage(decision, approvalId)
        : undefined;
    const line = buildControlResponseLine(requestId, decision.behavior, updatedInput, message, { approvalId });
    return { line, decision, approvalId };
}
/** Re-export evaluate for callers that already extracted tool metadata. */
export { evaluateApprovalPolicy, extractToolPermissionRequest, gateToolPermission, ToolClass, ApprovalKind, };
