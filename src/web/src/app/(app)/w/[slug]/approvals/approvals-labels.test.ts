import { describe, expect, it } from "vitest";
import {
  APPROVALS_LABELS,
  approvalKindLabel,
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
    expect(approvalKindLabel("custom_kind")).toBe("custom_kind");
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
