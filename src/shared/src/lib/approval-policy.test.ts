import { describe, it, expect } from "vitest";
import { ApprovalKind } from "../constants";
import {
  ToolClass,
  HIGH_STAKES_TOOL_CLASSES,
  LOW_STAKES_TOOL_CLASSES,
  classifyToolName,
  evaluateApprovalPolicy,
  gateToolPermission,
  extractToolPermissionRequest,
  extractCommandFromInput,
  mapToolClassToApprovalKind,
  approvalKindRequiresSideEffect,
  maybeDowngradeShellClass,
  isToolAllowListed,
  isHighStakesToolClass,
  normalizeToolClass,
} from "./approval-policy";

describe("classifyToolName", () => {
  it("classifies read/search as low-stakes classes", () => {
    expect(classifyToolName("Read")).toBe(ToolClass.READ);
    expect(classifyToolName("grep")).toBe(ToolClass.SEARCH);
    expect(classifyToolName("Glob")).toBe(ToolClass.SEARCH);
    expect(classifyToolName("web_search")).toBe(ToolClass.SEARCH);
    expect(classifyToolName("WebFetch")).toBe(ToolClass.READ);
  });

  it("classifies write/shell/email/writeback as high-stakes classes", () => {
    expect(classifyToolName("Write")).toBe(ToolClass.WRITE);
    expect(classifyToolName("Bash")).toBe(ToolClass.SHELL);
    expect(classifyToolName("send_email")).toBe(ToolClass.OUTBOUND_EMAIL);
    expect(classifyToolName("email_send")).toBe(ToolClass.OUTBOUND_EMAIL);
    expect(classifyToolName("github_create_issue")).toBe(ToolClass.TOOL_WRITEBACK);
    expect(classifyToolName("skill_install")).toBe(ToolClass.SKILL_INSTALL);
    expect(classifyToolName("install_skill")).toBe(ToolClass.SKILL_INSTALL);
    expect(classifyToolName("automation_promote")).toBe(ToolClass.AUTOMATION_PROMOTE);
    expect(classifyToolName("promote_automation")).toBe(ToolClass.AUTOMATION_PROMOTE);
    expect(classifyToolName("http_request")).toBe(ToolClass.NETWORK);
    expect(classifyToolName("curl")).toBe(ToolClass.NETWORK);
  });

  it("uses heuristics for MCP-style names", () => {
    expect(classifyToolName("mcp_github_create_issue")).toBe(ToolClass.TOOL_WRITEBACK);
    expect(classifyToolName("linear__comment_on_issue")).toBe(ToolClass.TOOL_WRITEBACK);
    expect(classifyToolName("mcp_send_email_v2")).toBe(ToolClass.OUTBOUND_EMAIL);
    expect(classifyToolName("agent_bash_runner")).toBe(ToolClass.SHELL);
  });

  it("returns unknown for empty/unrecognized names", () => {
    expect(classifyToolName("")).toBe(ToolClass.UNKNOWN);
    expect(classifyToolName(null)).toBe(ToolClass.UNKNOWN);
    expect(classifyToolName("custom_widget_ping")).toBe(ToolClass.UNKNOWN);
    expect(classifyToolName("github_get_issue")).toBe(ToolClass.UNKNOWN);
  });
});

