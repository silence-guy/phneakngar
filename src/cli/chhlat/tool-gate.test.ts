import { describe, it, expect, afterEach } from "vitest";
import {
  decideToolGate,
  buildControlResponseLine,
  handleToolControlRequest,
  handleToolControlRequestAsync,
  resolveUpdatedInput,
  buildRequiresApprovalDenyMessage,
  buildToolActionApprovalRequest,
  setToolActionApprovalCreator,
  getToolActionApprovalCreator,
  ApprovalKind,
} from "./tool-gate.js";

afterEach(() => {
  setToolActionApprovalCreator(null);
});

describe("decideToolGate", () => {
  it("allows low-stakes tools", () => {
    const d = decideToolGate({ tool_name: "Read", input: { path: "a" } });
    expect(d.behavior).toBe("allow");
    expect(d.requiresApproval).toBe(false);
  });

  it("denies high-stakes tool classes", () => {
    const d = decideToolGate({
      tool_name: "send_email",
      input: { to: "x@y.z" },
    });
    expect(d.behavior).toBe("deny");
    expect(d.requiresApproval).toBe(true);

    expect(
      decideToolGate({ tool_name: "Bash", input: { command: "rm -rf /" } }).behavior,
    ).toBe("deny");
    expect(decideToolGate({ tool_name: "Write", input: { path: "x" } }).behavior).toBe(
      "deny",
    );
    expect(
      decideToolGate({ tool_name: "github_create_issue", input: { title: "t" } }).behavior,
    ).toBe("deny");
  });

  it("allow list bypasses high-stakes", () => {
    const d = decideToolGate(
      { tool_name: "Write", input: { path: "f" } },
      { allowList: ["Write"] },
    );
    expect(d.behavior).toBe("allow");
    expect(d.requiresApproval).toBe(false);
  });

  it("allow list is case-insensitive and does not bypass unmatched tools", () => {
    expect(
      decideToolGate(
        { tool_name: "Bash", input: { command: "rm x" } },
        { allowList: ["bash"] },
      ).behavior,
    ).toBe("allow");
    expect(
      decideToolGate(
        { tool_name: "Write", input: { path: "f" } },
        { allowList: ["Bash"] },
      ).behavior,
    ).toBe("deny");
  });

  it("treats legacy bare command input as shell and allows read-only ls", () => {
    const d = decideToolGate({ input: '{"command":"ls"}' });
    expect(d.behavior).toBe("allow");
  });

  it("denies legacy bare destructive shell command", () => {
    const d = decideToolGate({ input: '{"command":"rm -rf /tmp/x"}' });
    expect(d.behavior).toBe("deny");
  });

  it("forceAllow / forceRequire override class defaults", () => {
    expect(
      decideToolGate(
        { tool_name: "send_email" },
        { forceAllow: true },
      ).behavior,
    ).toBe("allow");
    expect(
      decideToolGate({ tool_name: "Read", input: { path: "a" } }, { forceRequire: true })
        .behavior,
    ).toBe("deny");
  });
});

describe("handleToolControlRequest", () => {
  it("returns null without request_id", () => {
    expect(handleToolControlRequest({ type: "control_request" })).toBeNull();
  });

  it("builds allow control_response for read-only shell", () => {
    const result = handleToolControlRequest({
      type: "control_request",
      request_id: "req_abc",
      payload: { input: '{"command":"ls"}' },
    });
    expect(result).not.toBeNull();
    expect(result!.decision.behavior).toBe("allow");
    const parsed = JSON.parse(result!.line);
    expect(parsed.type).toBe("control_response");
    expect(parsed.response.request_id).toBe("req_abc");
    expect(parsed.response.response.behavior).toBe("allow");
    expect(parsed.response.response.updatedInput).toEqual({ command: "ls" });
  });

  it("builds deny control_response for high-stakes tools", () => {
    const result = handleToolControlRequest({
      type: "control_request",
      request_id: "req_email",
      payload: { tool_name: "send_email", input: { to: "a@b.c" } },
    });
    expect(result).not.toBeNull();
    expect(result!.decision.behavior).toBe("deny");
    const parsed = JSON.parse(result!.line);
    expect(parsed.response.response.behavior).toBe("deny");
    expect(String(parsed.response.response.message)).toContain("approval");
    expect(String(parsed.response.response.message)).toContain("outbound_email");
    expect(parsed.response.response.approval_id).toBeUndefined();
  });

  it("deny message includes policy reason for shell", () => {
    const result = handleToolControlRequest({
      type: "control_request",
      request_id: "req_bash",
      payload: { tool_name: "Bash", input: { command: "rm -rf /tmp" } },
    });
    expect(result!.decision.behavior).toBe("deny");
    const parsed = JSON.parse(result!.line);
    expect(String(parsed.response.response.message)).toContain("high_stakes:shell");
  });
});

