import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isSafeCrawlPattern, matchesPatterns } from "../src/url-utils.js";
import { envCookieHostAllowed, resolveAuth } from "../src/auth.js";

/**
 * ReDoS guard. include_patterns/exclude_patterns come from an MCP tool call and were compiled
 * with `new RegExp` then run against every discovered link with no timeout, so `(a+)+$` froze
 * the process. JS has no regex execution budget, so pathological shapes are refused instead.
 */
describe("isSafeCrawlPattern", () => {
  it("accepts ordinary URL patterns", () => {
    expect(isSafeCrawlPattern("^https://docs\\.example\\.com/")).toBe(true);
    expect(isSafeCrawlPattern("/blog/.*")).toBe(true);
    expect(isSafeCrawlPattern("\\.pdf$")).toBe(true);
  });

  it("rejects nested quantifiers that cause catastrophic backtracking", () => {
    expect(isSafeCrawlPattern("(a+)+$")).toBe(false);
    expect(isSafeCrawlPattern("(a*)*$")).toBe(false);
    expect(isSafeCrawlPattern("(?:a+)+$")).toBe(false);
    expect(isSafeCrawlPattern("(a+){2,}")).toBe(false);
    expect(isSafeCrawlPattern("([a-z]+)*$")).toBe(false);
  });

  it("rejects adjacent unbounded quantifiers", () => {
    expect(isSafeCrawlPattern("a**")).toBe(false);
    expect(isSafeCrawlPattern("a+*")).toBe(false);
  });

  it("rejects over-long patterns and invalid regexes", () => {
    expect(isSafeCrawlPattern("a".repeat(500))).toBe(false);
    expect(isSafeCrawlPattern("(unclosed")).toBe(false);
    expect(isSafeCrawlPattern("")).toBe(false);
  });
});

describe("matchesPatterns", () => {
  it("still filters normally", () => {
    expect(matchesPatterns("https://a.example/docs/x", ["/docs/"])).toBe(true);
    expect(matchesPatterns("https://a.example/blog/x", ["/docs/"])).toBe(false);
    expect(matchesPatterns("https://a.example/x.pdf", undefined, ["\\.pdf$"])).toBe(false);
  });

  it("allows everything when no patterns are given", () => {
    expect(matchesPatterns("https://a.example/x")).toBe(true);
  });

  it("does not hang on a catastrophic include pattern", () => {
    const url = "https://a.example/" + "a".repeat(60) + "!";
    const start = Date.now();
    // Fails closed: a refused include pattern matches nothing, so the URL is excluded.
    expect(matchesPatterns(url, ["(a+)+$"])).toBe(false);
    expect(Date.now() - start).toBeLessThan(1000);
  });

  it("does not hang on a catastrophic exclude pattern", () => {
    const url = "https://a.example/" + "a".repeat(60) + "!";
    const start = Date.now();
    // A refused exclude pattern does not block the URL.
    expect(matchesPatterns(url, undefined, ["(a+)+$"])).toBe(true);
    expect(Date.now() - start).toBeLessThan(1000);
  });

  it("caps the number of patterns considered", () => {
    const many = Array.from({ length: 100 }, (_, i) => `/p${i}/`);
    // Pattern 90 is beyond the cap, so it does not grant a match.
        expect(matchesPatterns("https://a.example/p90/", many)).toBe(false);
    // One inside the cap still does.
    expect(matchesPatterns("https://a.example/p3/", many)).toBe(true);
  });
});

/**
 * The env cookie is the operator's real session. Unlike the file-based sources it previously
 * ignored the destination host entirely, so any agent-directed crawl (or redirect hop) could
 * hand it to an attacker-controlled origin.
 */
describe("envCookieHostAllowed", () => {
  const ORIGINAL_HOSTS = process.env.PHNEAKNGAR_AUTH_COOKIE_HOSTS;

  afterEach(() => {
    if (ORIGINAL_HOSTS === undefined) delete process.env.PHNEAKNGAR_AUTH_COOKIE_HOSTS;
    else process.env.PHNEAKNGAR_AUTH_COOKIE_HOSTS = ORIGINAL_HOSTS;
  });

  it("fails closed when no allowlist is configured", () => {
    delete process.env.PHNEAKNGAR_AUTH_COOKIE_HOSTS;
    expect(envCookieHostAllowed("wiki.internal")).toBe(false);
  });

  it("allows an exact host and its subdomains", () => {
    process.env.PHNEAKNGAR_AUTH_COOKIE_HOSTS = "wiki.internal, example.com";
    expect(envCookieHostAllowed("wiki.internal")).toBe(true);
    expect(envCookieHostAllowed("docs.example.com")).toBe(true);
  });

  it("rejects a host outside the allowlist", () => {
    process.env.PHNEAKNGAR_AUTH_COOKIE_HOSTS = "wiki.internal";
    expect(envCookieHostAllowed("attacker.example")).toBe(false);
  });

  it("rejects a lookalike suffix", () => {
    process.env.PHNEAKNGAR_AUTH_COOKIE_HOSTS = "example.com";
    expect(envCookieHostAllowed("notexample.com")).toBe(false);
    expect(envCookieHostAllowed("example.com.evil.example")).toBe(false);
  });

  it("rejects a missing host", () => {
    process.env.PHNEAKNGAR_AUTH_COOKIE_HOSTS = "example.com";
    expect(envCookieHostAllowed(undefined)).toBe(false);
  });
});

describe("resolveAuth env cookie scoping", () => {
  const ORIGINAL_HEADER = process.env.PHNEAKNGAR_AUTH_COOKIE_HEADER;
  const ORIGINAL_HOSTS = process.env.PHNEAKNGAR_AUTH_COOKIE_HOSTS;
  const ORIGINAL_USE = process.env.PHNEAKNGAR_USE_AUTH;

  beforeEach(() => {
    process.env.PHNEAKNGAR_AUTH_COOKIE_HEADER = "session=operator-secret";
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const [k, v] of [
      ["PHNEAKNGAR_AUTH_COOKIE_HEADER", ORIGINAL_HEADER],
      ["PHNEAKNGAR_AUTH_COOKIE_HOSTS", ORIGINAL_HOSTS],
      ["PHNEAKNGAR_USE_AUTH", ORIGINAL_USE],
    ] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("attaches the cookie for an allowlisted host", () => {
    process.env.PHNEAKNGAR_AUTH_COOKIE_HOSTS = "wiki.internal";
    const auth = resolveAuth({ useAuth: true, host: "wiki.internal" });
    expect(auth?.cookieHeader).toBe("session=operator-secret");
  });

  it("does NOT attach the cookie to a non-allowlisted host", () => {
    process.env.PHNEAKNGAR_AUTH_COOKIE_HOSTS = "wiki.internal";
    const auth = resolveAuth({ useAuth: true, host: "attacker.example" });
    expect(auth?.cookieHeader).not.toBe("session=operator-secret");
  });

  it("does NOT attach the cookie when the allowlist is unset", () => {
    delete process.env.PHNEAKNGAR_AUTH_COOKIE_HOSTS;
    const auth = resolveAuth({ useAuth: true, host: "wiki.internal" });
    expect(auth?.cookieHeader).not.toBe("session=operator-secret");
  });

  it("still honours an explicitly passed cookieHeader (caller's own choice)", () => {
    delete process.env.PHNEAKNGAR_AUTH_COOKIE_HOSTS;
    const auth = resolveAuth({ useAuth: true, cookieHeader: "explicit=1", host: "any.example" });
    expect(auth?.cookieHeader).toBe("explicit=1");
  });
});
