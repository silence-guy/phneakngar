/**
 * Pluggable web search. Default: DuckDuckGo HTML lite (best-effort, $0).
 * Tests inject a mock provider — never hardcode result bodies in production paths.
 */

import type {
  SearchOptions,
  SearchProvider,
  WebSearchResponse,
  WebSearchResult,
} from "./types.js";
import { toWebError } from "./ssrf.js";

/** Parse DDG lite HTML for result links — structural, best-effort. */
export function parseDdgLiteHtml(html: string, maxResults: number): WebSearchResult[] {
  const results: WebSearchResult[] = [];
  // DDG lite uses result links like <a rel="nofollow" href="https://...">title</a>
  // and class result-snippet / result__snippet variants over time.
  const linkRe =
    /<a[^>]+rel=["']nofollow["'][^>]+href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) !== null && results.length < maxResults) {
    const url = m[1];
    if (!url || seen.has(url)) continue;
    if (url.includes("duckduckgo.com")) continue;
    seen.add(url);
    const title = m[2]
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
    if (!title) continue;
    results.push({ title, url, snippet: "" });
  }

  // Snippets: pair roughly by order from result__snippet or similar
  const snippetRe =
    /class=["'][^"']*result(?:__|-)?snippet[^"']*["'][^>]*>([\s\S]*?)<\//gi;
  const snippets: string[] = [];
  let sm: RegExpExecArray | null;
  while ((sm = snippetRe.exec(html)) !== null) {
    snippets.push(
      sm[1]
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim(),
    );
  }
  for (let i = 0; i < results.length; i++) {
    if (snippets[i]) results[i]!.snippet = snippets[i]!;
  }
  return results;
}

export const ddgLiteProvider: SearchProvider = {
  name: "ddg-lite",
  async search(query, { maxResults, fetchImpl }) {
    const u = new URL("https://lite.duckduckgo.com/lite/");
    // DDG lite accepts q via POST or GET; GET is simpler
    u.searchParams.set("q", query);
    const res = await fetchImpl(u.toString(), {
      method: "GET",
      signal: AbortSignal.timeout(12_000),
      headers: {
        Accept: "text/html",
        "User-Agent": "phneakngar-web-brain/0.0.2",
      },
    });
    if (!res.ok) {
      throw new Error(`Search HTTP ${res.status}`);
    }
    const html = await res.text();
    return parseDdgLiteHtml(html, maxResults);
  },
};

/**
 * Mock-friendly search entry. Prefer injecting `provider` in tests.
 */
export async function webSearch(
  query: string,
  opts: SearchOptions = {},
): Promise<WebSearchResponse> {
  const q = query?.trim() ?? "";
  if (!q) {
    return toWebError("invalid_url", "Search query is required");
  }
  const maxResults = Math.min(Math.max(opts.maxResults ?? 5, 1), 20);
  const provider = opts.provider ?? ddgLiteProvider;
  const fetchImpl = opts.fetchImpl ?? fetch;

  try {
    const results = await provider.search(q, { maxResults, fetchImpl });
    return {
      ok: true,
      query: q,
      results: results.slice(0, maxResults),
      provider: provider.name,
    };
  } catch (err) {
    return toWebError(
      "search_failed",
      err instanceof Error ? err.message : String(err),
    );
  }
}

export function createMockSearchProvider(
  results: WebSearchResult[],
  name = "mock",
): SearchProvider {
  return {
    name,
    async search(_query, { maxResults }) {
      return results.slice(0, maxResults);
    },
  };
}
