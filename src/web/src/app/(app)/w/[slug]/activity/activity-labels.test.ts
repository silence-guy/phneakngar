import { describe, expect, it } from "vitest";
import {
  ACTIVITY_LABELS,
  activityIconKey,
  activityKindLabel,
} from "./activity-labels";

function hasKhmer(s: string): boolean {
  return /[\u1780-\u17FF]/.test(s);
}

describe("activity labels", () => {
  it("uses Khmer for title and empty state", () => {
    expect(hasKhmer(ACTIVITY_LABELS.title)).toBe(true);
    expect(hasKhmer(ACTIVITY_LABELS.empty.none)).toBe(true);
  });

  it("maps known kinds", () => {
    expect(activityKindLabel("gateway_egress")).toBe(
      ACTIVITY_LABELS.kind.gateway_egress,
    );
    expect(activityKindLabel("gateway_egress_ok")).toBe(
      ACTIVITY_LABELS.kind.gateway_egress_ok,
    );
    expect(activityKindLabel("gateway_probe_ok")).toBe(
      ACTIVITY_LABELS.kind.gateway_probe_ok,
    );
    expect(activityKindLabel("approval_decided")).toBe(
      ACTIVITY_LABELS.kind.approval_decided,
    );
    expect(activityKindLabel("automation_due")).toBe(
      ACTIVITY_LABELS.kind.automation_due,
    );
  });

  it("soft-normalizes dotted kinds", () => {
    expect(activityKindLabel("approval.decide")).toBe(
      ACTIVITY_LABELS.kind.approval_decide,
    );
  });

  it("falls back for unknown kinds", () => {
    expect(activityKindLabel("totally_unknown_xyz")).toBe(
      ACTIVITY_LABELS.unknownKind,
    );
  });

  it("picks icon keys", () => {
    expect(activityIconKey("approval_decided")).toBe("shield");
    expect(activityIconKey("gateway_egress_ok")).toBe("send");
    expect(activityIconKey("gateway_probe")).toBe("radar");
    expect(activityIconKey("automation_due")).toBe("repeat");
    expect(activityIconKey("other")).toBe("dot");
  });
});
