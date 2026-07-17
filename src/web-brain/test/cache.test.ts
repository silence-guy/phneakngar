import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { WebCache } from "../src/cache.js";
import type { CacheEntry } from "../src/types.js";

function entry(partial: Partial<CacheEntry> & { url: string }): CacheEntry {
  return {
    finalUrl: partial.finalUrl ?? partial.url,
    title: partial.title ?? "T",
    markdown: partial.markdown ?? "hello world content",
    contentType: "text/html",
    httpStatus: 200,
    fetchedAt: new Date().toISOString(),
    contentHash: "abc",
    ...partial,
  };
}

describe("WebCache", () => {
  let dir: string;
  let cache: WebCache;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "web-brain-cache-"));
    cache = new WebCache({ dir });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("put/get by url", () => {
    cache.put(entry({ url: "https://example.com/a", markdown: "alpha content unique" }));
    const hit = cache.get("https://example.com/a");
    expect(hit).not.toBeNull();
    expect(hit!.markdown).toBe("alpha content unique");
  });

  it("search finds tokens in title/markdown", () => {
    cache.put(entry({ url: "https://example.com/1", title: "Postgres", markdown: "logical replication notes" }));
    cache.put(entry({ url: "https://example.com/2", title: "Other", markdown: "unrelated text" }));
    const hits = cache.search("logical postgres");
    expect(hits.some((h) => h.url === "https://example.com/1")).toBe(true);
  });

  it("clear empties cache", () => {
    cache.put(entry({ url: "https://example.com/z" }));
    cache.clear();
    expect(cache.get("https://example.com/z")).toBeNull();
    expect(cache.stats().entries).toBe(0);
  });
});
