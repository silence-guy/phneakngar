import { describe, expect, it } from "vitest";
import {
  buildRuntimeConfigWithApprovalHold,
  readApprovalHoldSettings,
} from "./approval-hold-settings";

describe("approval hold agent settings helpers", () => {
  it("defaults to enabled", () => {
    expect(readApprovalHoldSettings(undefined).enabled).toBe(true);
    expect(readApprovalHoldSettings({}).enabled).toBe(true);
  });

  it("reads and applies hold settings", () => {
    expect(
      readApprovalHoldSettings({ approvalHold: { enabled: false } }).enabled,
    ).toBe(false);
    const next = buildRuntimeConfigWithApprovalHold({ model: "x" }, { enabled: false });
    expect(next).toMatchObject({
      model: "x",
      approvalHold: { enabled: false },
    });
  });
});
