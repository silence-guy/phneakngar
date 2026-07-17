import { describe, it, expect } from "vitest";
import {
  webSearch,
  createMockSearchProvider,
  parseDdgLiteHtml,
} from "../src/search.js";

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
    if (!res.ok) return;
    expect(res.provider).toBe("mock");
    expect(res.results).toHaveLength(1);
    expect(res.results[0]!.url).toContain("postgresql.org");
    expect(res.results[0]!.title).toBe("Postgres Docs");
  });

  it("parseDdgLiteHtml extracts nofollow result links", () => {
    const html = `
      <a rel="nofollow" href="https://example.com/a">Alpha Result</a>
      <td class="result-snippet">Snippet for alpha</td>
      <a rel="nofollow" href="https://duckduckgo.com/foo">skip</a>
      <a rel="nofollow" href="https://example.com/b">Beta Result</a>
    `;
    const results = parseDdgLiteHtml(html, 5);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0]!.url).toBe("https://example.com/a");
    expect(results[0]!.title).toContain("Alpha");
  });
});
