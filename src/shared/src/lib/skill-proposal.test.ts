import { describe, it, expect } from "vitest";
import { proposeSkillFromSuccess } from "./skill-proposal";

describe("proposeSkillFromSuccess", () => {
  it("returns null without a trace/task id", () => {
    expect(
      proposeSkillFromSuccess({ title: "Deploy helper", summary: "Does deploy" }),
    ).toBeNull();
  });

  it("returns null without title/summary/description", () => {
    expect(proposeSkillFromSuccess({ taskId: "task_1" })).toBeNull();
  });

  it("builds a proposal from title + taskId", () => {
    expect(
      proposeSkillFromSuccess({
        taskId: "task_abc",
        title: "Weekly Status Report",
        summary: "Collects weekly status and emails the channel.",
      }),
    ).toEqual({
      name: "weekly-status-report",
      description: "Collects weekly status and emails the channel.",
      source_trace_id: "task_abc",
    });
  });

  it("prefers traceId over taskId for source_trace_id", () => {
    const p = proposeSkillFromSuccess({
      taskId: "task_1",
      traceId: "trace_9",
      title: "Foo",
    });
    expect(p?.source_trace_id).toBe("trace_9");
  });

  it("slugifies names and falls back to summary when title missing", () => {
    const p = proposeSkillFromSuccess({
      taskId: "t1",
      summary: "  Sync Linear Issues!!!  ",
    });
    expect(p).toEqual({
      name: "sync-linear-issues",
      description: "Sync Linear Issues!!!",
      source_trace_id: "t1",
    });
  });

  it("appends toolsUsed into description", () => {
    const p = proposeSkillFromSuccess({
      taskId: "t2",
      title: "PR review",
      summary: "Reviews open PRs",
      toolsUsed: ["gh", "git"],
    });
    expect(p?.description).toBe("Reviews open PRs (tools: gh, git)");
  });

  it("is deterministic for the same metadata", () => {
    const meta = {
      taskId: "t3",
      title: "Calendar digest",
      tags: ["calendar", "email"],
    };
    expect(proposeSkillFromSuccess(meta)).toEqual(proposeSkillFromSuccess(meta));
  });

  it("truncates long descriptions", () => {
    const long = "x".repeat(400);
    const p = proposeSkillFromSuccess({ taskId: "t4", title: "Long", summary: long });
    expect(p?.description.length).toBe(280);
    expect(p?.description.endsWith("…")).toBe(true);
  });

  it("appends tags when toolsUsed is empty", () => {
    const p = proposeSkillFromSuccess({
      taskId: "t5",
      title: "Inbox AI",
      summary: "Triage inbox",
      tags: ["email", "priority"],
      toolsUsed: [],
    });
    expect(p?.description).toBe("Triage inbox (tags: email, priority)");
  });

  it("prefers toolsUsed over tags in description", () => {
    const p = proposeSkillFromSuccess({
      taskId: "t6",
      title: "Ship",
      summary: "Ship feature",
      toolsUsed: ["gh"],
      tags: ["ignored"],
    });
    expect(p?.description).toBe("Ship feature (tools: gh)");
    expect(p?.description).not.toMatch(/tags/);
  });

  it("falls back to untitled-skill when name slugifies empty", () => {
    const p = proposeSkillFromSuccess({
      taskId: "t7",
      title: "!!!",
      summary: "!!!",
    });
    expect(p?.name).toBe("untitled-skill");
  });
});
