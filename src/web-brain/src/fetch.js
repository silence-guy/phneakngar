/**
 * HTTP-only fetch → markdown with SSRF guards and optional disk cache.
 */
import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { assertResolvedAddressesSafe, assertSafeHttpUrl, toWebError, } from "./ssrf.js";
import { extractFromHtml } from "./extract.js";
import { applyAuthHeaders, resolveAuth } from "./auth.js";
const DEFAULT_MAX_CHARS = 30_000;
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_BYTES = 2_000_000;
const MAX_REDIRECTS = 5;
const TEXT_TYPES = [
    "text/html",
    "application/xhtml",
    "text/plain",
    "text/markdown",
    "application/json",
];
function contentTypeOk(ct) {
    if (!ct)
        return true; // sniff later
    const base = ct.split(";")[0]?.trim().toLowerCase() ?? "";
    return TEXT_TYPES.some((t) => base.includes(t)) || base.startsWith("text/");
}
function hashContent(s) {
    return createHash("sha256").update(s).digest("hex");
}
async function resolveAndCheckHost(hostname, allowPrivateNetwork) {
    // Literal IP already checked in assertSafeHttpUrl
    const { isIP } = await import("node:net");
    if (isIP(hostname.replace(/^\[|\]$/g, "")))
        return null;
    try {
        const results = await lookup(hostname, { all: true });
        const addrs = results.map((r) => r.address);
        const check = assertResolvedAddressesSafe(addrs, { allowPrivateNetwork });
        if (!check.ok) {
            return toWebError(check.code, check.message);
        }
        return null;
    }
    catch (err) {
        return toWebError("dns_failed", `DNS lookup failed for ${hostname}: ${err instanceof Error ? err.message : String(err)}`);
    }
}
/**
 * Fetch a public http(s) URL into clean markdown.
 * Returns structured errors — never invents body content.
 */
export async function webFetch(rawUrl, opts = {}) {
    const maxChars = opts.maxChars ?? DEFAULT_MAX_CHARS;
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const fetchImpl = opts.fetchImpl ?? fetch;
    const allowPrivate = opts.allowPrivateNetwork ?? false;
    const safe = assertSafeHttpUrl(rawUrl, { allowPrivateNetwork: allowPrivate });
    if (!safe.ok) {
        return toWebError(safe.code, safe.message);
    }
    const canonical = safe.url.toString();
    if (!opts.forceRefresh && opts.cache) {
        const hit = opts.cache.get(canonical);
        if (hit) {
            return {
                ok: true,
                url: hit.url,
                finalUrl: hit.finalUrl,
                title: hit.title,
                markdown: hit.markdown,
                contentType: hit.contentType,
                httpStatus: hit.httpStatus,
                fromCache: true,
                fetchedAt: hit.fetchedAt,
                contentHash: hit.contentHash,
            };
        }
    }
    let current = safe.url;
    let redirects = 0;
    let res;
    // When callers inject fetchImpl (unit tests), skip DNS rebinding checks —
    // assertSafeHttpUrl still blocks private literals/schemes.
    const skipDns = opts.fetchImpl != null && opts.fetchImpl !== fetch;
    while (redirects <= MAX_REDIRECTS) {
        if (!skipDns) {
            const dnsErr = await resolveAndCheckHost(current.hostname, allowPrivate);
            if (dnsErr)
                return dnsErr;
        }
        // Re-check each hop (redirect target)
        const hopSafe = assertSafeHttpUrl(current.toString(), {
            allowPrivateNetwork: allowPrivate,
        });
        if (!hopSafe.ok) {
            return toWebError(hopSafe.code, hopSafe.message);
        }
        const auth = resolveAuth({
            useAuth: opts.useAuth,
            authStatePath: opts.authStatePath,
            host: current.hostname,
        });
        const headers = applyAuthHeaders({
            Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1",
            "User-Agent": "phneakngar-web-brain/0.0.2 (+https://github.com/silence-guy/phneakngar)",
            ...opts.headers,
        }, auth);
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
            if (/timeout|aborted/i.test(msg)) {
                return toWebError("timeout", `Request timed out after ${timeoutMs}ms`);
            }
            return toWebError("network_error", msg);
        }
        if (res.status >= 300 && res.status < 400) {
            const loc = res.headers.get("location");
            if (!loc) {
                return toWebError("http_error", `Redirect ${res.status} without Location`);
            }
            let next;
            try {
                next = new URL(loc, current);
            }
            catch {
                return toWebError("invalid_url", `Invalid redirect location: ${loc}`);
            }
            const nextSafe = assertSafeHttpUrl(next.toString(), {
                allowPrivateNetwork: allowPrivate,
            });
            if (!nextSafe.ok) {
                return toWebError(nextSafe.code, `Redirect blocked: ${nextSafe.message}`);
            }
            current = nextSafe.url;
            redirects += 1;
            continue;
        }
        break;
    }
    if (!res) {
        return toWebError("network_error", "No response");
    }
    if (res.status === 403 || res.status === 401) {
        return toWebError("http_error", `HTTP ${res.status} from ${current.toString()} (blocked or unauthorized)`);
    }
    if (!res.ok) {
        return toWebError("http_error", `HTTP ${res.status} from ${current.toString()}`);
    }
    const ct = res.headers.get("content-type");
    if (!contentTypeOk(ct)) {
        return toWebError("unsupported_content", `Unsupported content-type: ${ct ?? "unknown"}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) {
        return toWebError("too_large", `Response exceeds ${MAX_BYTES} bytes`);
    }
    const text = buf.toString("utf-8");
    if (!text.trim()) {
        return toWebError("empty_content", "Empty response body");
    }
    const lowerCt = (ct ?? "").toLowerCase();
    let title = "";
    let markdown = "";
    if (lowerCt.includes("json") || text.trimStart().startsWith("{") || text.trimStart().startsWith("[")) {
        title = current.hostname;
        markdown = "```json\n" + text.slice(0, maxChars) + (text.length > maxChars ? "\n/* truncated */" : "") + "\n```";
        if (text.length > maxChars) {
            markdown += "\n\n[... content truncated]";
        }
    }
    else if (lowerCt.includes("html") || /<html[\s>]/i.test(text) || /<body[\s>]/i.test(text)) {
        const extracted = extractFromHtml(text, maxChars);
        title = extracted.title || current.hostname;
        markdown = extracted.markdown;
    }
    else {
        title = current.hostname;
        markdown =
            text.length > maxChars
                ? text.slice(0, maxChars) + "\n\n[... content truncated]"
                : text;
    }
    if (!markdown.trim()) {
        return toWebError("empty_content", "No extractable text content");
    }
    const fetchedAt = new Date().toISOString();
    const contentHash = hashContent(markdown);
    const entry = {
        url: canonical,
        finalUrl: current.toString(),
        title,
        markdown,
        contentType: ct ?? "text/html",
        httpStatus: res.status,
        fetchedAt,
        contentHash,
    };
    if (opts.cache) {
        opts.cache.put(entry);
    }
    return {
        ok: true,
        url: canonical,
        finalUrl: entry.finalUrl,
        title,
        markdown,
        contentType: entry.contentType,
        httpStatus: entry.httpStatus,
        fromCache: false,
        fetchedAt,
        contentHash,
    };
}
