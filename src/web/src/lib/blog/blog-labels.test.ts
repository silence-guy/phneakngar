import { describe, expect, it } from "vitest";
import { BLOG_LABELS, formatBlogDate } from "./blog-labels";

const isKhmer = (s: string) => /[ក-៿]/.test(s);

describe("blog labels", () => {
  it("localizes nav, list, detail, and footer chrome to Khmer", () => {
    for (const group of Object.values(BLOG_LABELS)) {
      for (const value of Object.values(group)) {
        expect(isKhmer(value)).toBe(true);
      }
    }
  });

  it("formats dates in km-KH", () => {
    const formatted = formatBlogDate("2026-06-15");
    expect(formatted).toMatch(/2026/);
    expect(isKhmer(formatted) || /\d/.test(formatted)).toBe(true);
    // Should not use English month names
    expect(formatted).not.toMatch(/June|January|February|March|April|May|July|August|September|October|November|December/i);
  });
});