describe("evaluateApprovalPolicy", () => {
  it("requires approval for high-stakes tool classes", () => {
    const d = evaluateApprovalPolicy({ toolName: "send_email" });
    expect(d.requiresApproval).toBe(true);
    expect(d.toolClass).toBe(ToolClass.OUTBOUND_EMAIL);
    expect(d.approvalKind).toBe(ApprovalKind.OUTBOUND_EMAIL);
    expect(d.reason).toContain("high_stakes");
  });

  it("requires approval for every high-stakes tool class", () => {
    for (const toolClass of HIGH_STAKES_TOOL_CLASSES) {
      const d = evaluateApprovalPolicy({ toolClass });
      expect(d.requiresApproval, toolClass).toBe(true);
      expect(d.lowStakes, toolClass).toBe(false);
      expect(d.approvalKind, toolClass).not.toBeNull();
    }
  });

  it("requires approval for tool write-back and shell", () => {
    expect(evaluateApprovalPolicy({ toolName: "github_create_issue" }).requiresApproval).toBe(
      true,
    );
    expect(evaluateApprovalPolicy({ toolName: "Bash", input: { command: "rm -rf /" } }).requiresApproval).toBe(
      true,
    );
    expect(evaluateApprovalPolicy({ toolClass: ToolClass.WRITE }).requiresApproval).toBe(true);
    expect(evaluateApprovalPolicy({ toolClass: ToolClass.NETWORK }).requiresApproval).toBe(true);
    expect(evaluateApprovalPolicy({ toolClass: ToolClass.AUTOMATION_PROMOTE }).approvalKind).toBe(
      ApprovalKind.AUTOMATION_PROMOTE,
    );
  });

  it("allows low-stakes tool classes without approval", () => {
    const d = evaluateApprovalPolicy({ toolName: "Read" });
    expect(d.requiresApproval).toBe(false);
    expect(d.lowStakes).toBe(true);
    expect(d.approvalKind).toBeNull();

    for (const toolClass of LOW_STAKES_TOOL_CLASSES) {
      const low = evaluateApprovalPolicy({ toolClass });
      expect(low.requiresApproval, toolClass).toBe(false);
      expect(low.lowStakes, toolClass).toBe(true);
    }
  });

  it("allow list bypasses high-stakes tools (not low-stakes only)", () => {
    const d = evaluateApprovalPolicy({
      toolName: "Bash",
      input: { command: "rm -rf tmp" },
      allowList: ["Bash"],
    });
    expect(d.requiresApproval).toBe(false);
    expect(d.allowListed).toBe(true);
    expect(d.reason).toBe("allowList");
    // Class remains high-stakes; allowlist only skips the approval requirement.
    expect(d.toolClass).toBe(ToolClass.SHELL);
  });

  it("allow list miss still requires approval for high-stakes", () => {
    const d = evaluateApprovalPolicy({
      toolName: "Write",
      allowList: ["Bash", "Read"],
    });
    expect(d.requiresApproval).toBe(true);
    expect(d.allowListed).toBe(false);
  });

  it("forceRequire wins over low-stakes", () => {
    const d = evaluateApprovalPolicy({ toolName: "Read", forceRequire: true });
    expect(d.requiresApproval).toBe(true);
    expect(d.reason).toBe("forceRequire");
  });

  it("forceAllow wins over high-stakes and forceRequire", () => {
    const d = evaluateApprovalPolicy({
      toolName: "send_email",
      forceAllow: true,
      forceRequire: true,
    });
    expect(d.requiresApproval).toBe(false);
    expect(d.reason).toBe("forceAllow");
  });

  it("maps approval kind to tool class", () => {
    const d = evaluateApprovalPolicy({ kind: ApprovalKind.SKILL_INSTALL });
    expect(d.requiresApproval).toBe(true);
    expect(d.toolClass).toBe(ToolClass.SKILL_INSTALL);
    expect(d.approvalKind).toBe(ApprovalKind.SKILL_INSTALL);

    expect(evaluateApprovalPolicy({ kind: ApprovalKind.TOOL_ACTION }).toolClass).toBe(
      ToolClass.TOOL_WRITEBACK,
    );
    expect(evaluateApprovalPolicy({ kind: ApprovalKind.AUTOMATION_PROMOTE }).toolClass).toBe(
      ToolClass.AUTOMATION_PROMOTE,
    );
  });

  it("prefers explicit toolClass over toolName and kind", () => {
    const d = evaluateApprovalPolicy({
      toolClass: ToolClass.READ,
      toolName: "send_email",
      kind: ApprovalKind.OUTBOUND_EMAIL,
    });
    expect(d.toolClass).toBe(ToolClass.READ);
    expect(d.requiresApproval).toBe(false);
  });

  it("defaults unknown tools to allow (fail-open)", () => {
    const d = evaluateApprovalPolicy({ toolName: "custom_widget_ping" });
    expect(d.toolClass).toBe(ToolClass.UNKNOWN);
    expect(d.requiresApproval).toBe(false);
    expect(d.reason).toBe("default_allow:unknown");
  });

  it("downgrades read-only shell commands to low-stakes", () => {
    const d = evaluateApprovalPolicy({
      toolName: "Bash",
      input: { command: "ls -la" },
    });
    expect(d.toolClass).toBe(ToolClass.READ);
    expect(d.requiresApproval).toBe(false);
  });

  it("does not downgrade destructive shell commands", () => {
    const d = evaluateApprovalPolicy({
      toolName: "shell",
      input: { command: "rm -rf dist" },
    });
    expect(d.toolClass).toBe(ToolClass.SHELL);
    expect(d.requiresApproval).toBe(true);
  });

  it("does not downgrade shell with pipes, redirects, or chains", () => {
    for (const command of ["ls | wc", "cat a > b", "ls; rm -rf x", "echo $(whoami)", "ls && rm x"]) {
      const d = evaluateApprovalPolicy({ toolName: "Bash", input: { command } });
      expect(d.toolClass, command).toBe(ToolClass.SHELL);
      expect(d.requiresApproval, command).toBe(true);
    }
  });
});

