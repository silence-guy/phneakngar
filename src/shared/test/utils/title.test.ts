import { describe, it, expect } from "vitest";
import { truncateTitle, truncateGraphemes, sliceGraphemes, toGraphemes } from "../../src/utils/title";

describe("truncateTitle", () => {
  it("collapses runs of whitespace into single spaces", () => {
    expect(truncateTitle("hello   \n\t  world")).toBe("hello world");
  });

  it("trims leading and trailing whitespace", () => {
    expect(truncateTitle("   padded title   ")).toBe("padded title");
  });

  it("returns the text unchanged when at or under the cap", () => {
    const exact = "a".repeat(50);
    expect(truncateTitle(exact)).toBe(exact);
    expect(truncateTitle("short")).toBe("short");
  });

  it("caps at a word boundary and appends an ellipsis", () => {
    // 60-char input, last space before the 50-char cut is after "boundary".
    const text =
      "the quick brown fox jumps over the lazy dog near a boundary marker";
    const out = truncateTitle(text);
    expect(out.endsWith("...")).toBe(true);
    expect(out).not.toContain("  ");
    // Cut on a space, never mid-word.
    expect(out.slice(0, -3).endsWith(" ")).toBe(false);
    expect(out.length).toBeLessThanOrEqual(53); // <=50 word-boundary cut + "..."
  });

  it("hard-cuts mid-word when there's no late-enough space (lastSpace <= 20)", () => {
    // One long token (no spaces) — lastSpace is -1, so it slices at maxLen.
    const text = "x".repeat(80);
    const out = truncateTitle(text);
    expect(out).toBe("x".repeat(50) + "...");
  });

  it("respects a custom maxLen", () => {
    expect(truncateTitle("hello world", 5)).toBe("hello...");
  });

  it("does not split Khmer grapheme clusters when truncating a title", () => {
    // "ខ្ញុំ" = base ខ + coeng ្ + subscript ញ + vowel ុ + sign ំ — one cluster,
    // several code points. Repeat it so the title exceeds the cap.
    const word = "ខ្ញុំ";
    const text = Array.from({ length: 20 }, () => word).join("");
    const out = truncateTitle(text, 10);
    const body = out.slice(0, -3); // strip "..."
    // The cut must land on a cluster boundary: 10 whole clusters, no orphans.
    expect(toGraphemes(body).length).toBe(10);
    expect(body).toBe(word.repeat(10));
  });
});

describe("toGraphemes", () => {
  it("counts a Khmer multi-codepoint cluster as one grapheme", () => {
    expect(toGraphemes("ខ្ញុំ").length).toBe(1);
    expect(toGraphemes("ខ្ញុំ" + "ខ្ញុំ").length).toBe(2);
  });

  it("handles ASCII and emoji", () => {
    expect(toGraphemes("abc")).toEqual(["a", "b", "c"]);
    expect(toGraphemes("👩‍👧").length).toBe(1); // ZWJ family sequence = one cluster
  });
});

describe("sliceGraphemes", () => {
  it("takes whole clusters without splitting", () => {
    const word = "ខ្ញុំ";
    expect(sliceGraphemes(word.repeat(5), 3)).toBe(word.repeat(3));
  });

  it("returns the original string when already short enough", () => {
    expect(sliceGraphemes("hello", 10)).toBe("hello");
  });

  it("returns empty for a non-positive count", () => {
    expect(sliceGraphemes("hello", 0)).toBe("");
  });
});

describe("truncateGraphemes", () => {
  it("appends the ellipsis only when shortened", () => {
    expect(truncateGraphemes("hello", 10)).toBe("hello");
    expect(truncateGraphemes("hello world", 5)).toBe("hello…");
  });

  it("truncates Khmer on a cluster boundary", () => {
    const word = "ខ្ញុំ";
    const out = truncateGraphemes(word.repeat(5), 2, "");
    expect(out).toBe(word.repeat(2));
    expect(toGraphemes(out).length).toBe(2);
  });
});
