/**
 * Multi-strategy crawl (BFS / DFS / sitemap / auto / map).
 * Lean port of agent-crawl behaviors: robots, sitemap-first, pattern filters,
 * canonical dedup, doc-path prioritization. Single fetch per page.
 */

import { createHash } from "node:crypto";
import { extractFromHtml } from "./extract.js";
import { fetchHtml } from "./structured-extract.js";
import {
  isPathAllowed,
  isUrlAllowedByRobots,
  parseRobotsTxt,
  type RobotsRules,
} from "./robots.js";
import { assertSafeHttpUrl, toWebError } from "./ssrf.js";
import { discoverSitemapUrls } from "./sitemap.js";
import {
  canonicalForCrawl,
  canonicalForOutput,
  matchesPatterns,
  prioritizeDocLinks,
  stripFragment,
} from "./url-utils.js";
import type { FetchOptions, WebCacheLike, WebError } from "./types.js";
import { deduplicatePages } from "./dedup.js";
import { indexCrawlResult, isIndexingEnabled } from "./embed.js";
import {
  applyAggregateMarkdownBudget,
  buildEvidenceFromMarkdown,
  DEFAULT_MAX_TOTAL_CHARS,
  MIN_TOKENS_PER_PAGE,
  scaleDefaultTokens,
  truncateByChars,
  type EvidenceItem,
} from "./budget.js";

export type CrawlStrategy = "bfs" | "dfs" | "sitemap" | "auto" | "map";

export type CrawlPage = {
  url: string;
  finalUrl: string;
  title: string;
  markdown: string;
  depth: number;
  fromCache: boolean;
  evidence?: EvidenceItem[];
  excerpt?: string;
};

export type CrawlLinkEdge = { from: string; to: string };

export type CrawlSuccess = {
  ok: true;
  seed: string;
  strategyUsed: CrawlStrategy;
  pages: CrawlPage[];
  /** Unique URLs discovered (visited + still queued), not only fetched. */
  totalFound: number;
  crawled: number;
  skipped: { url: string; reason: string }[];
  robotsFetched: boolean;
  sitemapFound: boolean;
  /** Present when strategy=map (URL discovery only). */
  urls?: string[];
  /** Optional inter-page edges when extractLinks=true. */
  links?: CrawlLinkEdge[];
  /** Pages dropped after max_total_chars budget. */
  droppedOverBudget?: number;
  /** Whether crawl pages were embedded (PHNEAKNGAR_CRAWL_INDEX=1). */
  indexed?: number;
  authUsed?: boolean;
};

export type CrawlResponse = CrawlSuccess | WebError;

export type CrawlOptions = {
  strategy?: CrawlStrategy;
  maxDepth?: number;
  maxPages?: number;
  /** Stay on seed hostname (default true). */
  sameHost?: boolean;
  includePatterns?: string[];
  excludePatterns?: string[];
  /** Emit link graph edges (default false). */
  extractLinksGraph?: boolean;
  fetchOpts?: FetchOptions;
  cache?: WebCacheLike | null;
  respectRobots?: boolean;
  minDelayMs?: number;
  fetchImpl?: typeof fetch;
  /** Max markdown chars per page (default 30_000). */
  maxChars?: number;
  /** Use cookie/auth state for fetches. */
  useAuth?: boolean;
  authStatePath?: string;
  /** Strip cross-page nav/boilerplate (default true when ≥2 pages). */
  dedupeBoilerplate?: boolean;
  /** Total markdown char budget across all pages. */
  maxTotalChars?: number;
  /** Aggregate token budget (approx cl100k). */
  maxTokensOut?: number;
  /** Keep full markdown (default true); false → evidence/excerpt only. */
  includeFullMarkdown?: boolean;
  /** Index pages into local vector store (or env PHNEAKNGAR_CRAWL_INDEX=1). */
  indexPages?: boolean;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Extract http(s) links from HTML (absolute). */
export function extractLinks(html: string, baseUrl: string): string[] {
  const out: string[] = [];
  const re = /<a\b[^>]+href=["']([^"'#][^"']*)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[1]!.trim();
    if (!href || href.startsWith("mailto:") || href.startsWith("javascript:")) {
      continue;
    }
    if (href.startsWith("tel:") || href.startsWith("data:")) continue;
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
): Promise<{ rules: RobotsRules; raw: string | null }> {
  const robotsUrl = `${origin}/robots.txt`;
  const res = await fetchHtml(robotsUrl, { ...opts, forceRefresh: true });
  if (!res.ok) {
    return {
      rules: { disallows: [], allows: [], crawlDelayMs: null },
      raw: null,
    };
  }
  return { rules: parseRobotsTxt(res.html), raw: res.html };
}

