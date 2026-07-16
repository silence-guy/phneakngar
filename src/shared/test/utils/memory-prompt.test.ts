import { describe, it, expect } from "vitest";
import {
  DEFAULT_AGENT_MEMORY_PROMPT_LIMIT,
  formatMemoryForPrompt,
  toMemoryPromptItems,
} from "../../src/utils/memory-prompt";

describe("formatMemoryForPrompt", () => {
  it("returns empty string for empty input", () => {
    expect(formatMemoryForPrompt([])).toBe("");
  });

  it("returns empty string when all contents are blank", () => {
    expect(
      formatMemoryForPrompt([
        { kind: "fact", content: "  " },
        { kind: "preference", content: "" },
      ]),
    ).toBe("");
  });

  it("formats kind + content lines under a header", () => {
    const out = formatMemoryForPrompt([
      { kind: "preference", content: "Prefer concise updates" },
      { kind: "decision", content: "Ship via CLI first" },
    ]);
    expect(out).toBe(
      [
        "Agent memory (apply when relevant):",
        "- [preference] Prefer concise updates",
        "- [decision] Ship via CLI first",
      ].join("\n"),
    );
  });

  it("defaults missing kind to fact and trims content", () => {
    const out = formatMemoryForPrompt([{ kind: "", content: "  note  " }]);
    expect(out).toContain("- [fact] note");
  });

  it("respects limit option", () => {
    const memories = Array.from({ length: 5 }, (_, i) => ({
      kind: "fact",
      content: `item ${i}`,
    }));
    const out = formatMemoryForPrompt(memories, { limit: 2 });
    expect(out).toContain("item 0");
    expect(out).toContain("item 1");
    expect(out).not.toContain("item 2");
  });

  it("uses DEFAULT_AGENT_MEMORY_PROMPT_LIMIT by default", () => {
    const memories = Array.from(
      { length: DEFAULT_AGENT_MEMORY_PROMPT_LIMIT + 3 },
      (_, i) => ({ kind: "fact", content: `m${i}` }),
    );
    const out = formatMemoryForPrompt(memories);
    expect(out).toContain(`m${DEFAULT_AGENT_MEMORY_PROMPT_LIMIT - 1}`);
    expect(out).not.toContain(`m${DEFAULT_AGENT_MEMORY_PROMPT_LIMIT}`);
  });
});

describe("toMemoryPromptItems", () => {
  it("filters blanks, trims, and caps at limit", () => {
    const items = toMemoryPromptItems(
      [
        { kind: "preference", content: "  a  " },
        { kind: null, content: "b" },
        { kind: "fact", content: "   " },
        { content: "c" },
      ],
      2,
    );
    expect(items).toEqual([
      { kind: "preference", content: "a" },
      { kind: "fact", content: "b" },
    ]);
  });
});
