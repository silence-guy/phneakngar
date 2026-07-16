import { describe, it, expect } from "vitest";
import {
  decideToolGate,
  buildControlResponseLine,
  handleToolControlRequest,
  resolveUpdatedInput,
} from "./tool-gate.js";

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

  it("builds allow line with updatedInput", () => {
    const line = buildControlResponseLine("r2", "allow", { command: "ls" });
    expect(JSON.parse(line).response.response).toEqual({
      behavior: "allow",
      updatedInput: { command: "ls" },
    });
  });
});
