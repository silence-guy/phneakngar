import { describe, expect, it } from "vitest";
import {
  APPROVALS_LABELS,
  approvalKindLabel,
  approvalPayloadSummary,
  outboundApprovalMeta,
  parseOutboundToFromSummary,
} from "./approvals-labels";

const KHMER = /[ក-៿]/;

describe("APPROVALS_LABELS", () => {
  it("provides Khmer surface labels", () => {
    expect(APPROVALS_LABELS.title).toMatch(KHMER);
    expect(APPROVALS_LABELS.approve).toMatch(KHMER);
    expect(APPROVALS_LABELS.reject).toMatch(KHMER);
    expect(APPROVALS_LABELS.openAgentEmail).toMatch(KHMER);
    expect(APPROVALS_LABELS.kind.outbound_email).toMatch(KHMER);
  });

  it("maps known kinds and falls back for unknown", () => {
    expect(approvalKindLabel("outbound_email")).toBe(
      APPROVALS_LABELS.kind.outbound_email,
    );
    expect(approvalKindLabel("tool_action")).toBe(APPROVALS_LABELS.kind.tool_action);
    expect(approvalKindLabel("skill_install")).toBe(APPROVALS_LABELS.kind.skill_install);
    expect(approvalKindLabel("automation_promote")).toBe(
      APPROVALS_LABELS.kind.automation_promote,
    );
    expect(approvalKindLabel("custom_kind")).toBe("custom_kind");
  });
});

describe("approvalPayloadSummary", () => {
  it("prefers skill name + runtime for skill_install", () => {
    expect(
      approvalPayloadSummary({
        kind: "skill_install",
        summary: "fallback",
        payload: { name: "repo-scan", runtime: "claude" },
      }),
    ).toBe("repo-scan · claude");
  });

  it("prefers tool name for tool_action", () => {
    expect(
      approvalPayloadSummary({
        kind: "tool_action",
        summary: "fallback",
        payload: { tool_name: "github.write" },
      }),
    ).toBe("github.write");
  });

  it("uses outbound summary To line", () => {
    expect(
      approvalPayloadSummary({
        kind: "outbound_email",
        summary: "To alice@example.com",
        payload: { emailId: "em1" },
      }),
    ).toBe("alice@example.com");
  });
});

describe("outbound approval meta helpers", () => {
  it("extracts emailId from payload", () => {
    expect(outboundApprovalMeta({ emailId: "em_1", customAccountId: null })).toEqual({
      emailId: "em_1",
      to: null,
    });
    expect(outboundApprovalMeta(null).emailId).toBeNull();
    expect(outboundApprovalMeta("x").emailId).toBeNull();
  });

  it("parses To line from English summary", () => {
    expect(parseOutboundToFromSummary("To alice@example.com")).toBe(
      "alice@example.com",
    );
    expect(parseOutboundToFromSummary("other")).toBeNull();
  });
});
