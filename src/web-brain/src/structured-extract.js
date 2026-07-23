/**
 * Structured extract: metadata, HTML tables, JSON-LD (zero extra deps).
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { extractTitle, stripBoilerplate } from "./extract.js";
import { applyAuthHeaders, resolveAuth } from "./auth.js";
import { assertResolvedAddressesSafe, assertSafeHttpUrl, toWebError, } from "./ssrf.js";
function decodeEntities(s) {
    return s
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}
function cellText(html) {
    return decodeEntities(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}
function metaContent(html, nameOrProp) {
    const re = new RegExp(`<meta[^>]+(?:name|property)=["']${nameOrProp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]+content=["']([^"']*)["']`, "i");
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${nameOrProp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`, "i");
    const m = html.match(re) || html.match(re2);
    return m?.[1] ? decodeEntities(m[1]) : "";
}
export function extractMetadata(html) {
    const og = {};
    const ogRe = /<meta[^>]+property=["'](og:[^"']+)["'][^>]+content=["']([^"']*)["']/gi;
    let m;
    while ((m = ogRe.exec(html)) !== null) {
        og[m[1]] = decodeEntities(m[2]);
    }
    const ogRe2 = /<meta[^>]+content=["']([^"']*)["'][^>]+property=["'](og:[^"']+)["']/gi;
    while ((m = ogRe2.exec(html)) !== null) {
        og[m[2]] = decodeEntities(m[1]);
    }
    const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] ||
        html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)?.[1] ||
        "";
    const lang = html.match(/<html[^>]+lang=["']([^"']+)["']/i)?.[1] || "";
    return {
        title: extractTitle(html),
        description: metaContent(html, "description") || og["og:description"] || "",
        canonical: decodeEntities(canonical),
        og,
        lang,
    };
}
export function extractTables(html, maxTables = 20, maxRows = 200) {
    const cleaned = stripBoilerplate(html);
    const tables = [];
    const tableRe = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
    let tm;
    while ((tm = tableRe.exec(cleaned)) !== null && tables.length < maxTables) {
        const body = tm[1];
        const rowsHtml = [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((x) => x[1]);
        if (!rowsHtml.length)
            continue;
        let headers = [];
        const dataRows = [];
        for (let i = 0; i < rowsHtml.length && dataRows.length < maxRows; i++) {
            const cells = [
                ...rowsHtml[i].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi),
            ].map((c) => cellText(c[1]));
            if (!cells.length)
                continue;
            if (i === 0 && /<th\b/i.test(rowsHtml[i])) {
                headers = cells;
            }
            else {
                dataRows.push(cells);
            }
        }
        if (headers.length || dataRows.length) {
            tables.push({ headers, rows: dataRows });
        }
    }
    return tables;
}
export function extractJsonLd(html) {
    const out = [];
    const re = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
        const raw = m[1].trim();
        if (!raw)
            continue;
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed))
                out.push(...parsed);
            else
                out.push(parsed);
        }
        catch {
            // skip invalid JSON-LD
        }
    }
    return out;
}
/** Fetch HTML with SSRF guards (same rules as webFetch). */
export async function fetchHtml(rawUrl, opts = {}) {
    const allowPrivate = opts.allowPrivateNetwork ?? false;
    const fetchImpl = opts.fetchImpl ?? fetch;
    const timeoutMs = opts.timeoutMs ?? 15_000;
    const skipDns = opts.fetchImpl != null && opts.fetchImpl !== fetch;
    const safe = assertSafeHttpUrl(rawUrl, { allowPrivateNetwork: allowPrivate });
    if (!safe.ok)
        return toWebError(safe.code, safe.message);
    let current = safe.url;
    for (let redirects = 0; redirects <= 5; redirects++) {
        if (!skipDns) {
            const host = current.hostname.replace(/^\[|\]$/g, "");
            if (!isIP(host)) {
                try {
                    const results = await lookup(host, { all: true });
                    const check = assertResolvedAddressesSafe(results.map((r) => r.address), { allowPrivateNetwork: allowPrivate });
                    if (!check.ok)
                        return toWebError(check.code, check.message);
                }
                catch (err) {
                    return toWebError("dns_failed", err instanceof Error ? err.message : String(err));
                }
            }
        }
        const auth = resolveAuth({
            useAuth: opts.useAuth,
            authStatePath: opts.authStatePath,
            host: current.hostname,
        });
        const headers = applyAuthHeaders({
            Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
            "User-Agent": "phneakngar-web-brain/0.0.2",
            ...opts.headers,
        }, auth);
        let res;
        try {
            res = await fetchImpl(current.toString(), {
                method: "GET",
                redirect: "manual",
                signal: AbortSignal.timeout(timeoutMs),
                headers,
            });
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (/timeout|aborted/i.test(msg))
                return toWebError("timeout", msg);
            return toWebError("network_error", msg);
        }
        if (res.status >= 300 && res.status < 400) {
            const loc = res.headers.get("location");
            if (!loc)
                return toWebError("http_error", `Redirect ${res.status} without Location`);
            let next;
            try {
                next = new URL(loc, current);
            }
            catch {
                return toWebError("invalid_url", `Invalid redirect: ${loc}`);
            }
            const hop = assertSafeHttpUrl(next.toString(), {
                allowPrivateNetwork: allowPrivate,
            });
            if (!hop.ok)
                return toWebError(hop.code, hop.message);
            current = hop.url;
            continue;
        }
        if (!res.ok)
            return toWebError("http_error", `HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.byteLength > 2_000_000) {
            return toWebError("too_large", "HTML exceeds 2MB");
        }
        const html = buf.toString("utf-8");
        if (!html.trim())
            return toWebError("empty_content", "Empty HTML body");
        return { ok: true, html, finalUrl: current.toString() };
    }
    return toWebError("http_error", "Too many redirects");
}
/**
 * Extract structured fields from HTML or by fetching a URL.
 * Never invents tables/jsonld — empty arrays when nothing found.
 */
export async function structuredExtract(opts) {
    const mode = opts.mode ?? "all";
    let html = opts.html;
    let url = opts.url ?? null;
    if (!html) {
        if (!opts.url) {
            return toWebError("invalid_url", "url or html is required");
        }
        const fetched = await fetchHtml(opts.url, opts.fetchOpts);
        if (!fetched.ok)
            return fetched;
        html = fetched.html;
        url = fetched.finalUrl;
    }
    const result = {
        ok: true,
        url,
        mode,
    };
    if (mode === "metadata" || mode === "all") {
        result.metadata = extractMetadata(html);
    }
    if (mode === "tables" || mode === "all") {
        result.tables = extractTables(html);
    }
    if (mode === "jsonld" || mode === "all") {
        result.jsonld = extractJsonLd(html);
    }
    return result;
}
