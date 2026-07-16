import { describe, it, expect } from "vitest";
import {
  DEFAULT_PATTERN_MIN_COUNT,
  DEFAULT_SUGGESTED_SCHEDULE,
  detectAutomationPatterns,
  normalizeTaskPatternKey,
} from "./pattern-automation-suggest";

describe("normalizeTaskPatternKey", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalizeTaskPatternKey("  Weekly   Digest  ")).toBe("weekly digest");
  });

  it("strips urls, dates, and numbers", () => {
    const key = normalizeTaskPatternKey(
      "Sync PRs for 2026-07-16 from https://github.com/org/repo — batch 12",
    );
    expect(key).toBe("sync prs for from batch #");
  });

  it("strips slash dates and ISO timestamps", () => {
    expect(normalizeTaskPatternKey("Digest for 7/16/2026 at 2026-07-16T08:00:00.000Z")).toBe(
      "digest for at",
    );
  });

  it("returns empty for blank / punctuation-only prompts", () => {
    expect(normalizeTaskPatternKey("   ")).toBe("");
    expect(normalizeTaskPatternKey("!!!")).toBe("");
    expect(normalizeTaskPatternKey(null as unknown as string)).toBe("");
  });

  it("is stable for near-duplicate prompts differing only by volatile tokens", () => {
    const a = normalizeTaskPatternKey("Send morning brief for 2026-07-10 — batch 3");
    const b = normalizeTaskPatternKey("send Morning Brief for 2026-07-11, batch 99");
    expect(a).toBe(b);
    expect(a).toBe("send morning brief for batch #");
  });
});

