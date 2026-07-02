import { afterEach, describe, expect, it, vi } from "vitest";

const samplePost = {
  slug: "founder-letter",
  title: "សំបុត្រស្ថាបនិក",
  excerpt: "ការណែនាំអំពីភ្នាក់ងារ",
  date: "2026-06-28",
  author: "ភ្នាក់ងារ",
  readingTime: "4 min read",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("public metadata URLs", () => {
  it("omits robots sitemap when no canonical site URL is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const { default: robots } = await import("./robots");

    expect(robots()).not.toHaveProperty("sitemap");
  });

  it("uses the configured site URL for robots sitemap", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com");
    const { default: robots } = await import("./robots");

    expect(robots()).toMatchObject({
      sitemap: "https://example.com/sitemap.xml",
    });
  });

  it("returns no sitemap entries until a canonical site URL is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.doMock("@/lib/blog/posts", () => ({
      getAllPosts: vi.fn().mockResolvedValue([samplePost]),
    }));

    const { default: sitemap } = await import("./sitemap");

    await expect(sitemap()).resolves.toEqual([]);
  });

  it("uses the configured site URL for sitemap entries", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com");
    vi.doMock("@/lib/blog/posts", () => ({
      getAllPosts: vi.fn().mockResolvedValue([samplePost]),
    }));

    const { default: sitemap } = await import("./sitemap");
    const entries = await sitemap();

    expect(entries[0]?.url).toBe("https://example.com/");
    expect(entries.some((entry) => entry.url === "https://example.com/blog/founder-letter")).toBe(true);
  });

  it("omits blog post canonical URLs when no canonical site URL is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.doMock("@/lib/blog/posts", () => ({
      getAllPosts: vi.fn().mockResolvedValue([samplePost]),
      getPostBySlug: vi.fn().mockResolvedValue(samplePost),
    }));

    const { generateMetadata } = await import("./blog/[slug]/page");
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: samplePost.slug }) });

    expect(metadata.alternates).toBeUndefined();
    expect(metadata.openGraph).not.toHaveProperty("url");
  });

  it("uses the configured site URL for blog post metadata", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com");
    vi.doMock("@/lib/blog/posts", () => ({
      getAllPosts: vi.fn().mockResolvedValue([samplePost]),
      getPostBySlug: vi.fn().mockResolvedValue(samplePost),
    }));

    const { generateMetadata } = await import("./blog/[slug]/page");
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: samplePost.slug }) });

    expect(metadata.alternates).toMatchObject({
      canonical: "https://example.com/blog/founder-letter",
    });
    expect(metadata.openGraph).toMatchObject({
      url: "https://example.com/blog/founder-letter",
    });
  });
});
