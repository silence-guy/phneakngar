import { describe, expect, it } from "vitest";
import {
  DEFAULT_APPROVAL_HOLD,
  applyApprovalHoldPolicyToRuntimeConfig,
  readApprovalHoldPolicy,
  resolveApprovalHoldEnabled,
} from "./approval-hold-policy";

describe("approval-hold-policy", () => {
  it("defaults missing config to enabled", () => {
    expect(readApprovalHoldPolicy(undefined)).toEqual(DEFAULT_APPROVAL_HOLD);
    expect(readApprovalHoldPolicy({})).toEqual({ enabled: true });
  });

  it("reads camel and snake keys", () => {
    expect(readApprovalHoldPolicy({ approvalHold: { enabled: false } })).toEqual({
      enabled: false,
    });
    expect(readApprovalHoldPolicy({ approval_hold: { enabled: false } })).toEqual({
      enabled: false,
    });
  });

  it("applies without dropping sibling keys", () => {
    const next = applyApprovalHoldPolicyToRuntimeConfig(
      { model: "gpt", judgment: { ambiguousToIssue: true } },
      { enabled: false },
    );
    expect(next.model).toBe("gpt");
    expect(next.judgment).toEqual({ ambiguousToIssue: true });
    expect(next.approvalHold).toEqual({ enabled: false });
  });

  it("env force-off beats default-on runtime", () => {
    expect(
      resolveApprovalHoldEnabled({
        runtimeConfig: { approvalHold: { enabled: true } },
        env: { CHHLAT_APPROVAL_HOLD: "0" },
      }),
    ).toBe(false);
  });

  it("env force-on beats runtime off", () => {
    expect(
      resolveApprovalHoldEnabled({
        runtimeConfig: { approvalHold: { enabled: false } },
        env: { PHNEAKNGAR_APPROVAL_HOLD: "true" },
      }),
    ).toBe(true);
  });

  it("uses runtime when env unset", () => {
    expect(
      resolveApprovalHoldEnabled({
        runtimeConfig: { approvalHold: { enabled: false } },
        env: {},
      }),
    ).toBe(false);
    expect(resolveApprovalHoldEnabled({ runtimeConfig: {}, env: {} })).toBe(true);
  });
});
