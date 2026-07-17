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
  parseDdgLiteHtml,
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
export type { CrawlOptions, CrawlPage, CrawlResponse, CrawlSuccess } from "./crawl.js";
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
  WebCacheLike,
} from "./types.js";
export type { WebBrainStatus } from "./doctor.js";
