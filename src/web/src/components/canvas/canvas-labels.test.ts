import { describe, expect, it } from "vitest";
import {
  CANVAS_LABELS,
  editRelationshipTitle,
  linkAgentPairLabel,
  removeConnectionDescription,
  upcomingCountLabel,
  eventsTodayLabel,
  eventCountLabel,
} from "./canvas-labels";

const isKhmer = (s: string) => /[ក-៿]/.test(s);

describe("canvas labels", () => {
  it("localizes chat labels to Khmer", () => {
    expect(isKhmer(CANVAS_LABELS.chat.openFullPage)).toBe(true);
    expect(isKhmer(CANVAS_LABELS.chat.close)).toBe(true);
    expect(isKhmer(CANVAS_LABELS.chat.fallbackTitle)).toBe(true);
  });

  it("localizes link sidecar labels to Khmer", () => {
    expect(isKhmer(CANVAS_LABELS.link.mentionHint)).toBe(true);
    expect(isKhmer(CANVAS_LABELS.link.relationshipPlaceholder)).toBe(true);
    expect(isKhmer(CANVAS_LABELS.link.removeConnection)).toBe(true);
    expect(isKhmer(CANVAS_LABELS.link.agentFallback)).toBe(true);
  });

  it("builds relationship title and pair label with names", () => {
    expect(editRelationshipTitle("A", "B")).toContain("A");
    expect(editRelationshipTitle("A", "B")).toContain("B");
    expect(isKhmer(editRelationshipTitle("A", "B"))).toBe(true);
    expect(linkAgentPairLabel("A", "B")).toContain("A");
    expect(linkAgentPairLabel("A", "B")).toContain("B");
  });

  it("falls back to Khmer agent label when names missing", () => {
    expect(linkAgentPairLabel()).toContain(CANVAS_LABELS.link.agentFallback);
    expect(removeConnectionDescription()).toContain(CANVAS_LABELS.link.agentFallback);
  });

  it("builds remove connection description with names", () => {
    const desc = removeConnectionDescription("Alpha", "Beta");
    expect(desc).toContain("Alpha");
    expect(desc).toContain("Beta");
    expect(isKhmer(desc)).toBe(true);
  });

  it("formats event count helpers in Khmer", () => {
    expect(upcomingCountLabel(3)).toBe(`3 ${CANVAS_LABELS.events.upcoming}`);
    expect(eventsTodayLabel(5)).toBe(`5 ${CANVAS_LABELS.events.eventsToday}`);
    expect(eventCountLabel(1)).toBe(`1 ${CANVAS_LABELS.events.eventSuffix}`);
    expect(isKhmer(upcomingCountLabel(1))).toBe(true);
  });

  it("localizes event panel aria labels and fallback to Khmer", () => {
    expect(isKhmer(CANVAS_LABELS.events.unknownAgent)).toBe(true);
    expect(isKhmer(CANVAS_LABELS.events.upcomingEventsAria)).toBe(true);
    expect(isKhmer(CANVAS_LABELS.events.collapsePanelAria)).toBe(true);
  });
});