describe("gateToolPermission", () => {
  it("allows low-stakes permission requests", () => {
    const g = gateToolPermission({ tool_name: "Read", input: { path: "/tmp/a" } });
    expect(g.behavior).toBe("allow");
    expect(g.requiresApproval).toBe(false);
  });

  it("denies high-stakes tool classes pending human approval", () => {
    const g = gateToolPermission({
      tool_name: "send_email",
      input: { to: "a@b.com", subject: "hi" },
    });
    expect(g.behavior).toBe("deny");
    expect(g.requiresApproval).toBe(true);
    expect(g.policy.approvalKind).toBe(ApprovalKind.OUTBOUND_EMAIL);
  });

  it("allow list bypasses deny for high-stakes", () => {
    const g = gateToolPermission(
      { tool_name: "Write", input: { path: "x" } },
      { allowList: ["Write"] },
    );
    expect(g.behavior).toBe("allow");
    expect(g.requiresApproval).toBe(false);
  });

  it("parses stringified input on control_request payloads", () => {
    const extracted = extractToolPermissionRequest({
      tool_name: "Bash",
      input: '{"command":"ls"}',
    });
    expect(extracted.toolName).toBe("Bash");
    expect(extracted.input).toEqual({ command: "ls" });

    const g = gateToolPermission({
      tool_name: "Bash",
      input: '{"command":"ls"}',
    });
    expect(g.behavior).toBe("allow");
  });

  it("allows bare input without tool name when command is read-only (legacy control_request)", () => {
    // handleControlRequest historically only had { input }; shell downgrade needs a shell class.
    const g = gateToolPermission(
      { input: '{"command":"ls"}' },
      { toolClass: ToolClass.SHELL },
    );
    expect(g.behavior).toBe("allow");
  });

  it("accepts alternate tool name and input field shapes", () => {
    expect(extractToolPermissionRequest({ toolName: "Grep", tool_input: { pattern: "x" } })).toEqual({
      toolName: "Grep",
      input: { pattern: "x" },
    });
    expect(extractToolPermissionRequest({ name: "Read", args: { path: "a" } }).toolName).toBe(
      "Read",
    );
    expect(extractToolPermissionRequest({ tool: "Bash", input: { cmd: "pwd" } }).toolName).toBe(
      "Bash",
    );

    const g = gateToolPermission({ name: "Write", args: { path: "f" } });
    expect(g.behavior).toBe("deny");
    expect(g.toolName).toBe("Write");
  });
});

describe("helpers", () => {
  it("mapToolClassToApprovalKind", () => {
    expect(mapToolClassToApprovalKind(ToolClass.OUTBOUND_EMAIL)).toBe(
      ApprovalKind.OUTBOUND_EMAIL,
    );
    expect(mapToolClassToApprovalKind(ToolClass.TOOL_WRITEBACK)).toBe(
      ApprovalKind.TOOL_ACTION,
    );
    expect(mapToolClassToApprovalKind(ToolClass.SHELL)).toBe(ApprovalKind.TOOL_ACTION);
    expect(mapToolClassToApprovalKind(ToolClass.SKILL_INSTALL)).toBe(ApprovalKind.SKILL_INSTALL);
    expect(mapToolClassToApprovalKind(ToolClass.READ)).toBeNull();
    expect(mapToolClassToApprovalKind(ToolClass.UNKNOWN)).toBeNull();
  });

  it("approvalKindRequiresSideEffect only for outbound email", () => {
    expect(approvalKindRequiresSideEffect(ApprovalKind.OUTBOUND_EMAIL)).toBe(true);
    expect(approvalKindRequiresSideEffect("OUTBOUND_EMAIL")).toBe(true);
    expect(approvalKindRequiresSideEffect(ApprovalKind.TOOL_ACTION)).toBe(false);
    expect(approvalKindRequiresSideEffect(ApprovalKind.SKILL_INSTALL)).toBe(false);
    expect(approvalKindRequiresSideEffect(null)).toBe(false);
  });

  it("isToolAllowListed is case-insensitive", () => {
    expect(isToolAllowListed("Bash", ["bash", "Write"])).toBe(true);
    expect(isToolAllowListed("  Write  ", ["write"])).toBe(true);
    expect(isToolAllowListed("Grep", ["bash"])).toBe(false);
    expect(isToolAllowListed("Bash", [])).toBe(false);
    expect(isToolAllowListed(null, ["Bash"])).toBe(false);
  });

  it("maybeDowngradeShellClass leaves non-shell classes alone", () => {
    expect(maybeDowngradeShellClass(ToolClass.WRITE, { command: "ls" })).toBe(
      ToolClass.WRITE,
    );
  });

  it("extractCommandFromInput supports common keys and raw strings", () => {
    expect(extractCommandFromInput("  ls -la  ")).toBe("ls -la");
    expect(extractCommandFromInput({ command: "pwd" })).toBe("pwd");
    expect(extractCommandFromInput({ cmd: "date" })).toBe("date");
    expect(extractCommandFromInput({ script: "whoami" })).toBe("whoami");
    expect(extractCommandFromInput({ code: "true" })).toBe("true");
    expect(extractCommandFromInput({ path: "nope" })).toBeNull();
    expect(extractCommandFromInput(null)).toBeNull();
  });

  it("normalizeToolClass and isHighStakesToolClass", () => {
    expect(normalizeToolClass("SHELL")).toBe(ToolClass.SHELL);
    expect(normalizeToolClass("  network ")).toBe(ToolClass.NETWORK);
    expect(normalizeToolClass("not-a-class")).toBe(ToolClass.UNKNOWN);
    expect(isHighStakesToolClass(ToolClass.OUTBOUND_EMAIL)).toBe(true);
    expect(isHighStakesToolClass(ToolClass.READ)).toBe(false);
  });
});
