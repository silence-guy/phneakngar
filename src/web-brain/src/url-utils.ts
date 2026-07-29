/**
 * URL helpers for crawl dedup and pattern filters.
 * Behavior inspired by agent crawlers (fragment/slash collapse); original code.
 */

/** Drop `#fragment` — anchors are intra-page navigation, not page identity. */
export function stripFragment(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Canonical form for visited-set comparison — drops fragments and trailing slash
 * so `/docs`, `/docs/`, and `/docs#anchor` are one page.
 */
export function canonicalForCrawl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    let pathname = u.pathname;
    if (pathname.length > 1 && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }
    u.pathname = pathname;
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Display-friendly canonical for emitted page URLs.
 * Root becomes origin-only; other paths lose trailing slash; hash dropped.
 */
export function canonicalForOutput(url: string): string {
  try {
    const u = new URL(url);
    let path = u.pathname;
    if (path === "/") path = "";
    else if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    return `${u.origin}${path}${u.search}`;
  } catch {
    return url;
  }
}

/** Caps on agent-supplied crawl patterns (ReDoS guard). */
const MAX_PATTERNS = 32;
const MAX_PATTERN_LENGTH = 200;

/**
 * Reject patterns whose shape invites catastrophic backtracking.
 *
 * include_patterns/exclude_patterns arrive from an MCP tool call and are compiled with
 * `new RegExp` then run against every discovered link, with no timeout — so `(a+)+$` freezes
 * the process. JS has no regex execution budget, so the only cheap defence is refusing
 * nested quantifiers before compiling.
 */
export function isSafeCrawlPattern(pattern: string): boolean {
  if (typeof pattern !== "string") return false;
  if (!pattern || pattern.length > MAX_PATTERN_LENGTH) return false;
  // A quantified group that itself contains a quantifier: (a+)+, (a*)*, (a+){2,}, (?:a+)+ …
  if (/\([^)]*[+*}][^)]*\)\s*[+*{]/.test(pattern)) return false;
  // Nested/adjacent unbounded quantifiers outside groups: a**, a+*, a{2,}+
  if (/[+*]\s*[+*]/.test(pattern)) return false;
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

/** Compile the safe subset of a pattern list, dropping (and reporting) the rest. */
export function compileCrawlPatterns(patterns: string[] | undefined): {
  regexes: RegExp[];
  rejected: string[];
} {
  if (!patterns?.length) return { regexes: [], rejected: [] };
  const regexes: RegExp[] = [];
  const rejected: string[] = [];
  for (const p of patterns.slice(0, MAX_PATTERNS)) {
    if (isSafeCrawlPattern(p)) {
      regexes.push(new RegExp(p));
    } else {
      rejected.push(p);
    }
  }
  if (patterns.length > MAX_PATTERNS) {
    rejected.push(...patterns.slice(MAX_PATTERNS));
  }
  return { regexes, rejected };
}

/**
 * Regex whitelist/blacklist on full URL string. Empty include = allow all.
 *
 * Patterns that fail the safety check are treated as non-matching rather than compiled.
 * A rejected include pattern therefore excludes the URL (fail closed), and a rejected
 * exclude pattern does not block it.
 */
export function matchesPatterns(
  url: string,
  includePatterns?: string[],
  excludePatterns?: string[],
): boolean {
  if (includePatterns && includePatterns.length > 0) {
    const { regexes } = compileCrawlPatterns(includePatterns);
    const ok = regexes.some((re) => {
      try {
        return re.test(url);
      } catch {
        return false;
      }
    });
    if (!ok) return false;
  }
  if (excludePatterns && excludePatterns.length > 0) {
    const { regexes } = compileCrawlPatterns(excludePatterns);
    const blocked = regexes.some((re) => {
      try {
        return re.test(url);
      } catch {
        return false;
      }
    });
    if (blocked) return false;
  }
  return true;
}

const DOC_PATH_HINTS = ["/docs/", "/guide/", "/api/", "/reference/", "/learn/"];

export function isDocPathUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return DOC_PATH_HINTS.some((p) => path.includes(p));
  } catch {
    return false;
  }
}

/** Prefer documentation-looking paths when expanding the crawl queue. */
export function prioritizeDocLinks(urls: string[]): string[] {
  return [...urls].sort((a, b) => {
    const aDoc = isDocPathUrl(a) ? 0 : 1;
    const bDoc = isDocPathUrl(b) ? 0 : 1;
    return aDoc - bDoc;
  });
}
