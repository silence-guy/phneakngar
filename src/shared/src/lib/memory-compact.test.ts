import { describe, it, expect } from "vitest";
import { MemoryKind } from "../constants";
import { compactMemoryNotes, MEMORY_SUMMARY_KIND } from "./memory-compact";

describe("compactMemoryNotes", () => {
  it("exports MEMORY_SUMMARY_KIND aligned with MemoryKind.SUMMARY", () => {
    expect(MEMORY_SUMMARY_KIND).toBe(MemoryKind.SUMMARY);
    expect(MEMORY_SUMMARY_KIND).toBe("summary");
  });

  it("returns empty string for empty input", () => {
    expect(compactMemoryNotes([])).toBe("");
  });

  it("drops blank notes", () => {
    expect(
      compactMemoryNotes([
        { content: "   " },
        { content: "\n\t" },
        { content: "keep me", kind: "fact" },
      ]),
    ).toBe("• [fact] keep me");
  });

  it("defaults missing kind to fact", () => {
    expect(compactMemoryNotes([{ content: "hello" }])).toBe("• [fact] hello");
  });

  it("formats multiple notes as bullet lines", () => {
    const out = compactMemoryNotes([
      { content: "likes tea", kind: "preference", updatedAt: "2026-01-02T00:00:00.000Z" },
      { content: "shipped v1", kind: "decision", updatedAt: "2026-01-01T00:00:00.000Z" },
    ]);
    expect(out).toBe(
      ["• [decision] shipped v1", "• [preference] likes tea"].join("\n"),
    );
  });

  it("dedupes identical kind+content and keeps latest updatedAt", () => {
    const out = compactMemoryNotes([
      { content: "uses dark mode", kind: "preference", updatedAt: "2026-01-01T00:00:00.000Z" },
      { content: "  uses   dark mode ", kind: "preference", updatedAt: "2026-02-01T00:00:00.000Z" },
    ]);
    expect(out).toBe("• [preference] uses dark mode");
  });

  it("is deterministic for the same multiset of notes regardless of input order", () => {
    const a = [
      { content: "b", kind: "fact", updatedAt: "2026-01-02T00:00:00.000Z" },
      { content: "a", kind: "fact", updatedAt: "2026-01-01T00:00:00.000Z" },
      { content: "z", kind: "role", updatedAt: "2026-01-03T00:00:00.000Z" },
    ];
    const b = [...a].reverse();
    expect(compactMemoryNotes(a)).toBe(compactMemoryNotes(b));
  });

  it("respects maxNotes", () => {
    const out = compactMemoryNotes(
      [
        { content: "first", kind: "decision", updatedAt: "2026-01-01T00:00:00.000Z" },
        { content: "second", kind: "fact", updatedAt: "2026-01-02T00:00:00.000Z" },
        { content: "third", kind: "role", updatedAt: "2026-01-03T00:00:00.000Z" },
      ],
      { maxNotes: 2 },
    );
    expect(out.split("\n")).toHaveLength(2);
    expect(out).toContain("[decision]");
    expect(out).toContain("[fact]");
    expect(out).not.toContain("[role]");
  });

  it("truncates to maxLength with ellipsis", () => {
    const long = compactMemoryNotes(
      [{ content: "abcdefghijklmnopqrstuvwxyz", kind: "fact" }],
      { maxLength: 20 },
    );
    expect(long.length).toBe(20);
    expect(long.endsWith("…")).toBe(true);
  });

  it("returns empty when maxLength is 0", () => {
    expect(compactMemoryNotes([{ content: "x" }], { maxLength: 0 })).toBe("");
  });
});
