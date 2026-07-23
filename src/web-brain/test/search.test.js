import { describe, it, expect } from "vitest";
import { webSearch, createMockSearchProvider, parseDdgLiteHtml, resolveDdgResultHref, ddgTimeParam, } from "../src/search.js";
describe("webSearch", () => {
    it("requires non-empty query", async () => {
        const res = await webSearch("  ");
        expect(res.ok).toBe(false);
    });
    it("uses injected mock provider (no network)", async () => {
        const provider = createMockSearchProvider([
            {
                title: "Postgres Docs",
                url: "https://www.postgresql.org/docs/",
                snippet: "Official documentation",
            },
            {
                title: "Other",
                url: "https://example.com/other",
                snippet: "x",
            },
        ]);
        const res = await webSearch("postgres replication", {
            provider,
            maxResults: 1,
        });
        expect(res.ok).toBe(true);
        if (!res.ok)
            return;
        expect(res.provider).toBe("mock");
        expect(res.results).toHaveLength(1);
        expect(res.results[0].url).toContain("postgresql.org");
        expect(res.results[0].title).toBe("Postgres Docs");
        expect(res.degraded).toBeFalsy();
    });
    it("empty mock provider sets degraded + empty_provider_results", async () => {
        const res = await webSearch("anything", {
            provider: createMockSearchProvider([]),
        });
        expect(res.ok).toBe(true);
        if (!res.ok)
            return;
        expect(res.results).toEqual([]);
        expect(res.degraded).toBe(true);
        expect(res.error?.code).toBe("empty_provider_results");
        expect(res.telemetry?.[0]?.parseCount).toBe(0);
    });
    it("ddgTimeParam maps week to w", () => {
        expect(ddgTimeParam("week")).toBe("w");
        expect(ddgTimeParam("day")).toBe("d");
        expect(ddgTimeParam(undefined)).toBeUndefined();
    });
});
describe("resolveDdgResultHref", () => {
    it("decodes uddg redirect wrappers", () => {
        const href = "//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.reuters.com%2Flegal%2F&rut=abc";
        expect(resolveDdgResultHref(href)).toBe("https://www.reuters.com/legal/");
    });
    it("keeps direct https urls", () => {
        expect(resolveDdgResultHref("https://en.wikipedia.org/wiki/Rust")).toBe("https://en.wikipedia.org/wiki/Rust");
    });
    it("drops bare duckduckgo host links", () => {
        expect(resolveDdgResultHref("https://duckduckgo.com/foo")).toBeNull();
    });
});
describe("parseDdgLiteHtml", () => {
    it("extracts nofollow result links (legacy direct https)", () => {
        const html = `
      <a rel="nofollow" href="https://example.com/a">Alpha Result</a>
      <td class="result-snippet">Snippet for alpha</td>
      <a rel="nofollow" href="https://duckduckgo.com/foo">skip</a>
      <a rel="nofollow" href="https://example.com/b">Beta Result</a>
    `;
        const results = parseDdgLiteHtml(html, 5);
        expect(results.length).toBeGreaterThanOrEqual(1);
        expect(results[0].url).toBe("https://example.com/a");
        expect(results[0].title).toContain("Alpha");
    });
    it("extracts protocol-relative uddg result-link (news-style SERP)", () => {
        const html = `
      <a rel="nofollow" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.reuters.com%2Flegal%2F&amp;rut=f146"
         class='result-link'>Reuters Legal</a>
      <a rel="nofollow" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.law.com%2Flegaltechnews%2F&amp;rut=9c0e"
         class='result-link'>Legaltech News</a>
    `;
        const results = parseDdgLiteHtml(html, 5);
        expect(results.length).toBe(2);
        expect(results[0].url).toBe("https://www.reuters.com/legal/");
        expect(results[0].title).toContain("Reuters");
        expect(results[1].url).toBe("https://www.law.com/legaltechnews/");
    });
});
