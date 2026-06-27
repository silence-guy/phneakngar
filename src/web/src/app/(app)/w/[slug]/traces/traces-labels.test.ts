import { describe, expect, it } from "vitest";
import {
  TRACES_LABELS,
  traceStatusFilterLabel,
  traceStatusLabel,
  traceTaskStatusLabel,
  traceOutcomeLabel,
  silentTaskLabel,
  formatTraceRelativeTime,
} from "./traces-labels";

const isKhmer = (s: string) => /[ក-៿]/.test(s);

describe("traces labels", () => {
  it("exposes Khmer header strings", () => {
    expect(isKhmer(TRACES_LABELS.title)).toBe(true);
    expect(isKhmer(TRACES_LABELS.subtitle)).toBe(true);
    expect(isKhmer(TRACES_LABELS.refresh)).toBe(true);
    expect(isKhmer(TRACES_LABELS.empty.noTraces)).toBe(true);
  });

  it("maps status filter values to Khmer, falling back to the raw value", () => {
    expect(traceStatusFilterLabel("all")).toBe(TRACES_LABELS.filters.statusAll);
    expect(isKhmer(traceStatusFilterLabel("active"))).toBe(true);
    expect(isKhmer(traceStatusFilterLabel("completed"))).toBe(true);
    expect(traceStatusFilterLabel("unknown")).toBe("unknown");
  });

  it("maps trace-list and task statuses to Khmer", () => {
    expect(isKhmer(traceStatusLabel("active"))).toBe(true);
    expect(isKhmer(traceStatusLabel("failed"))).toBe(true);
    // dispatched collapses to the queued label, superseded to cancelled.
    expect(traceTaskStatusLabel("dispatched")).toBe(traceTaskStatusLabel("queued"));
    expect(traceTaskStatusLabel("superseded")).toBe(traceTaskStatusLabel("cancelled"));
    expect(traceTaskStatusLabel("running")).not.toBe("running");
    expect(isKhmer(traceTaskStatusLabel("running"))).toBe(true);
  });

  it("maps outcomes to Khmer and preserves unknown keys", () => {
    expect(isKhmer(traceOutcomeLabel("completed_without_visible_output"))).toBe(true);
    expect(isKhmer(traceOutcomeLabel("not_required"))).toBe(true);
    expect(traceOutcomeLabel("mystery")).toBe("mystery");
  });

  it("formats the silent-task count in Khmer", () => {
    expect(silentTaskLabel(1)).toBe("1 ភារកិច្ចគ្មានលទ្ធផល");
    expect(silentTaskLabel(3)).toBe("3 ភារកិច្ចគ្មានលទ្ធផល");
  });

  it("formats relative time in Khmer", () => {
    expect(formatTraceRelativeTime(new Date().toISOString())).toBe(
      TRACES_LABELS.relativeTime.justNow,
    );
    const tenMinAgo = new Date(Date.now() - 10 * 60000).toISOString();
    expect(formatTraceRelativeTime(tenMinAgo)).toBe("10 នាទីមុន");
    const threeHrAgo = new Date(Date.now() - 3 * 3600000).toISOString();
    expect(formatTraceRelativeTime(threeHrAgo)).toBe("3 ម៉ោងមុន");
    expect(formatTraceRelativeTime("not-a-date")).toBe("");
  });
});
