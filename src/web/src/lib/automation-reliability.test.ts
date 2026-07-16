import { describe, expect, it } from "vitest";
import { classifyAutomationRunHealth } from "./automation-reliability";

describe("classifyAutomationRunHealth", () => {
  const now = "2026-07-16T12:00:00.000Z";

  it("marks paused when disabled", () => {
    expect(
      classifyAutomationRunHealth({
        enabled: false,
        nextRunAt: "2026-07-16T10:00:00.000Z",
        nowIso: now,
      }),
    ).toEqual({ overdue: false, statusLabel: "paused" });
  });

  it("marks overdue when next_run_at is past and enabled", () => {
    expect(
      classifyAutomationRunHealth({
        enabled: true,
        nextRunAt: "2026-07-16T10:00:00.000Z",
        nowIso: now,
      }),
    ).toEqual({ overdue: true, statusLabel: "overdue" });
  });

  it("marks enabled when next run is future", () => {
    expect(
      classifyAutomationRunHealth({
        enabled: true,
        nextRunAt: "2026-07-16T14:00:00.000Z",
        nowIso: now,
      }),
    ).toEqual({ overdue: false, statusLabel: "enabled" });
  });
});
