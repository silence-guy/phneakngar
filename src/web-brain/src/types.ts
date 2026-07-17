/** Structured error — never fabricate page content on failure. */
export type WebErrorCode =
  | "invalid_url"
  | "blocked_scheme"
  | "blocked_host"
  | "blocked_ip"
  | "dns_failed"
  | "timeout"
  | "network_error"
  | "http_error"
  | "unsupported_content"
  | "too_large"
  | "empty_content"
  | "search_failed"
  | "empty_provider_results";

export type WebError = {
  ok: false;
  error: {
    code: WebErrorCode;
    message: string;
  };
};

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

/** Per-provider attempt diagnostics (even when results are empty). */
export type SearchProviderTelemetry = {
  provider: string;
  ok: boolean;
  httpStatus?: number;
  latencyMs: number;
  rawHtmlBytes?: number;
  parseCount: number;
  /** Captcha / anomaly / challenge page signals when detected. */
  blockedHint?: string;
  error?: string;
};

export type WebSearchSuccess = {
  ok: true;
  query: string;
  results: WebSearchResult[];
  /** Primary provider that produced results, or last tried when empty. */
  provider: string;
  /** True when results are empty or only a degraded fallback path. */
  degraded?: boolean;
  /** Present when providers returned zero usable hits or partially failed. */
  error?: {
    code: WebErrorCode;
    message: string;
  };
  providersTried?: string[];
  telemetry?: SearchProviderTelemetry[];
  timeRange?: SearchTimeRange;
};

export type WebSearchResponse = WebSearchSuccess | WebError;

export type WebFetchSuccess = {
  ok: true;
  url: string;
  finalUrl: string;
  title: string;
  markdown: string;
  contentType: string;
  httpStatus: number;
  fromCache: boolean;
  fetchedAt: string;
  contentHash: string;
};

export type WebFetchResponse = WebFetchSuccess | WebError;

export type CacheEntry = {
  url: string;
  finalUrl: string;
  title: string;
  markdown: string;
  contentType: string;
  httpStatus: number;
  fetchedAt: string;
  contentHash: string;
};

export type FetchOptions = {
  /** Bypass cache and re-fetch. */
  forceRefresh?: boolean;
  /** Max markdown characters (default 30000). */
  maxChars?: number;
  /** Request timeout ms (default 15000). */
  timeoutMs?: number;
  /** Injected fetch for tests. */
  fetchImpl?: typeof fetch;
  /** Cache instance; omit to skip cache. */
  cache?: WebCacheLike | null;
  /** Allow loopback/private targets (tests only; default false). */
  allowPrivateNetwork?: boolean;
};

export type SearchTimeRange = "day" | "week" | "month" | "year";

export type SearchOptions = {
  maxResults?: number;
  /** Injected search provider for tests (skips fallback chain). */
  provider?: SearchProvider;
  fetchImpl?: typeof fetch;
  /** Recency filter when the engine supports it (DDG `df`). */
  timeRange?: SearchTimeRange;
  /** Disable automatic provider fallback (default false). */
  noFallback?: boolean;
};

export type SearchProviderContext = {
  maxResults: number;
  fetchImpl: typeof fetch;
  timeRange?: SearchTimeRange;
};

export type SearchProvider = {
  name: string;
  search: (
    query: string,
    opts: SearchProviderContext,
  ) => Promise<WebSearchResult[]>;
};

export type WebCacheLike = {
  get(url: string): CacheEntry | null;
  put(entry: CacheEntry): void;
  search(query: string, limit?: number): CacheEntry[];
  stats(): { entries: number; path: string };
  clear(): void;
  close?(): void;
};
