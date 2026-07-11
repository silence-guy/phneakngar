import { describe, expect, it } from "vitest";
import {
  RUNTIMES_LABELS,
  runtimeStatusLabel,
  updateChhlatDescription,
  rescanRuntimesDescription,
  removeMachineDescription,
} from "./runtimes-labels";

describe("runtimes labels", () => {
  it("provides Khmer page and action copy", () => {
    expect(RUNTIMES_LABELS.heading).toBe("បរិស្ថានដំណើរការ (Runtime)");
    expect(RUNTIMES_LABELS.newMachine).toBe("ម៉ាស៊ីនថ្មី");
    expect(RUNTIMES_LABELS.connectMachine).toBe("ភ្ជាប់ម៉ាស៊ីន");
    expect(RUNTIMES_LABELS.neverSeen).toBe("មិនធ្លាប់ឃើញ");
    expect(RUNTIMES_LABELS.remove).toBe("ដកចេញ");
    expect(RUNTIMES_LABELS.machineConnected).toBe("ម៉ាស៊ីនបានភ្ជាប់");
  });

  it("maps runtime status ids to Khmer labels", () => {
    expect(runtimeStatusLabel("online")).toBe("នៅបណ្តាញ");
    expect(runtimeStatusLabel("offline")).toBe("ក្រៅបណ្តាញ");
  });

  it("falls back to the raw status when unknown", () => {
    expect(runtimeStatusLabel("degraded")).toBe("degraded");
  });

  it("interpolates machine names into Khmer confirm descriptions", () => {
    expect(updateChhlatDescription("Mac")).toContain("Mac");
    expect(updateChhlatDescription("Mac")).toContain("chhlat");
    expect(rescanRuntimesDescription("Mac")).toContain("Claude Code, Codex, OpenCode");
    expect(removeMachineDescription("Mac")).toContain("បរិស្ថានដំណើរការ");
  });
});
