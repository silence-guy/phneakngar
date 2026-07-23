/**
 * URL helpers for crawl dedup and pattern filters.
 * Behavior inspired by agent crawlers (fragment/slash collapse); original code.
 */
/** Drop `#fragment` — anchors are intra-page navigation, not page identity. */
export function stripFragment(url) {
    try {
        const u = new URL(url);
        u.hash = "";
        return u.toString();
    }
    catch {
        return url;
    }
}
/**
 * Canonical form for visited-set comparison — drops fragments and trailing slash
 * so `/docs`, `/docs/`, and `/docs#anchor` are one page.
 */
export function canonicalForCrawl(url) {
    try {
        const u = new URL(url);
        u.hash = "";
        let pathname = u.pathname;
        if (pathname.length > 1 && pathname.endsWith("/")) {
            pathname = pathname.slice(0, -1);
        }
        u.pathname = pathname;
        return u.toString();
    }
    catch {
        return url;
    }
}
/**
 * Display-friendly canonical for emitted page URLs.
 * Root becomes origin-only; other paths lose trailing slash; hash dropped.
 */
export function canonicalForOutput(url) {
    try {
        const u = new URL(url);
        let path = u.pathname;
        if (path === "/")
            path = "";
        else if (path.length > 1 && path.endsWith("/"))
            path = path.slice(0, -1);
        return `${u.origin}${path}${u.search}`;
    }
    catch {
        return url;
    }
}
/** Regex whitelist/blacklist on full URL string. Empty include = allow all. */
export function matchesPatterns(url, includePatterns, excludePatterns) {
    if (includePatterns && includePatterns.length > 0) {
        const ok = includePatterns.some((p) => {
            try {
                return new RegExp(p).test(url);
            }
            catch {
                return false;
            }
        });
        if (!ok)
            return false;
    }
    if (excludePatterns && excludePatterns.length > 0) {
        const blocked = excludePatterns.some((p) => {
            try {
                return new RegExp(p).test(url);
            }
            catch {
                return false;
            }
        });
        if (blocked)
            return false;
    }
    return true;
}
const DOC_PATH_HINTS = ["/docs/", "/guide/", "/api/", "/reference/", "/learn/"];
export function isDocPathUrl(url) {
    try {
        const path = new URL(url).pathname.toLowerCase();
        return DOC_PATH_HINTS.some((p) => path.includes(p));
    }
    catch {
        return false;
    }
}
/** Prefer documentation-looking paths when expanding the crawl queue. */
export function prioritizeDocLinks(urls) {
    return [...urls].sort((a, b) => {
        const aDoc = isDocPathUrl(a) ? 0 : 1;
        const bDoc = isDocPathUrl(b) ? 0 : 1;
        return aDoc - bDoc;
    });
}