function hashContent(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

type FetchPageResult =
  | {
      ok: true;
      url: string;
      finalUrl: string;
      title: string;
      markdown: string;
      html: string;
      fromCache: boolean;
      links: string[];
    }
  | { ok: false; reason: string };

/**
 * One network/cache path: HTML → markdown + links; optional disk cache write.
 */
async function fetchPage(
  url: string,
  opts: {
    fetchOpts: FetchOptions;
    maxChars: number;
    cache: WebCacheLike | null | undefined;
  },
): Promise<FetchPageResult> {
  const cacheKey = url;
  if (opts.cache && !opts.fetchOpts.forceRefresh) {
    const hit = opts.cache.get(cacheKey);
    if (hit) {
      // Cache has markdown only — re-fetch HTML only when we need more links
      // at expansion time; for leaf pages cache is enough.
      return {
        ok: true,
        url: hit.url,
        finalUrl: hit.finalUrl,
        title: hit.title,
        markdown: hit.markdown,
        html: "",
        fromCache: true,
        links: [],
      };
    }
  }

  const htmlRes = await fetchHtml(url, opts.fetchOpts);
  if (!htmlRes.ok) {
    return { ok: false, reason: htmlRes.error.message };
  }

  const extracted = extractFromHtml(htmlRes.html, opts.maxChars);
  const links = extractLinks(htmlRes.html, htmlRes.finalUrl);
  const fetchedAt = new Date().toISOString();
  const contentHash = hashContent(extracted.markdown);

  if (opts.cache) {
    opts.cache.put({
      url: cacheKey,
      finalUrl: htmlRes.finalUrl,
      title: extracted.title,
      markdown: extracted.markdown,
      contentType: "text/html",
      httpStatus: 200,
      fetchedAt,
      contentHash,
    });
  }

  return {
    ok: true,
    url: cacheKey,
    finalUrl: htmlRes.finalUrl,
    title: extracted.title,
    markdown: extracted.markdown,
    html: htmlRes.html,
    fromCache: false,
    links,
  };
}

/**
 * Multi-strategy crawl from seed URL.
 * Caps: maxDepth default 2 (hard max 3), maxPages default 20 (hard max 50).
 */
export async function webCrawl(
  seedUrl: string,
  opts: CrawlOptions = {},
): Promise<CrawlResponse> {
  const strategy: CrawlStrategy = opts.strategy ?? "bfs";
  const maxDepth = Math.min(Math.max(opts.maxDepth ?? 2, 0), 3);
  const maxPages = Math.min(Math.max(opts.maxPages ?? 20, 1), 50);
  const sameHost = opts.sameHost !== false;
  const respectRobots = opts.respectRobots !== false;
  const minDelayMs = Math.max(opts.minDelayMs ?? 250, 0);
  const allowPrivate = opts.fetchOpts?.allowPrivateNetwork ?? false;
  const fetchImpl = opts.fetchImpl ?? opts.fetchOpts?.fetchImpl ?? fetch;
  const maxChars = opts.maxChars ?? 30_000;
  const includePatterns = opts.includePatterns;
  const excludePatterns = opts.excludePatterns;
  const extractLinksGraph = opts.extractLinksGraph === true;
  const useAuth = opts.useAuth === true || process.env.PHNEAKNGAR_USE_AUTH === "1";
  const dedupeBoilerplate = opts.dedupeBoilerplate !== false;
  const maxTotalChars = opts.maxTotalChars ?? DEFAULT_MAX_TOTAL_CHARS;
  const includeFullMarkdown = opts.includeFullMarkdown !== false;
  const doIndex = opts.indexPages === true || isIndexingEnabled();

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
    useAuth,
    authStatePath: opts.authStatePath ?? opts.fetchOpts?.authStatePath,
  };
  const cache = opts.cache ?? opts.fetchOpts?.cache ?? null;

  let robots: RobotsRules = { disallows: [], allows: [], crawlDelayMs: null };
  let robotsRaw: string | null = null;
  let robotsFetched = false;
  if (respectRobots) {
    const loaded = await loadRobots(origin, fetchOpts);
    robots = loaded.rules;
    robotsRaw = loaded.raw;
    robotsFetched = true;
  }
  const delayMs = Math.max(minDelayMs, robots.crawlDelayMs ?? 0);

  const lightFetch = async (url: string) => {
    const r = await fetchHtml(url, { ...fetchOpts, forceRefresh: true });
    if (!r.ok) return { ok: false as const };
    return { ok: true as const, body: r.html, status: 200 };
  };

  // --- strategy: map (URL discovery only) ---
  if (strategy === "map") {
    return runMapStrategy({
      seed: seed.toString(),
      origin,
      host,
      sameHost,
      maxDepth,
      maxPages,
      includePatterns,
      excludePatterns,
      respectRobots,
      robots,
      robotsRaw,
      robotsFetched,
      delayMs,
      lightFetch,
      fetchOpts,
      allowPrivate,
    });
  }

  // --- resolve effective strategy ---
  let strategyUsed: CrawlStrategy = strategy;
  let sitemapUrls: string[] = [];
  let sitemapFound = false;

  if (strategy === "sitemap" || strategy === "auto") {
    sitemapUrls = await discoverSitemapUrls(origin, lightFetch, robotsRaw);
    sitemapFound = sitemapUrls.length > 0;
    if (sitemapFound) {
      strategyUsed = "sitemap";
    } else if (strategy === "sitemap") {
      strategyUsed = "bfs"; // fallback
    } else {
      strategyUsed = "bfs";
    }
  }

  const pages: CrawlPage[] = [];
  const skipped: { url: string; reason: string }[] = [];
  const linkEdges: CrawlLinkEdge[] = [];
  const seenEdges = new Set<string>();
  let lastFetchAt = 0;

  const seedCanon = canonicalForCrawl(seed.toString());
  const allowUrl = (url: string, opts?: { isSeed?: boolean }): string | null => {
    const safe = assertSafeHttpUrl(url, { allowPrivateNetwork: allowPrivate });
    if (!safe.ok) return safe.message;
    if (sameHost && safe.url.hostname.toLowerCase() !== host) return "off-host";
    // Seed always allowed through include whitelist; still honor exclude/robots.
    const isSeed =
      opts?.isSeed === true || canonicalForCrawl(url) === seedCanon;
    if (
      !isSeed &&
      !matchesPatterns(url, includePatterns, excludePatterns)
    ) {
      return "pattern-filter";
    }
    if (
      isSeed &&
      excludePatterns?.length &&
      !matchesPatterns(url, undefined, excludePatterns)
    ) {
      return "pattern-filter";
    }
    if (respectRobots && !isUrlAllowedByRobots(url, robots)) {
      return "robots-disallow";
    }
    return null;
  };

  const pace = async () => {
    const wait = delayMs - (Date.now() - lastFetchAt);
    if (wait > 0) await sleep(wait);
  };

  const recordEdge = (from: string, to: string) => {
    if (!extractLinksGraph) return;
    const key = `${from}\0${stripFragment(to)}`;
    if (seenEdges.has(key)) return;
    seenEdges.add(key);
    linkEdges.push({ from, to: stripFragment(to) });
  };

  // --- sitemap fetch list ---
  if (strategyUsed === "sitemap") {
    const seenCanon = new Set<string>();
    const ordered: string[] = [];
    for (const u of sitemapUrls) {
      const c = canonicalForCrawl(u);
      if (seenCanon.has(c)) continue;
      seenCanon.add(c);
      if (allowUrl(u)) continue;
      ordered.push(u);
    }
    const totalFound = ordered.length;
    for (const url of ordered.slice(0, maxPages)) {
      await pace();
      const page = await fetchPage(url, { fetchOpts, maxChars, cache });
      lastFetchAt = Date.now();
      if (!page.ok) {
        skipped.push({ url, reason: page.reason });
        continue;
      }
      pages.push({
        url: canonicalForOutput(page.finalUrl),
        finalUrl: page.finalUrl,
        title: page.title,
        markdown: page.markdown,
        depth: 0,
        fromCache: page.fromCache,
      });
      if (extractLinksGraph) {
        for (const l of page.links) recordEdge(url, l);
      }
    }
    return finalizeCrawl({
      seed: seed.toString(),
      strategyUsed,
      pages,
      totalFound,
      skipped,
      robotsFetched,
      sitemapFound: true,
      links: extractLinksGraph ? linkEdges : undefined,
      dedupeBoilerplate,
      maxTotalChars,
      maxTokensOut: opts.maxTokensOut,
      includeFullMarkdown,
      doIndex,
      useAuth,
    });
  }

  // --- BFS / DFS traversal ---
  const traversal: "bfs" | "dfs" = strategyUsed === "dfs" ? "dfs" : "bfs";
  const queue: { url: string; depth: number }[] = [
    { url: seed.toString(), depth: 0 },
  ];
  const visited = new Set<string>([canonicalForCrawl(seed.toString())]);

  while (queue.length && pages.length < maxPages) {
    const item =
      traversal === "dfs" ? queue.pop()! : queue.shift()!;

    const deny = allowUrl(item.url);
    if (deny) {
      skipped.push({ url: item.url, reason: deny });
      continue;
    }

    await pace();
    const page = await fetchPage(item.url, { fetchOpts, maxChars, cache });
    lastFetchAt = Date.now();

    if (!page.ok) {
      skipped.push({ url: item.url, reason: page.reason });
      continue;
    }

    // Cache hit without HTML: if we need to expand, re-fetch for links
    let links = page.links;
    if (
      page.fromCache &&
      item.depth < maxDepth &&
      pages.length < maxPages &&
      links.length === 0
    ) {
      const htmlRes = await fetchHtml(item.url, {
        ...fetchOpts,
        forceRefresh: true,
      });
      lastFetchAt = Date.now();
      if (htmlRes.ok) {
        links = extractLinks(htmlRes.html, htmlRes.finalUrl);
      }
    }

    pages.push({
      url: canonicalForOutput(page.finalUrl),
      finalUrl: page.finalUrl,
      title: page.title,
      markdown: page.markdown,
      depth: item.depth,
      fromCache: page.fromCache,
    });

    if (item.depth >= maxDepth || pages.length >= maxPages) continue;

    const filtered = prioritizeDocLinks(
      links.filter((link) => {
        if (visited.has(canonicalForCrawl(link))) return false;
        if (allowUrl(link)) return false;
        return true;
      }),
    );

    for (const link of filtered) {
      const c = canonicalForCrawl(link);
      if (visited.has(c)) continue;
      visited.add(c);
      queue.push({ url: link, depth: item.depth + 1 });
      recordEdge(item.url, link);
    }
  }

  return finalizeCrawl({
    seed: seed.toString(),
    strategyUsed: traversal,
    pages,
    totalFound: visited.size,
    skipped,
    robotsFetched,
    sitemapFound,
    links: extractLinksGraph ? linkEdges : undefined,
    dedupeBoilerplate,
    maxTotalChars,
    maxTokensOut: opts.maxTokensOut,
    includeFullMarkdown,
    doIndex,
    useAuth,
  });
}

