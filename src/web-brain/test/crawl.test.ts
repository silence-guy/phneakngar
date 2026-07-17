import { describe, it, expect } from "vitest";
import { extractLinks, webCrawl } from "../src/crawl.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { WebCache } from "../src/cache.js";

describe("extractLinks", () => {
  it("resolves relative links", () => {
    const html = `<a href="/a">A</a><a href="https://example.com/b">B</a><a href="mailto:x@y.z">m</a>`;
    const links = extractLinks(html, "https://example.com/");
    expect(links).toContain("https://example.com/a");
    expect(links).toContain("https://example.com/b");
    expect(links.some((l) => l.startsWith("mailto:"))).toBe(false);
  });
});

describe("webCrawl", () => {
  it("rejects SSRF seed", async () => {
    const res = await webCrawl("http://127.0.0.1/");
    expect(res.ok).toBe(false);
  });

  it("crawls a tiny site with mock fetch", async () => {
    const pages: Record<string, string> = {
      "https://example.com/": `<html><title>Home</title><body><a href="/docs">Docs</a><p>Home page content here.</p></body></html>`,
      "https://example.com/docs": `<html><title>Docs</title><body><p>Documentation body content.</p><a href="/">Home</a></body></html>`,
      "https://example.com/robots.txt": `User-agent: *\nAllow: /\n`,
    };
    const fetchImpl: typeof fetch = async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const body = pages[url.replace(/\/$/, url.endsWith("/") ? "/" : "") ] 
        ?? pages[url]
        ?? pages[url.endsWith("/") ? url.slice(0, -1) : url + "/"];
      // normalize
      const key = Object.keys(pages).find((k) => url.startsWith(k.replace(/\/$/, "")) || url === k);
      const html = key ? pages[key] : body;
      if (!html) return new Response("missing", { status: 404 });
      return new Response(html, {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    };

    const dir = mkdtempSync(join(tmpdir(), "crawl-"));
    try {
      const cache = new WebCache({ dir });
      const res = await webCrawl("https://example.com/", {
        maxDepth: 1,
        maxPages: 5,
        minDelayMs: 0,
        fetchImpl,
        cache,
        respectRobots: true,
      });
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.pages.length).toBeGreaterThanOrEqual(1);
      expect(res.pages[0]!.title.length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
