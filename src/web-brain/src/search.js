/**
 * Pluggable web search. Default: DuckDuckGo lite → HTML fallback (best-effort, $0).
 * Tests inject a mock provider — never hardcode result bodies in production paths.
 */
import { toWebError } from "./ssrf.js";
const UA = "phneakngar-web-brain/0.0.2 (+https://github.com/silence-guy/phneakngar)";
/** DDG `df` param for recency. */
export function ddgTimeParam(timeRange) {
    if (!timeRange)
        return undefined;
    switch (timeRange) {
        case "day":
            return "d";
        case "week":
            return "w";
        case "month":
            return "m";
        case "year":
            return "y";
        default:
            return undefined;
    }
}
function decodeHtmlEntities(s) {
    return s
        .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(Number.parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ");
}
function stripTags(s) {
    return decodeHtmlEntities(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}
/**
 * Resolve a DDG result href to a destination URL.
 * Handles bare https, protocol-relative //duckduckgo.com/l/?uddg=…, and uddg= alone.
 */
export function resolveDdgResultHref(href) {
    let raw = href.trim();
    if (!raw)
        return null;
    raw = decodeHtmlEntities(raw);
    if (raw.startsWith("//"))
        raw = `https:${raw}`;
    try {
        const u = new URL(raw);
        const uddg = u.searchParams.get("uddg");
        if (uddg) {
            const dest = decodeURIComponent(uddg);
            if (/^https?:\/\//i.test(dest))
                return dest;
        }
        if (u.hostname.includes("duckduckgo.com"))
            return null;
        if (u.protocol === "http:" || u.protocol === "https:")
            return u.toString();
    }
    catch {
        // bare path or junk
    }
    const m = raw.match(/[?&]uddg=([^&]+)/i);
    if (m?.[1]) {
        try {
            const dest = decodeURIComponent(m[1]);
            if (/^https?:\/\//i.test(dest))
                return dest;
        }
        catch {
            /* ignore */
        }
    }
    if (/^https?:\/\//i.test(raw) && !raw.includes("duckduckgo.com"))
        return raw;
    return null;
}
function detectBlockedHint(html) {
    const lower = html.toLowerCase();
    if (lower.includes("anomaly-modal") || lower.includes("anomaly")) {
        return "anomaly";
    }
    if (lower.includes("captcha") || lower.includes("challenge-form")) {
        return "captcha";
    }
    if (lower.includes("unfortunately, bots use duckduckgo too")) {
        return "bot_block";
    }
    return undefined;
}
/**
 * Parse DDG lite / HTML SERP for result links — structural, best-effort.
 * Supports direct https nofollow links and //duckduckgo.com/l/?uddg=… wrappers.
 */
export function parseDdgLiteHtml(html, maxResults) {
    const results = [];
    const seen = new Set();
    const push = (url, titleRaw, snippet = "") => {
        if (!url || seen.has(url) || results.length >= maxResults)
            return;
        if (url.includes("duckduckgo.com"))
            return;
        const title = stripTags(titleRaw);
        if (!title)
            return;
        seen.add(url);
        results.push({ title, url, snippet: stripTags(snippet) });
    };
    const anchorRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = anchorRe.exec(html)) !== null && results.length < maxResults) {
        const attrs = m[1] ?? "";
        const inner = m[2] ?? "";
        const hrefM = attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i);
        if (!hrefM?.[1])
            continue;
        const href = hrefM[1];
        const isResultClass = /class\s*=\s*["'][^"']*result(?:__a|-link)/i.test(attrs) ||
            /rel\s*=\s*["'][^"']*nofollow/i.test(attrs) ||
            /uddg=/i.test(href);
        if (!isResultClass)
            continue;
        push(resolveDdgResultHref(href), inner);
    }
    if (results.length === 0) {
        const uddgRe = /[?&]uddg=([^&"'>\s]+)/gi;
        let um;
        while ((um = uddgRe.exec(html)) !== null && results.length < maxResults) {
            try {
                const dest = decodeURIComponent(um[1]);
                if (/^https?:\/\//i.test(dest) && !dest.includes("duckduckgo.com")) {
                    push(dest, dest);
                }
            }
            catch {
                /* ignore */
            }
        }
    }
    const snippetRe = /class=["'][^"']*result(?:__|-)?snippet[^"']*["'][^>]*>([\s\S]*?)<\//gi;
    const snippets = [];
    let sm;
    while ((sm = snippetRe.exec(html)) !== null) {
        snippets.push(stripTags(sm[1] ?? ""));
    }
    for (let i = 0; i < results.length; i++) {
        if (snippets[i])
            results[i].snippet = snippets[i];
    }
    return results;
}
async function runHtmlProvider(name, url, maxResults, fetchImpl) {
    const t0 = Date.now();
    try {
        const res = await fetchImpl(url.toString(), {
            method: "GET",
            signal: AbortSignal.timeout(12_000),
            headers: {
                Accept: "text/html,application/xhtml+xml",
                "User-Agent": UA,
                "Accept-Language": "en-US,en;q=0.9",
            },
            redirect: "follow",
        });
        const html = await res.text();
        const blockedHint = detectBlockedHint(html);
        const results = res.ok ? parseDdgLiteHtml(html, maxResults) : [];
        return {
            results,
            telemetry: {
                provider: name,
                ok: res.ok,
                httpStatus: res.status,
                latencyMs: Date.now() - t0,
                rawHtmlBytes: html.length,
                parseCount: results.length,
                blockedHint,
                error: res.ok ? undefined : `Search HTTP ${res.status}`,
            },
        };
    }
    catch (err) {
        return {
            results: [],
            telemetry: {
                provider: name,
                ok: false,
                latencyMs: Date.now() - t0,
                parseCount: 0,
                error: err instanceof Error ? err.message : String(err),
            },
        };
    }
}
function applyDdgParams(u, query, timeRange) {
    u.searchParams.set("q", query);
    const df = ddgTimeParam(timeRange);
    if (df)
        u.searchParams.set("df", df);
}
export const ddgLiteProvider = {
    name: "ddg-lite",
    async search(query, { maxResults, fetchImpl, timeRange }) {
        const u = new URL("https://lite.duckduckgo.com/lite/");
        applyDdgParams(u, query, timeRange);
        const run = await runHtmlProvider("ddg-lite", u, maxResults, fetchImpl);
        if (run.telemetry.error && run.results.length === 0) {
            throw new Error(run.telemetry.error);
        }
        return run.results;
    },
};
export const ddgHtmlProvider = {
    name: "ddg-html",
    async search(query, { maxResults, fetchImpl, timeRange }) {
        const u = new URL("https://html.duckduckgo.com/html/");
        applyDdgParams(u, query, timeRange);
        const run = await runHtmlProvider("ddg-html", u, maxResults, fetchImpl);
        if (run.telemetry.error && run.results.length === 0) {
            throw new Error(run.telemetry.error);
        }
        return run.results;
    },
};
async function runProvider(provider, query, ctx) {
    if (provider.name === "ddg-lite") {
        const u = new URL("https://lite.duckduckgo.com/lite/");
        applyDdgParams(u, query, ctx.timeRange);
        return runHtmlProvider("ddg-lite", u, ctx.maxResults, ctx.fetchImpl);
    }
    if (provider.name === "ddg-html") {
        const u = new URL("https://html.duckduckgo.com/html/");
        applyDdgParams(u, query, ctx.timeRange);
        return runHtmlProvider("ddg-html", u, ctx.maxResults, ctx.fetchImpl);
    }
    const t0 = Date.now();
    try {
        const results = await provider.search(query, ctx);
        return {
            results,
            telemetry: {
                provider: provider.name,
                ok: true,
                latencyMs: Date.now() - t0,
                parseCount: results.length,
            },
        };
    }
    catch (err) {
        return {
            results: [],
            telemetry: {
                provider: provider.name,
                ok: false,
                latencyMs: Date.now() - t0,
                parseCount: 0,
                error: err instanceof Error ? err.message : String(err),
            },
        };
    }
}
/**
 * Mock-friendly search entry. Prefer injecting `provider` in tests.
 */
export async function webSearch(query, opts = {}) {
    const q = query?.trim() ?? "";
    if (!q) {
        return toWebError("invalid_url", "Search query is required");
    }
    const maxResults = Math.min(Math.max(opts.maxResults ?? 5, 1), 20);
    const fetchImpl = opts.fetchImpl ?? fetch;
    const timeRange = opts.timeRange;
    const ctx = { maxResults, fetchImpl, timeRange };
    if (opts.provider) {
        const run = await runProvider(opts.provider, q, ctx);
        if (run.results.length > 0) {
            return {
                ok: true,
                query: q,
                results: run.results.slice(0, maxResults),
                provider: opts.provider.name,
                providersTried: [opts.provider.name],
                telemetry: [run.telemetry],
                timeRange,
            };
        }
        return {
            ok: true,
            query: q,
            results: [],
            provider: opts.provider.name,
            degraded: true,
            error: {
                code: "empty_provider_results",
                message: run.telemetry.error
                    ? `Provider ${opts.provider.name} failed: ${run.telemetry.error}`
                    : `Provider ${opts.provider.name} returned 0 results (parse/engine empty)`,
            },
            providersTried: [opts.provider.name],
            telemetry: [run.telemetry],
            timeRange,
        };
    }
    const chain = opts.noFallback
        ? [{ name: "ddg-lite", search: ddgLiteProvider.search }]
        : [
            { name: "ddg-lite", search: ddgLiteProvider.search },
            { name: "ddg-html", search: ddgHtmlProvider.search },
        ];
    const telemetry = [];
    const tried = [];
    let lastProvider = chain[0].name;
    for (const provider of chain) {
        tried.push(provider.name);
        lastProvider = provider.name;
        const run = await runProvider(provider, q, ctx);
        telemetry.push(run.telemetry);
        if (run.results.length > 0) {
            return {
                ok: true,
                query: q,
                results: run.results.slice(0, maxResults),
                provider: provider.name,
                degraded: provider.name !== chain[0].name,
                providersTried: tried,
                telemetry,
                timeRange,
            };
        }
    }
    const blocked = telemetry.map((t) => t.blockedHint).find(Boolean);
    const lastErr = [...telemetry].reverse().find((t) => t.error)?.error;
    return {
        ok: true,
        query: q,
        results: [],
        provider: lastProvider,
        degraded: true,
        error: {
            code: "empty_provider_results",
            message: blocked
                ? `All search providers returned 0 results (blocked: ${blocked})`
                : lastErr
                    ? `All search providers returned 0 results (${lastErr})`
                    : "All search providers returned 0 results — engine empty, parse miss, or soft-block",
        },
        providersTried: tried,
        telemetry,
        timeRange,
    };
}
export function createMockSearchProvider(results, name = "mock") {
    return {
        name,
        async search(_query, { maxResults }) {
            return results.slice(0, maxResults);
        },
    };
}
