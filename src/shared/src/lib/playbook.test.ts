import { describe, it, expect } from "vitest";
import {
  playbookDefinitionSchema,
  renderPlaybookPrompt,
  isTerminalPlaybookRunStatus,
  PlaybookRunStatus,
} from "./playbook";

describe("playbookDefinitionSchema", () => {
  it("accepts a valid linear definition", () => {
    const result = playbookDefinitionSchema.safeParse([
      { id: "s1", kind: "agent", title: "Run tests", prompt: "run pnpm test" },
      { id: "s2", kind: "approval", title: "Confirm", approvalTitle: "Confirm release" },
      { id: "s3", kind: "human_input", title: "Ask version", question: "Which version?" },
    ]);
    expect(result.success).toBe(true);
  });

  it("rejects empty step arrays", () => {
    const result = playbookDefinitionSchema.safeParse([]);
    expect(result.success).toBe(false);
  });

  it("rejects duplicate step ids", () => {
    const result = playbookDefinitionSchema.safeParse([
      { id: "s1", kind: "agent", title: "A", prompt: "a" },
      { id: "s1", kind: "agent", title: "B", prompt: "b" },
    ]);
    expect(result.success).toBe(false);
  });

  it("rejects agent steps without a prompt", () => {
    const result = playbookDefinitionSchema.safeParse([
      { id: "s1", kind: "agent", title: "No prompt" },
      { id: "s2", kind: "agent", title: "Blank prompt", prompt: "   " },
    ]);
    expect(result.success).toBe(false);
  });

  it("rejects unknown step kinds", () => {
    const result = playbookDefinitionSchema.safeParse([
      { id: "s1", kind: "branch", title: "Nope" },
    ]);
    expect(result.success).toBe(false);
  });

  it("rejects unknown extra keys", () => {
    const result = playbookDefinitionSchema.safeParse([
      { id: "s1", kind: "agent", title: "A", prompt: "a", next: "s2" },
    ]);
    expect(result.success).toBe(false);
  });
});

describe("renderPlaybookPrompt", () => {
  it("substitutes input and step outputs", () => {
    const out = renderPlaybookPrompt("Release {{input.version}} after {{steps.s1.output}}", {
      input: { version: "0.0.4" },
      steps: { s1: "tests passed" },
    });
    expect(out).toBe("Release 0.0.4 after tests passed");
  });

  it("renders missing keys as empty strings without throwing", () => {
    const out = renderPlaybookPrompt("a={{input.missing}} b={{steps.nope.output}}", {});
    expect(out).toBe("a= b=");
  });

  it("handles whitespace inside braces", () => {
    const out = renderPlaybookPrompt("{{ input.v }}", { input: { v: "x" } });
    expect(out).toBe("x");
  });

  it("stringifies non-string input values", () => {
    const out = renderPlaybookPrompt("{{input.count}}", { input: { count: 3 } });
    expect(out).toBe("3");
  });
});

describe("isTerminalPlaybookRunStatus", () => {
  it("classifies terminal statuses", () => {
    expect(isTerminalPlaybookRunStatus(PlaybookRunStatus.COMPLETED)).toBe(true);
    expect(isTerminalPlaybookRunStatus(PlaybookRunStatus.FAILED)).toBe(true);
    expect(isTerminalPlaybookRunStatus(PlaybookRunStatus.CANCELLED)).toBe(true);
    expect(isTerminalPlaybookRunStatus(PlaybookRunStatus.RUNNING)).toBe(false);
    expect(isTerminalPlaybookRunStatus(PlaybookRunStatus.AWAITING_APPROVAL)).toBe(false);
  });
});
