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
  | "search_failed";

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

export type WebSearchSuccess = {
  ok: true;
  query: string;
  results: WebSearchResult[];
  provider: string;
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

export type SearchOptions = {
  maxResults?: number;
  /** Injected search provider for tests. */
  provider?: SearchProvider;
  fetchImpl?: typeof fetch;
};

export type SearchProvider = {
  name: string;
  search: (
    query: string,
    opts: { maxResults: number; fetchImpl: typeof fetch },
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
