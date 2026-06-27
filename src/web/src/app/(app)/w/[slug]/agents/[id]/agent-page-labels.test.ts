import { describe, expect, it } from "vitest";
import {
  AGENT_PAGE_LABELS,
  MEETING_STATUS_LABELS,
  ACTIVITY_STATUS_LABELS,
  meetingStatusLabel,
  activityStatusLabel,
  relativeTimeLabel,
  meetingParticipantsLabel,
  meetingStartedAtLabel,
  meetingDeleteDescription,
  agentDeleteDescription,
} from "./agent-page-labels";

const KHMER = /[ក-៿]/;

function flatten(obj: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const v of Object.values(obj)) {
    if (typeof v === "string") out.push(v);
    else if (v && typeof v === "object") out.push(...flatten(v as Record<string, unknown>));
  }
  return out;
}

describe("agent page labels", () => {
  it("exposes Khmer strings for every label entry", () => {
    // Pure product/technical tokens that intentionally stay in English
    // (Google Meet is on the do-not-translate list).
    const TECHNICAL_ONLY = new Set([AGENT_PAGE_LABELS.meetings.urlLabel]);
    const strings = flatten(AGENT_PAGE_LABELS);
    expect(strings.length).toBeGreaterThan(0);
    for (const s of strings) {
      if (TECHNICAL_ONLY.has(s)) continue;
      expect(s, `expected Khmer in: ${s}`).toMatch(KHMER);
    }
  });

  it("has no leftover English words in key entries", () => {
    expect(AGENT_PAGE_LABELS.layout.tabChat).not.toMatch(/Chat/);
    expect(AGENT_PAGE_LABELS.meetings.heading).not.toMatch(/Meeting/);
    expect(AGENT_PAGE_LABELS.activity.emptyTitle).not.toMatch(/activity/i);
    expect(AGENT_PAGE_LABELS.files.selectFile).not.toMatch(/Select/);
    expect(AGENT_PAGE_LABELS.agentNew.heading).not.toMatch(/Create/);
  });

  it("keeps technical product tokens in parentheses where needed", () => {
    expect(AGENT_PAGE_LABELS.files.offlineTitle).toContain("Runtime");
    expect(AGENT_PAGE_LABELS.files.offlineTitle).toMatch(KHMER);
  });

  it("maps meeting status enum values to Khmer display labels (keys unchanged)", () => {
    expect(Object.keys(MEETING_STATUS_LABELS)).toEqual([
      "pending",
      "scheduled",
      "joining",
      "recording",
      "completed",
      "failed",
    ]);
    for (const label of Object.values(MEETING_STATUS_LABELS)) {
      expect(label).toMatch(KHMER);
    }
    expect(meetingStatusLabel("recording")).toMatch(KHMER);
    expect(meetingStatusLabel("unknown-status")).toBe(MEETING_STATUS_LABELS.pending);
  });

  it("collapses dispatched->queued and superseded->cancelled with Khmer labels", () => {
    expect(ACTIVITY_STATUS_LABELS.dispatched).toBe(ACTIVITY_STATUS_LABELS.queued);
    expect(ACTIVITY_STATUS_LABELS.superseded).toBe(ACTIVITY_STATUS_LABELS.cancelled);
    expect(activityStatusLabel("running")).toBe(AGENT_PAGE_LABELS.activity.running);
    // unknown falls back to the raw enum value (not translated)
    expect(activityStatusLabel("mystery")).toBe("mystery");
  });

  it("formats relative time in Khmer", () => {
    const now = new Date();
    expect(relativeTimeLabel(now.toISOString())).toBe("ទើបតែឥឡូវ");
    expect(relativeTimeLabel(new Date(now.getTime() - 5 * 60000).toISOString())).toBe("5 នាទីមុន");
    expect(relativeTimeLabel(new Date(now.getTime() - 3 * 3600000).toISOString())).toBe("3 ម៉ោងមុន");
    expect(relativeTimeLabel(new Date(now.getTime() - 2 * 86400000).toISOString())).toBe("2 ថ្ងៃមុន");
  });

  it("builds Khmer count and description helpers", () => {
    expect(meetingParticipantsLabel(3)).toBe("3 អ្នកចូលរួម");
    expect(meetingStartedAtLabel("Jun 26")).toContain("Jun 26");
    expect(meetingStartedAtLabel("Jun 26")).toMatch(KHMER);
    expect(meetingDeleteDescription("Standup")).toContain("Standup");
    expect(meetingDeleteDescription("Standup")).toMatch(KHMER);
    expect(agentDeleteDescription("Ada")).toContain("Ada");
    expect(agentDeleteDescription("Ada")).toMatch(KHMER);
  });
});