describe("handleToolControlRequestAsync + approval pointer", () => {
  it("creates durable tool_action approval and embeds approval id on deny", async () => {
    const calls: unknown[] = [];
    setToolActionApprovalCreator(async (input) => {
      calls.push(input);
      return { approvalId: "ap_tool_1" };
    });

    const result = await handleToolControlRequestAsync({
      type: "control_request",
      request_id: "req_write",
      payload: { tool_name: "Write", input: { path: "x.ts", content: "hi" } },
    });

    expect(result).not.toBeNull();
    expect(result!.decision.behavior).toBe("deny");
    expect(result!.approvalId).toBe("ap_tool_1");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      toolName: "Write",
      toolClass: "write",
      requestId: "req_write",
      approvalKind: ApprovalKind.TOOL_ACTION,
    });

    const parsed = JSON.parse(result!.line);
    expect(parsed.response.response.behavior).toBe("deny");
    expect(parsed.response.response.approval_id).toBe("ap_tool_1");
    expect(String(parsed.response.response.message)).toContain("Approval id: ap_tool_1");
  });

  it("still denies without approval id when creator is missing", async () => {
    expect(getToolActionApprovalCreator()).toBeNull();
    const result = await handleToolControlRequestAsync({
      type: "control_request",
      request_id: "req_bash",
      payload: { tool_name: "Bash", input: { command: "rm -rf /tmp" } },
    });
    expect(result!.decision.behavior).toBe("deny");
    expect(result!.approvalId).toBeNull();
    const parsed = JSON.parse(result!.line);
    expect(parsed.response.response.approval_id).toBeUndefined();
    expect(String(parsed.response.response.message)).not.toContain("Approval id:");
  });

  it("still denies when creator throws (fail open on pointer only)", async () => {
    setToolActionApprovalCreator(async () => {
      throw new Error("network down");
    });
    const result = await handleToolControlRequestAsync({
      type: "control_request",
      request_id: "req_net",
      payload: { tool_name: "http_request", input: { url: "https://x" } },
    });
    expect(result!.decision.behavior).toBe("deny");
    expect(result!.approvalId).toBeNull();
    const parsed = JSON.parse(result!.line);
    expect(parsed.response.response.approval_id).toBeUndefined();
  });

  it("does not create approval for allow decisions", async () => {
    let called = false;
    setToolActionApprovalCreator(async () => {
      called = true;
      return { approvalId: "ap_x" };
    });
    const result = await handleToolControlRequestAsync({
      type: "control_request",
      request_id: "req_ls",
      payload: { input: '{"command":"ls"}' },
    });
    expect(result!.decision.behavior).toBe("allow");
    expect(called).toBe(false);
  });

  it("buildToolActionApprovalRequest is pure and maps to tool_action", () => {
    const decision = decideToolGate({
      tool_name: "Bash",
      input: { command: "echo hi" },
    });
    // echo is read-only shell head → allow / no draft
    const allowDraft = buildToolActionApprovalRequest(
      { request_id: "r1", payload: { tool_name: "Bash", input: { command: "echo hi" } } },
      decision,
    );
    // force high-stakes
    const denyDecision = decideToolGate({
      tool_name: "Bash",
      input: { command: "rm -rf /tmp" },
    });
    const draft = buildToolActionApprovalRequest(
      {
        request_id: "r2",
        payload: { tool_name: "Bash", input: { command: "rm -rf /tmp" } },
      },
      denyDecision,
    );
    expect(allowDraft).toBeNull();
    expect(draft).toMatchObject({
      approvalKind: ApprovalKind.TOOL_ACTION,
      requestId: "r2",
      toolName: "Bash",
      toolClass: "shell",
    });
  });
});

describe("buildControlResponseLine / resolveUpdatedInput", () => {
  it("parses string input JSON", () => {
    expect(resolveUpdatedInput({ input: '{"command":"ls"}' })).toEqual({
      command: "ls",
    });
    expect(resolveUpdatedInput({ input: { command: "pwd" } })).toEqual({
      command: "pwd",
    });
    expect(resolveUpdatedInput({ input: "not-json{" })).toBe("not-json{");
  });

  it("builds deny line with message", () => {
    const line = buildControlResponseLine("r1", "deny", undefined, "nope");
    expect(JSON.parse(line).response.response).toEqual({
      behavior: "deny",
      message: "nope",
    });
  });

  it("builds deny line with approval_id pointer", () => {
    const line = buildControlResponseLine("r1", "deny", undefined, "nope", {
      approvalId: "ap_9",
    });
    expect(JSON.parse(line).response.response).toEqual({
      behavior: "deny",
      message: "nope",
      approval_id: "ap_9",
    });
  });

  it("builds allow line with updatedInput", () => {
    const line = buildControlResponseLine("r2", "allow", { command: "ls" });
    expect(JSON.parse(line).response.response).toEqual({
      behavior: "allow",
      updatedInput: { command: "ls" },
    });
  });

  it("buildRequiresApprovalDenyMessage includes optional id", () => {
    const decision = decideToolGate({
      tool_name: "Write",
      input: { path: "a" },
    });
    expect(buildRequiresApprovalDenyMessage(decision)).toContain("high_stakes:write");
    expect(buildRequiresApprovalDenyMessage(decision, "ap_1")).toContain(
      "Approval id: ap_1",
    );
  });
});
