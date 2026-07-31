import { describe, expect, it } from "vitest";
import { Locale } from "@phneakngar/shared";
import { BLOG_LABELS, getBlogLabels, formatBlogDate } from "./blog-labels";

const isKhmer = (s: string) => /[ក-៿]/.test(s);

function flatten(obj: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const value of Object.values(obj)) {
    if (typeof value === "string") {
      out.push(value);
    } else if (value && typeof value === "object") {
      out.push(...flatten(value as Record<string, unknown>));
    }
  }
  return out;
}

describe("blog labels", () => {
  it("provides matching en/km groups with no empty strings", () => {
    const en = flatten(BLOG_LABELS[Locale.EN] as unknown as Record<string, unknown>);
    const km = flatten(BLOG_LABELS[Locale.KM] as unknown as Record<string, unknown>);

    expect(en.length).toBeGreaterThan(0);
    expect(en.length).toBe(km.length);
    for (const value of [...en, ...km]) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
    expect(en.some((s) => /[\uFFFD]/.test(s))).toBe(false);
    expect(km.some((s) => /[\uFFFD]/.test(s))).toBe(false);
  });

  it("returns Khmer chrome by default", () => {
    const labels = getBlogLabels();
    expect(isKhmer(labels.list.title)).toBe(true);
    expect(labels.list.title).toBe("ប្លុក");
  });

  it("returns English chrome for the en locale", () => {
    const labels = getBlogLabels(Locale.EN);
    expect(labels.list.title).toBe("Blog");
    expect(labels.detail.allPosts).toBe("All posts");
  });

  it("formats dates in km-KH by default", () => {
    const formatted = formatBlogDate("2026-06-15");
    expect(formatted).toMatch(/2026/);
    expect(isKhmer(formatted) || /\d/.test(formatted)).toBe(true);
    // Should not use English month names
    expect(formatted).not.toMatch(/June|January|February|March|April|May|July|August|September|October|November|December/i);
  });

  it("formats dates in en-US for the en locale", () => {
    const formatted = formatBlogDate("2026-06-15", Locale.EN);
    expect(formatted).toMatch(/June/);
    expect(formatted).toMatch(/2026/);
  });
});