describe("detectAutomationPatterns", () => {
  const base = [
    {
      id: "t1",
      agentId: "a1",
      prompt: "Send morning brief for 2026-07-10",
      completedAt: "2026-07-10T08:00:00.000Z",
    },
    {
      id: "t2",
      agentId: "a1",
      prompt: "Send morning brief for 2026-07-11",
      completedAt: "2026-07-11T08:00:00.000Z",
    },
    {
      id: "t3",
      agentId: "a1",
      prompt: "Send morning brief for 2026-07-12",
      completedAt: "2026-07-12T08:00:00.000Z",
    },
  ];

  it("returns empty when fewer than N similar tasks", () => {
    expect(detectAutomationPatterns(base.slice(0, 2))).toEqual([]);
  });

  it("emits a suggestion after N similar completed tasks", () => {
    const suggestions = detectAutomationPatterns(base);
    expect(suggestions).toHaveLength(1);
    const s = suggestions[0]!;
    expect(s.count).toBe(3);
    expect(s.agentId).toBe("a1");
    expect(s.taskIds).toEqual(["t1", "t2", "t3"]);
    expect(s.patternKey).toBe(normalizeTaskPatternKey(base[0]!.prompt));
    expect(s.suggestedSchedule).toBe(DEFAULT_SUGGESTED_SCHEDULE);
    expect(s.suggestedSchedule).toBe("daily");
    expect(s.samplePrompt).toContain("morning brief");
    expect(s.suggestedTitle.toLowerCase()).toContain("morning brief");
    expect(s.suggestedSopMarkdown).toBe(s.samplePrompt);
    expect(s.latestCompletedAt).toBe("2026-07-12T08:00:00.000Z");
  });

  it("uses the most recent completed wording as samplePrompt", () => {
    const tasks = [
      {
        id: "t1",
        agentId: "a1",
        prompt: "Send morning brief for team on 2026-07-10",
        completedAt: "2026-07-10T08:00:00.000Z",
      },
      {
        id: "t2",
        agentId: "a1",
        prompt: "Send morning brief for team on 2026-07-11",
        completedAt: "2026-07-11T08:00:00.000Z",
      },
      {
        id: "t3",
        agentId: "a1",
        prompt: "Send morning brief for team on 2026-07-12 (final pass)",
        completedAt: "2026-07-12T08:00:00.000Z",
      },
    ];
    // Dates + punctuation strip; wording that differs only by volatile tokens shares a key.
    // Parenthetical "final pass" survives, so use pure date variance for grouping:
    const grouped = [
      tasks[0]!,
      tasks[1]!,
      {
        id: "t3",
        agentId: "a1",
        prompt: "SEND morning brief for team on 2026-07-12",
        completedAt: "2026-07-12T08:00:00.000Z",
      },
    ];
    expect(normalizeTaskPatternKey(grouped[0]!.prompt)).toBe(
      normalizeTaskPatternKey(grouped[2]!.prompt),
    );
    const [s] = detectAutomationPatterns(grouped);
    expect(s?.samplePrompt).toBe("SEND morning brief for team on 2026-07-12");
    expect(s?.latestCompletedAt).toBe("2026-07-12T08:00:00.000Z");
  });

  it("respects custom minCount", () => {
    expect(detectAutomationPatterns(base, { minCount: 4 })).toEqual([]);
    expect(detectAutomationPatterns(base, { minCount: 2 })).toHaveLength(1);
  });

  it("groups by agent — different agents do not merge", () => {
    const tasks = [
      ...base,
      {
        id: "t4",
        agentId: "a2",
        prompt: "Send morning brief for 2026-07-13",
        completedAt: "2026-07-13T08:00:00.000Z",
      },
      {
        id: "t5",
        agentId: "a2",
        prompt: "Send morning brief for 2026-07-14",
        completedAt: "2026-07-14T08:00:00.000Z",
      },
      {
        id: "t6",
        agentId: "a2",
        prompt: "Send morning brief for 2026-07-15",
        completedAt: "2026-07-15T08:00:00.000Z",
      },
    ];
    const suggestions = detectAutomationPatterns(tasks);
    expect(suggestions).toHaveLength(2);
    expect(suggestions.map((s) => s.agentId).sort()).toEqual(["a1", "a2"]);
  });

  it("does not merge different patterns for the same agent", () => {
    const tasks = [
      ...base,
      {
        id: "o1",
        agentId: "a1",
        prompt: "Weekly status digest for 2026-07-10",
        completedAt: "2026-07-10T09:00:00.000Z",
      },
      {
        id: "o2",
        agentId: "a1",
        prompt: "Weekly status digest for 2026-07-11",
        completedAt: "2026-07-11T09:00:00.000Z",
      },
    ];
    const suggestions = detectAutomationPatterns(tasks, { minCount: 2 });
    expect(suggestions).toHaveLength(2);
    const keys = suggestions.map((s) => s.patternKey).sort();
    expect(keys[0]).not.toBe(keys[1]);
  });

  it("excludes automation_event / kill_task types by default", () => {
    const tasks = base.map((t, i) => ({
      ...t,
      type: i === 0 ? "automation_event" : undefined,
    }));
    // only 2 non-excluded remain
    expect(detectAutomationPatterns(tasks)).toEqual([]);

    const allAuto = base.map((t) => ({ ...t, type: "automation_event" }));
    expect(detectAutomationPatterns(allAuto)).toEqual([]);

    const killTasks = base.map((t) => ({ ...t, type: "kill_task" }));
    expect(detectAutomationPatterns(killTasks)).toEqual([]);
  });

  it("honors custom excludeTypes", () => {
    const tasks = base.map((t) => ({ ...t, type: "custom_skip" }));
    expect(detectAutomationPatterns(tasks, { excludeTypes: ["custom_skip"] })).toEqual([]);
    // empty excludeTypes disables defaults
    expect(detectAutomationPatterns(tasks, { excludeTypes: [] })).toHaveLength(1);
  });

  it("suppresses patterns that match existing automation titles", () => {
    const suggestions = detectAutomationPatterns(base, {
      existingAutomationTitles: ["Send morning brief for 2026-07-12"],
    });
    expect(suggestions).toEqual([]);
  });

  it("suppresses when existing title fingerprints to the same pattern key", () => {
    const suggestions = detectAutomationPatterns(base, {
      // Dates strip so this title normalizes to the same patternKey as the tasks.
      existingAutomationTitles: ["send morning brief for 9999-01-01"],
    });
    expect(suggestions).toEqual([]);
  });

  it("skips empty prompts and incomplete rows", () => {
    expect(
      detectAutomationPatterns([
        { id: "x", agentId: "a1", prompt: "   " },
        { id: "", agentId: "a1", prompt: "hello" },
        { id: "y", agentId: "", prompt: "hello" },
        { id: "z", agentId: "a1", prompt: "!!!" },
      ]),
    ).toEqual([]);
  });

  it("ranks higher counts first", () => {
    const tasks = [
      ...base,
      {
        id: "u1",
        agentId: "a1",
        prompt: "Other recurring work 1",
        completedAt: "2026-07-10T09:00:00.000Z",
      },
      {
        id: "u2",
        agentId: "a1",
        prompt: "Other recurring work 2",
        completedAt: "2026-07-11T09:00:00.000Z",
      },
      {
        id: "u3",
        agentId: "a1",
        prompt: "Other recurring work 3",
        completedAt: "2026-07-12T09:00:00.000Z",
      },
      {
        id: "u4",
        agentId: "a1",
        prompt: "Other recurring work 4",
        completedAt: "2026-07-13T09:00:00.000Z",
      },
    ];
    const suggestions = detectAutomationPatterns(tasks, { minCount: 3 });
    expect(suggestions[0]!.count).toBeGreaterThanOrEqual(suggestions[1]!.count);
    expect(suggestions[0]!.count).toBe(4);
  });

  it("ranks by latestCompletedAt when counts are equal", () => {
    const tasks = [
      {
        id: "a1",
        agentId: "agent",
        prompt: "Alpha recurring digest for 2026-07-10",
        completedAt: "2026-07-10T08:00:00.000Z",
      },
      {
        id: "a2",
        agentId: "agent",
        prompt: "Alpha recurring digest for 2026-07-11",
        completedAt: "2026-07-11T08:00:00.000Z",
      },
      {
        id: "a3",
        agentId: "agent",
        prompt: "Alpha recurring digest for 2026-07-12",
        completedAt: "2026-07-12T08:00:00.000Z",
      },
      {
        id: "b1",
        agentId: "agent",
        prompt: "Zeta recurring digest for 2026-07-13",
        completedAt: "2026-07-13T08:00:00.000Z",
      },
      {
        id: "b2",
        agentId: "agent",
        prompt: "Zeta recurring digest for 2026-07-14",
        completedAt: "2026-07-14T08:00:00.000Z",
      },
      {
        id: "b3",
        agentId: "agent",
        prompt: "Zeta recurring digest for 2026-07-15",
        completedAt: "2026-07-15T08:00:00.000Z",
      },
    ];
    // Equal counts (3); newer zeta group should rank first.
    const suggestions = detectAutomationPatterns(tasks, { minCount: 3 });
    expect(suggestions).toHaveLength(2);
    expect(suggestions[0]!.latestCompletedAt).toBe("2026-07-15T08:00:00.000Z");
    expect(suggestions[0]!.patternKey).toContain("zeta");
    expect(suggestions[1]!.patternKey).toContain("alpha");
  });

  it("respects suggestion limit and returns empty for non-positive limit", () => {
    const tasks = [
      ...base,
      {
        id: "u1",
        agentId: "a1",
        prompt: "Other recurring work 1",
        completedAt: "2026-07-10T09:00:00.000Z",
      },
      {
        id: "u2",
        agentId: "a1",
        prompt: "Other recurring work 2",
        completedAt: "2026-07-11T09:00:00.000Z",
      },
      {
        id: "u3",
        agentId: "a1",
        prompt: "Other recurring work 3",
        completedAt: "2026-07-12T09:00:00.000Z",
      },
    ];
    expect(detectAutomationPatterns(tasks, { minCount: 3, limit: 1 })).toHaveLength(1);
    expect(detectAutomationPatterns(tasks, { minCount: 3, limit: 0 })).toEqual([]);
  });

  it("caps taskIds at 50 while preserving full count", () => {
    const tasks = Array.from({ length: 55 }, (_, i) => ({
      id: `t${i}`,
      agentId: "a1",
      prompt: "Recurring report daily",
      completedAt: `2026-07-${String((i % 28) + 1).padStart(2, "0")}T08:00:00.000Z`,
    }));
    const [s] = detectAutomationPatterns(tasks, { minCount: 3 });
    expect(s?.count).toBe(55);
    expect(s?.taskIds).toHaveLength(50);
  });

  it("truncates long suggested titles", () => {
    const long = `Prepare ${"detailed ".repeat(20)}status summary for leadership`;
    const tasks = [1, 2, 3].map((i) => ({
      id: `t${i}`,
      agentId: "a1",
      prompt: long,
      completedAt: `2026-07-1${i}T08:00:00.000Z`,
    }));
    const [s] = detectAutomationPatterns(tasks);
    expect(s?.suggestedTitle.length).toBeLessThanOrEqual(72);
    expect(s?.suggestedTitle.endsWith("…")).toBe(true);
  });

  it("is deterministic for the same input", () => {
    expect(detectAutomationPatterns(base)).toEqual(detectAutomationPatterns(base));
  });

  it("uses DEFAULT_PATTERN_MIN_COUNT of 3", () => {
    expect(DEFAULT_PATTERN_MIN_COUNT).toBe(3);
  });
});
