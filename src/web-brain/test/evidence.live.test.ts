/**
 * Live/gating evidence for lean web-brain (writes SCRATCH logs when SCRATCH is set).
 * Uses the real shipped APIs; mock network for SSRF/cache unit paths; live example.com for fetch.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  webFetch,
  webSearch,
  WebCache,
  createMockSearchProvider,
  assertSafeHttpUrl,
} from "../src/index.js";

const SCRATCH =
  process.env.SCRATCH ||
  "/var/folders/2b/0bg390417hq_hyxf78274h_40000gn/T/grok-goal-4f403708680d/implementer";

function writeLog(name: string, data: unknown) {
  mkdirSync(SCRATCH, { recursive: true });
  const body = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  writeFileSync(join(SCRATCH, name), body.endsWith("\n") ? body : body + "\n");
}

describe("live evidence (shipped web-brain)", () => {
  beforeAll(() => {
    mkdirSync(SCRATCH, { recursive: true });
  });

  it("webFetch example.com + cache hit + mock search + SSRF rejects", async () => {
    const cacheDir = join(SCRATCH, "live-cache-vitest");
    const cache = new WebCache({ dir: cacheDir });

    // Always force first network fetch so a warm scratch cache cannot skew fromCache.
    const fetch1 = await webFetch("https://example.com", {
      cache,
      maxChars: 4000,
      forceRefresh: true,
    });
    writeLog("web-cli.log", {
      fetch: fetch1.ok
        ? {
            ok: true,
            title: fetch1.title,
            fromCache: fetch1.fromCache,
            markdownLen: fetch1.markdown.length,
            sample: fetch1.markdown.slice(0, 240),
          }
        : fetch1,
      searchMock: await webSearch("example domain", {
        provider: createMockSearchProvider([
          {
            title: "Example Domain",
            url: "https://example.com/",
            snippet: "mock",
          },
        ]),
      }),
    });
    expect(fetch1.ok).toBe(true);
    if (!fetch1.ok) return;
    expect(fetch1.markdown.length).toBeGreaterThan(10);
    expect(fetch1.fromCache).toBe(false);

    const fetch2 = await webFetch("https://example.com", {
      cache,
      maxChars: 4000,
    });
    writeLog("web-cache.log", {
      secondFetch: fetch2.ok
        ? { ok: true, fromCache: fetch2.fromCache, title: fetch2.title }
        : fetch2,
    });
    expect(fetch2.ok).toBe(true);
    if (fetch2.ok) expect(fetch2.fromCache).toBe(true);

    const ssrfTargets = [
      "http://127.0.0.1/",
      "file:///etc/passwd",
      "http://192.168.0.10/",
      "http://169.254.169.254/latest/meta-data/",
    ];
    const ssrfResults = [];
    for (const u of ssrfTargets) {
      const staticCheck = assertSafeHttpUrl(u);
      const fetchRes = await webFetch(u, { cache: null });
      ssrfResults.push({ url: u, staticCheck, fetchRes });
      expect(staticCheck.ok).toBe(false);
      expect(fetchRes.ok).toBe(false);
    }
    writeLog("web-ssrf.log", ssrfResults);

    writeLog(
      "web-meta.log",
      [
        `LICENSE: ${existsSync(join(process.cwd(), "LICENSE"))}`,
        `NOTICE: ${existsSync(join(process.cwd(), "NOTICE"))}`,
        `node: ${process.version}`,
        "doctor: run via phneakngar doctor (web brain check wired)",
        "RESULT: PASS",
      ].join("\n"),
    );

    writeLog("SUMMARY.log", "ALL PASS\n");
  }, 60_000);
});
