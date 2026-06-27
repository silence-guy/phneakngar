import { describe, expect, it } from "vitest";
import {
  COMPONENT_LABELS,
  viewAllTasksLabel,
  eventCountSuffixLabel,
  requiresVersionLabel,
  appOutdatedDescription,
  machineOutdatedDescription,
  mockNetworkLabel,
} from "./component-labels";

const isKhmer = (s: string) => /[ក-៿]/.test(s);

describe("component labels", () => {
  it("localizes inbox and flag labels to Khmer", () => {
    expect(isKhmer(COMPONENT_LABELS.inbox.unread)).toBe(true);
    expect(isKhmer(COMPONENT_LABELS.inbox.noUnread)).toBe(true);
    expect(isKhmer(COMPONENT_LABELS.flag.flagged)).toBe(true);
    expect(isKhmer(COMPONENT_LABELS.flag.noFlagged)).toBe(true);
  });

  it("localizes status labels to Khmer", () => {
    for (const value of Object.values(COMPONENT_LABELS.status)) {
      expect(isKhmer(value)).toBe(true);
    }
  });

  it("localizes preview labels to Khmer", () => {
    for (const value of Object.values(COMPONENT_LABELS.preview)) {
      expect(isKhmer(value)).toBe(true);
    }
  });

  it("localizes runtime gate labels to Khmer", () => {
    expect(isKhmer(COMPONENT_LABELS.runtime.updateRequiredTitle)).toBe(true);
    expect(isKhmer(COMPONENT_LABELS.runtime.update)).toBe(true);
    expect(isKhmer(COMPONENT_LABELS.runtime.updating)).toBe(true);
    expect(isKhmer(COMPONENT_LABELS.runtime.clickToCopy)).toBe(true);
    expect(isKhmer(COMPONENT_LABELS.runtime.copiedToClipboard)).toBe(true);
  });

  it("formats count and version helpers", () => {
    expect(viewAllTasksLabel(7)).toContain("7");
    expect(isKhmer(viewAllTasksLabel(7))).toBe(true);
    expect(eventCountSuffixLabel(3)).toContain("3");
    expect(isKhmer(eventCountSuffixLabel(3))).toBe(true);
    expect(requiresVersionLabel("1.2.3")).toContain("v1.2.3");
    expect(isKhmer(requiresVersionLabel("1.2.3"))).toBe(true);
  });

  it("builds outdated descriptions with version and Khmer text", () => {
    const app = appOutdatedDescription("0.0.11");
    const machine = machineOutdatedDescription("0.0.11");
    expect(app).toContain("v0.0.11");
    expect(machine).toContain("v0.0.11");
    expect(isKhmer(app)).toBe(true);
    expect(isKhmer(machine)).toBe(true);
  });

  it("builds mock network label keeping ms token", () => {
    const label = mockNetworkLabel(300);
    expect(label).toContain("300");
    expect(label).toContain("ms");
    expect(isKhmer(label)).toBe(true);
  });
});