async function finalizeCrawl(args: {
  seed: string;
  strategyUsed: CrawlStrategy;
  pages: CrawlPage[];
  totalFound: number;
  skipped: { url: string; reason: string }[];
  robotsFetched: boolean;
  sitemapFound: boolean;
  links?: CrawlLinkEdge[];
  dedupeBoilerplate: boolean;
  maxTotalChars: number;
  maxTokensOut?: number;
  includeFullMarkdown: boolean;
  doIndex: boolean;
  useAuth: boolean;
}): Promise<CrawlSuccess> {
  let pages = args.pages;

  if (args.dedupeBoilerplate && pages.length > 1) {
    let domain: string | undefined;
    try {
      domain = new URL(args.seed).hostname;
    } catch {
      domain = undefined;
    }
    const deduped = deduplicatePages(
      pages.map((p) => ({ url: p.url, markdown: p.markdown })),
      domain,
    );
    pages = pages.map((p, i) => ({
      ...p,
      markdown: deduped[i]?.markdown ?? p.markdown,
    }));
  }

  // Char budget across pages
  let droppedOverBudget = 0;
  {
    const budgeted: CrawlPage[] = [];
    let charCount = 0;
    for (const page of pages) {
      if (
        charCount + page.markdown.length > args.maxTotalChars &&
        budgeted.length > 0
      ) {
        droppedOverBudget += 1;
        continue;
      }
      let md = page.markdown;
      if (charCount + md.length > args.maxTotalChars) {
        md = truncateByChars(md, Math.max(0, args.maxTotalChars - charCount));
      }
      budgeted.push({ ...page, markdown: md });
      charCount += md.length;
    }
    pages = budgeted;
  }

  const maxTokensOut =
    args.maxTokensOut ?? scaleDefaultTokens(pages.length);

  // Evidence while full markdown still present
  for (const page of pages) {
    if (!page.markdown) continue;
    page.evidence = buildEvidenceFromMarkdown(
      args.seed,
      page.title || page.url,
      page.url,
      page.markdown,
      { maxTokensOut: Math.min(400, maxTokensOut), maxItems: 1 },
    );
  }

  // Vector index uses full (char-budgeted) markdown before token strip
  let indexed = 0;
  if (args.doIndex) {
    for (const page of pages) {
      const ok = await indexCrawlResult({
        url: page.url,
        title: page.title,
        markdown: page.markdown,
      });
      if (ok) indexed += 1;
    }
  }

  if (!args.includeFullMarkdown) {
    for (const page of pages) {
      if (!page.evidence?.length && page.markdown) {
        page.excerpt = page.markdown.slice(0, 600);
      }
      page.markdown = "";
    }
  } else {
    applyAggregateMarkdownBudget(
      pages,
      (p) => p.markdown,
      (p, body) => {
        p.markdown = body;
      },
      { maxTokensOut, minTokensPerItem: MIN_TOKENS_PER_PAGE },
    );
  }

  return {
    ok: true,
    seed: args.seed,
    strategyUsed: args.strategyUsed,
    pages,
    totalFound: args.totalFound,
    crawled: pages.length,
    skipped: args.skipped,
    robotsFetched: args.robotsFetched,
    sitemapFound: args.sitemapFound,
    ...(args.links ? { links: args.links } : {}),
    ...(droppedOverBudget > 0 ? { droppedOverBudget } : {}),
    ...(indexed > 0 ? { indexed } : {}),
    authUsed: args.useAuth,
  };
}

