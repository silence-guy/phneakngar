import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { webFetch } from "../src/fetch.js";
import { WebCache } from "../src/cache.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureHtml = readFileSync(join(here, "fixtures/sample.html"), "utf-8");

function mockFetch(handlers: Record<string, () => Response>): typeof fetch {
  return async (input: string | URL | Request) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const key = Object.keys(handlers).find((k) => url.startsWith(k) || url === k);
    if (!key) throw new Error(`Unexpected fetch: ${url}`);
    return handlers[key]!();
  };
}

describe("webFetch", () => {
  let dir: string;
  let cache: WebCache;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "web-brain-fetch-"));
    cache = new WebCache({ dir });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("extracts markdown from HTML via injected fetch", async () => {
    const fetchImpl = mockFetch({
      "https://example.com/article": () =>
        new Response(fixtureHtml, {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
    });
    const res = await webFetch("https://example.com/article", {
      fetchImpl,
      cache,
      // example.com resolves publicly; no private network needed
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.fromCache).toBe(false);
    expect(res.title).toContain("Sample");
    expect(res.markdown).toContain("first");
    expect(res.markdown).not.toMatch(/alert\(/);
  });

  it("serves cache on second fetch without forceRefresh", async () => {
    let hits = 0;
    const fetchImpl = mockFetch({
      "https://example.com/cached": () => {
        hits += 1;
        return new Response(fixtureHtml, {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      },
    });
    const first = await webFetch("https://example.com/cached", { fetchImpl, cache });
    expect(first.ok).toBe(true);
    expect(hits).toBe(1);

    const second = await webFetch("https://example.com/cached", { fetchImpl, cache });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.fromCache).toBe(true);
    expect(hits).toBe(1); // network not re-hit
  });

  it("rejects SSRF targets without calling fetch", async () => {
    let called = false;
    const fetchImpl: typeof fetch = async () => {
      called = true;
      return new Response("nope");
    };
    for (const bad of [
      "http://127.0.0.1/",
      "file:///etc/passwd",
      "http://192.168.0.10/admin",
      "http://169.254.169.254/latest/meta-data/",
    ]) {
      const res = await webFetch(bad, { fetchImpl });
      expect(res.ok, bad).toBe(false);
      if (!res.ok) {
        expect(["blocked_scheme", "blocked_host", "blocked_ip", "invalid_url"]).toContain(
          res.error.code,
        );
      }
    }
    expect(called).toBe(false);
  });

  it("returns structured http_error without inventing body", async () => {
    const fetchImpl = mockFetch({
      "https://example.com/nope": () => new Response("secret", { status: 403 }),
    });
    const res = await webFetch("https://example.com/nope", { fetchImpl });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("http_error");
      expect(JSON.stringify(res)).not.toContain("secret");
    }
  });
});
