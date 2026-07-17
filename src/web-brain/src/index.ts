/**
 * @phneakngar/web-brain — lean search/fetch/cache/extract/crawl + MCP for local agents.
 */

export {
  assertSafeHttpUrl,
  assertResolvedAddressesSafe,
  isBlockedIPv4,
  isBlockedIPv6,
  isBlockedIpAddress,
  toWebError,
} from "./ssrf.js";
export {
  extractFromHtml,
  extractTitle,
  htmlToMarkdown,
  stripBoilerplate,
} from "./extract.js";
export { webFetch } from "./fetch.js";
export {
  webSearch,
  ddgLiteProvider,
  ddgHtmlProvider,
  parseDdgLiteHtml,
  resolveDdgResultHref,
  ddgTimeParam,
  createMockSearchProvider,
} from "./search.js";
export { WebCache, defaultCacheDir } from "./cache.js";
export { checkWebBrainReady } from "./doctor.js";
export {
  structuredExtract,
  extractMetadata,
  extractTables,
  extractJsonLd,
  fetchHtml,
} from "./structured-extract.js";
export type {
  ExtractMode,
  PageMetadata,
  HtmlTable,
  StructuredExtractOptions,
  StructuredExtractResponse,
  StructuredExtractSuccess,
} from "./structured-extract.js";
export { webCrawl, extractLinks } from "./crawl.js";
export type {
  CrawlOptions,
  CrawlPage,
  CrawlResponse,
  CrawlSuccess,
  CrawlStrategy,
  CrawlLinkEdge,
} from "./crawl.js";
export {
  canonicalForCrawl,
  canonicalForOutput,
  matchesPatterns,
  stripFragment,
} from "./url-utils.js";
export {
  parseSitemapEntries,
  parseSitemapIndex,
  sortSitemapEntries,
  extractSitemapUrlFromRobots,
  discoverSitemapUrls,
} from "./sitemap.js";
export type { SitemapEntry } from "./sitemap.js";
export {
  deduplicatePages,
  stripRepeatedNavigationLines,
  splitIntoBlocks,
} from "./dedup.js";
export {
  hashEmbed,
  findSimilar,
  indexCrawlResult,
  isIndexingEnabled,
  VectorStore,
  cosineSimilarity,
} from "./embed.js";
export {
  resolveAuth,
  applyAuthHeaders,
  cookiesFromNetscape,
  cookiesFromStorageState,
} from "./auth.js";
export {
  countTokens,
  truncateByTokens,
  applyAggregateMarkdownBudget,
  buildEvidenceFromMarkdown,
} from "./budget.js";
export {
  startFirecrawlCompatServer,
  createFirecrawlCompatHandler,
  CrawlJobStore,
} from "./firecrawl-compat.js";
export {
  parseRobotsTxt,
  isPathAllowed,
  isUrlAllowedByRobots,
} from "./robots.js";
export type { RobotsRules } from "./robots.js";
export {
  runMcpStdio,
  handleMcpMessage,
  callTool,
  listTools,
} from "./mcp-server.js";
export {
  webDiff,
  diffLines,
  diffCacheEntries,
  summarizeHunks,
} from "./diff.js";
export type {
  DiffHunk,
  DiffSummary,
  WebDiffOptions,
  WebDiffResponse,
  WebDiffSuccess,
} from "./diff.js";
export type {
  WebError,
  WebErrorCode,
  WebFetchResponse,
  WebFetchSuccess,
  WebSearchResponse,
  WebSearchResult,
  WebSearchSuccess,
  CacheEntry,
  FetchOptions,
  SearchOptions,
  SearchProvider,
  SearchProviderTelemetry,
  SearchTimeRange,
  WebCacheLike,
} from "./types.js";
export type { WebBrainStatus } from "./doctor.js";
