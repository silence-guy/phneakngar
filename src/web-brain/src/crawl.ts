/**
 * Capped BFS crawl with SSRF, robots.txt, and per-host rate limiting.
 */

import { webFetch } from "./fetch.js";
import { fetchHtml } from "./structured-extract.js";
import {
  isPathAllowed,
  isUrlAllowedByRobots,
  parseRobotsTxt,
  type RobotsRules,
} from "./robots.js";
import { assertSafeHttpUrl, toWebError } from "./ssrf.js";
import type { FetchOptions, WebCacheLike, WebError } from "./types.js";

export type CrawlPage = {
  url: string;
  finalUrl: string;
  title: string;
  markdown: string;
  depth: number;
  fromCache: boolean;
};

export type CrawlSuccess = {
  ok: true;
  seed: string;
  pages: CrawlPage[];
  skipped: { url: string; reason: string }[];
  robotsFetched: boolean;
};

export type CrawlResponse = CrawlSuccess | WebError;

export type CrawlOptions = {
  maxDepth?: number;
  maxPages?: number;
  /** Stay on seed hostname (default true). */
  sameHost?: boolean;
  fetchOpts?: FetchOptions;
  cache?: WebCacheLike | null;
  /** Respect robots.txt (default true). */
  respectRobots?: boolean;
  /** Delay between requests to same host ms (default 250; robots crawl-delay may raise). */
  minDelayMs?: number;
  fetchImpl?: typeof fetch;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Extract same-document http(s) links from HTML. */
export function extractLinks(html: string, baseUrl: string): string[] {
  const out: string[] = [];
  const re = /<a\b[^>]+href=["']([^"'#]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[1]!.trim();
    if (!href || href.startsWith("mailto:") || href.startsWith("javascript:")) continue;
    try {
      const abs = new URL(href, baseUrl);
      if (abs.protocol !== "http:" && abs.protocol !== "https:") continue;
      abs.hash = "";
      out.push(abs.toString());
    } catch {
      // skip
    }
  }
  return [...new Set(out)];
}

async function loadRobots(
  origin: string,
  opts: FetchOptions,
): Promise<RobotsRules> {
  const robotsUrl = `${origin}/robots.txt`;
  const res = await fetchHtml(robotsUrl, { ...opts, forceRefresh: true });
  if (!res.ok) {
    return { disallows: [], allows: [], crawlDelayMs: null };
  }
  return parseRobotsTxt(res.html);
}

/**
 * Breadth-first crawl from seed URL.
 * Caps: maxDepth default 1, maxPages default 10 (hard max 20 / depth 2).
 */
export async function webCrawl(
  seedUrl: string,
  opts: CrawlOptions = {},
): Promise<CrawlResponse> {
  const maxDepth = Math.min(Math.max(opts.maxDepth ?? 1, 0), 2);
  const maxPages = Math.min(Math.max(opts.maxPages ?? 10, 1), 20);
  const sameHost = opts.sameHost !== false;
  const respectRobots = opts.respectRobots !== false;
  const minDelayMs = Math.max(opts.minDelayMs ?? 250, 0);
  const allowPrivate = opts.fetchOpts?.allowPrivateNetwork ?? false;
  const fetchImpl = opts.fetchImpl ?? opts.fetchOpts?.fetchImpl ?? fetch;

  const seedSafe = assertSafeHttpUrl(seedUrl, {
    allowPrivateNetwork: allowPrivate,
  });
  if (!seedSafe.ok) return toWebError(seedSafe.code, seedSafe.message);

  const seed = seedSafe.url;
  const origin = seed.origin;
  const host = seed.hostname.toLowerCase();

  const fetchOpts: FetchOptions = {
    ...opts.fetchOpts,
    fetchImpl,
    cache: opts.cache ?? opts.fetchOpts?.cache,
    allowPrivateNetwork: allowPrivate,
  };

  let robots: RobotsRules = { disallows: [], allows: [], crawlDelayMs: null };
  let robotsFetched = false;
  if (respectRobots) {
    robots = await loadRobots(origin, fetchOpts);
    robotsFetched = true;
  }
  const delayMs = Math.max(minDelayMs, robots.crawlDelayMs ?? 0);

  const queue: { url: string; depth: number }[] = [{ url: seed.toString(), depth: 0 }];
  const seen = new Set<string>();
  const pages: CrawlPage[] = [];
  const skipped: { url: string; reason: string }[] = [];
  let lastFetchAt = 0;

  while (queue.length && pages.length < maxPages) {
    const item = queue.shift()!;
    if (seen.has(item.url)) continue;
    seen.add(item.url);

    const safe = assertSafeHttpUrl(item.url, {
      allowPrivateNetwork: allowPrivate,
    });
    if (!safe.ok) {
      skipped.push({ url: item.url, reason: safe.message });
      continue;
    }

    if (sameHost && safe.url.hostname.toLowerCase() !== host) {
      skipped.push({ url: item.url, reason: "off-host" });
      continue;
    }

    if (respectRobots && !isUrlAllowedByRobots(item.url, robots)) {
      skipped.push({ url: item.url, reason: "robots-disallow" });
      continue;
    }

    const wait = delayMs - (Date.now() - lastFetchAt);
    if (wait > 0) await sleep(wait);

    const htmlRes = await fetchHtml(item.url, {
      ...fetchOpts,
      forceRefresh: false,
    });
    lastFetchAt = Date.now();

    // Also get markdown via webFetch (uses cache when available)
    const mdRes = await webFetch(item.url, {
      ...fetchOpts,
      forceRefresh: false,
    });

    if (!mdRes.ok) {
      skipped.push({
        url: item.url,
        reason: mdRes.error.message,
      });
      continue;
    }

    pages.push({
      url: item.url,
      finalUrl: mdRes.finalUrl,
      title: mdRes.title,
      markdown: mdRes.markdown,
      depth: item.depth,
      fromCache: mdRes.fromCache,
    });

    if (item.depth >= maxDepth || pages.length >= maxPages) continue;
    if (!htmlRes.ok) continue;

    for (const link of extractLinks(htmlRes.html, mdRes.finalUrl)) {
      if (seen.has(link)) continue;
      if (sameHost) {
        try {
          if (new URL(link).hostname.toLowerCase() !== host) continue;
        } catch {
          continue;
        }
      }
      if (respectRobots && !isPathAllowed(new URL(link).pathname, robots)) {
        continue;
      }
      queue.push({ url: link, depth: item.depth + 1 });
    }
  }

  return {
    ok: true,
    seed: seed.toString(),
    pages,
    skipped,
    robotsFetched,
  };
}
