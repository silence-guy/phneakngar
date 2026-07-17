import { describe, it, expect } from "vitest";
import { extractLinks, webCrawl } from "../src/crawl.js";
import {
  canonicalForCrawl,
  matchesPatterns,
  stripFragment,
} from "../src/url-utils.js";
import {
  parseSitemapEntries,
  parseSitemapIndex,
  extractSitemapUrlFromRobots,
  sortSitemapEntries,
} from "../src/sitemap.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { WebCache } from "../src/cache.js";

describe("url-utils", () => {
  it("canonicalForCrawl collapses fragment and trailing slash", () => {
    expect(canonicalForCrawl("https://ex.com/docs#install")).toBe(
      "https://ex.com/docs",
    );
    expect(canonicalForCrawl("https://ex.com/docs/")).toBe(
      "https://ex.com/docs",
    );
  });

  it("stripFragment drops hash", () => {
    expect(stripFragment("https://ex.com/a#b")).toBe("https://ex.com/a");
  });

  it("matchesPatterns include/exclude", () => {
    expect(
      matchesPatterns("https://ex.com/docs/a", ["/docs/"], undefined),
    ).toBe(true);
    expect(
      matchesPatterns("https://ex.com/blog/a", ["/docs/"], undefined),
    ).toBe(false);
    expect(
      matchesPatterns("https://ex.com/docs/a", undefined, ["/docs/"]),
    ).toBe(false);
  });
});

describe("sitemap", () => {
  it("parses urlset entries and sorts by lastmod", () => {
    const xml = `<?xml version="1.0"?>
      <urlset>
        <url><loc>https://ex.com/old</loc><lastmod>2020-01-01</lastmod></url>
        <url><loc>https://ex.com/new</loc><lastmod>2026-06-01</lastmod><priority>0.9</priority></url>
      </urlset>`;
    const entries = sortSitemapEntries(parseSitemapEntries(xml));
    expect(entries[0]!.url).toBe("https://ex.com/new");
  });

  it("parses sitemap index and robots Sitemap:", () => {
    const index = `<sitemapindex>
      <sitemap><loc>https://ex.com/s1.xml</loc></sitemap>
    </sitemapindex>`;
    expect(parseSitemapIndex(index)).toEqual(["https://ex.com/s1.xml"]);
    expect(
      extractSitemapUrlFromRobots("User-agent: *\nSitemap: https://ex.com/sm.xml\n"),
    ).toEqual(["https://ex.com/sm.xml"]);
  });
});

describe("extractLinks", () => {
  it("resolves relative links", () => {
    const html = `<a href="/a">A</a><a href="https://example.com/b">B</a><a href="mailto:x@y.z">m</a>`;
    const links = extractLinks(html, "https://example.com/");
    expect(links).toContain("https://example.com/a");
    expect(links).toContain("https://example.com/b");
    expect(links.some((l) => l.startsWith("mailto:"))).toBe(false);
  });
});

function mockSiteFetch(pages: Record<string, string>): typeof fetch {
  return async (input) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const normalized = url.split("#")[0]!;
    const html =
      pages[normalized] ??
      pages[normalized.replace(/\/$/, "")] ??
      pages[normalized.endsWith("/") ? normalized.slice(0, -1) : `${normalized}/`];
    if (!html) return new Response("missing", { status: 404 });
    return new Response(html, {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  };
}

describe("webCrawl", () => {
  it("rejects SSRF seed", async () => {
    const res = await webCrawl("http://127.0.0.1/");
    expect(res.ok).toBe(false);
  });

  it("crawls a tiny site with mock fetch (bfs)", async () => {
    const pages: Record<string, string> = {
      "https://example.com/": `<html><title>Home</title><body><a href="/docs">Docs</a><p>Home page content here.</p></body></html>`,
      "https://example.com/docs": `<html><title>Docs</title><body><p>Documentation body content.</p><a href="/">Home</a></body></html>`,
      "https://example.com/robots.txt": `User-agent: *\nAllow: /\n`,
    };
    const dir = mkdtempSync(join(tmpdir(), "crawl-"));
    try {
      const cache = new WebCache({ dir });
      const res = await webCrawl("https://example.com/", {
        strategy: "bfs",
        maxDepth: 1,
        maxPages: 5,
        minDelayMs: 0,
        fetchImpl: mockSiteFetch(pages),
        cache,
        respectRobots: true,
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.strategyUsed).toBe("bfs");
      expect(res.pages.length).toBeGreaterThanOrEqual(2);
      expect(res.totalFound).toBeGreaterThanOrEqual(2);
      expect(res.crawled).toBe(res.pages.length);
      expect(res.pages[0]!.title.length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("strategy map returns urls without page bodies", async () => {
    const pages: Record<string, string> = {
      "https://example.com/": `<html><body><a href="/a">A</a><a href="/b">B</a></body></html>`,
      "https://example.com/a": `<html><body>A</body></html>`,
      "https://example.com/b": `<html><body>B</body></html>`,
      "https://example.com/robots.txt": `User-agent: *\nAllow: /\n`,
    };
    const res = await webCrawl("https://example.com/", {
      strategy: "map",
      maxDepth: 1,
      maxPages: 10,
      minDelayMs: 0,
      fetchImpl: mockSiteFetch(pages),
      respectRobots: false,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.strategyUsed).toBe("map");
    expect(res.pages).toHaveLength(0);
    expect(res.crawled).toBe(0);
    expect(res.urls?.length).toBeGreaterThanOrEqual(2);
  });

  it("strategy sitemap fetches listed urls", async () => {
    const pages: Record<string, string> = {
      "https://example.com/": `<html><title>Home</title><body>home</body></html>`,
      "https://example.com/guide": `<html><title>Guide</title><body>guide content long enough</body></html>`,
      "https://example.com/robots.txt": `User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml\n`,
      "https://example.com/sitemap.xml": `<?xml version="1.0"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>https://example.com/</loc></url>
          <url><loc>https://example.com/guide</loc><lastmod>2026-01-01</lastmod></url>
        </urlset>`,
    };
    const res = await webCrawl("https://example.com/", {
      strategy: "sitemap",
      maxPages: 5,
      minDelayMs: 0,
      fetchImpl: mockSiteFetch(pages),
      respectRobots: true,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.strategyUsed).toBe("sitemap");
    expect(res.sitemapFound).toBe(true);
    expect(res.pages.length).toBeGreaterThanOrEqual(2);
    const titles = res.pages.map((p) => p.title);
    expect(titles.some((t) => /guide/i.test(t) || /home/i.test(t))).toBe(true);
  });

  it("include_patterns scopes crawl", async () => {
    const pages: Record<string, string> = {
      "https://example.com/": `<html><title>Home</title><body>
        <a href="/docs/x">Docs</a><a href="/blog/y">Blog</a>
      </body></html>`,
      "https://example.com/docs/x": `<html><title>DocX</title><body>doc body content</body></html>`,
      "https://example.com/blog/y": `<html><title>BlogY</title><body>blog body content</body></html>`,
    };
    const res = await webCrawl("https://example.com/", {
      strategy: "bfs",
      maxDepth: 1,
      maxPages: 10,
      minDelayMs: 0,
      includePatterns: ["/docs/"],
      fetchImpl: mockSiteFetch(pages),
      respectRobots: false,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // seed is still crawled even if not matching include — allowUrl applies to seed too
    // Fix: seed always allowed; children filtered
    const urls = res.pages.map((p) => p.url);
    expect(urls.some((u) => u.includes("/blog/"))).toBe(false);
  });
});