async function runMapStrategy(ctx: {
  seed: string;
  origin: string;
  host: string;
  sameHost: boolean;
  maxDepth: number;
  maxPages: number;
  includePatterns?: string[];
  excludePatterns?: string[];
  respectRobots: boolean;
  robots: RobotsRules;
  robotsRaw: string | null;
  robotsFetched: boolean;
  delayMs: number;
  lightFetch: (
    url: string,
  ) => Promise<{ ok: true; body: string; status: number } | { ok: false }>;
  fetchOpts: FetchOptions;
  allowPrivate: boolean;
}): Promise<CrawlResponse> {
  const discovered: string[] = [];
  const seen = new Set<string>();
  let sitemapFound = false;

  const pushUrl = (url: string) => {
    if (discovered.length >= ctx.maxPages) return;
    const c = canonicalForCrawl(url);
    if (seen.has(c)) return;
    if (ctx.sameHost) {
      try {
        if (new URL(url).hostname.toLowerCase() !== ctx.host) return;
      } catch {
        return;
      }
    }
    if (!matchesPatterns(url, ctx.includePatterns, ctx.excludePatterns)) return;
    if (ctx.respectRobots && !isUrlAllowedByRobots(url, ctx.robots)) return;
    const safe = assertSafeHttpUrl(url, {
      allowPrivateNetwork: ctx.allowPrivate,
    });
    if (!safe.ok) return;
    seen.add(c);
    discovered.push(canonicalForOutput(url));
  };

  pushUrl(ctx.seed);

  const sm = await discoverSitemapUrls(
    ctx.origin,
    ctx.lightFetch,
    ctx.robotsRaw,
  );
  if (sm.length > 0) {
    sitemapFound = true;
    for (const u of sm) pushUrl(u);
  }

  // Light BFS for more URLs (HTML only, no markdown)
  const queue: { url: string; depth: number }[] = [{ url: ctx.seed, depth: 0 }];
  const queued = new Set<string>([canonicalForCrawl(ctx.seed)]);
  let last = 0;

  while (queue.length && discovered.length < ctx.maxPages) {
    const item = queue.shift()!;
    if (item.depth >= ctx.maxDepth) continue;
    const wait = ctx.delayMs - (Date.now() - last);
    if (wait > 0) await sleep(wait);
    const htmlRes = await fetchHtml(item.url, {
      ...ctx.fetchOpts,
      forceRefresh: item.depth === 0,
    });
    last = Date.now();
    if (!htmlRes.ok) continue;
    for (const link of extractLinks(htmlRes.html, htmlRes.finalUrl)) {
      pushUrl(link);
      const c = canonicalForCrawl(link);
      if (queued.has(c)) continue;
      if (item.depth + 1 > ctx.maxDepth) continue;
      if (ctx.sameHost) {
        try {
          if (new URL(link).hostname.toLowerCase() !== ctx.host) continue;
        } catch {
          continue;
        }
      }
      if (ctx.respectRobots && !isPathAllowed(new URL(link).pathname, ctx.robots)) {
        continue;
      }
      queued.add(c);
      queue.push({ url: link, depth: item.depth + 1 });
    }
  }

  return {
    ok: true,
    seed: ctx.seed,
    strategyUsed: "map",
    pages: [],
    totalFound: discovered.length,
    crawled: 0,
    skipped: [],
    robotsFetched: ctx.robotsFetched,
    sitemapFound,
    urls: discovered,
  };
}
