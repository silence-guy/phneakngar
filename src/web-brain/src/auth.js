/**
 * Lean authenticated fetch helpers.
 * Supports: Cookie header env, Netscape cookie file, Playwright storageState JSON.
 * (No Chrome CDP / full browser profile — keep install lean.)
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
function defaultAuthPaths() {
    const home = homedir();
    return [
        process.env.PHNEAKNGAR_AUTH_STATE || "",
        process.env.PHNEAKNGAR_AUTH_COOKIES || "",
        join(home, ".phneakngar", "auth", "storageState.json"),
        join(home, ".phneakngar", "auth", "cookies.txt"),
    ].filter(Boolean);
}
/** Parse Netscape / curl cookie file into Cookie header for a host. */
export function cookiesFromNetscape(text, host) {
    const parts = [];
    for (const line of text.split(/\r?\n/)) {
        if (!line || line.startsWith("#"))
            continue;
        const cols = line.split("\t");
        if (cols.length < 7)
            continue;
        const domain = cols[0].replace(/^\./, "");
        const name = cols[5];
        const value = cols[6];
        if (host && !host.endsWith(domain) && domain !== host)
            continue;
        parts.push(`${name}=${value}`);
    }
    return parts.length ? parts.join("; ") : null;
}
/** Playwright storageState.json → Cookie header for host. */
export function cookiesFromStorageState(json, host) {
    if (!json || typeof json !== "object")
        return null;
    const cookies = json.cookies;
    if (!Array.isArray(cookies))
        return null;
    const parts = [];
    for (const c of cookies) {
        if (!c || typeof c !== "object")
            continue;
        const rec = c;
        if (!rec.name || rec.value == null)
            continue;
        if (host && rec.domain) {
            const d = rec.domain.replace(/^\./, "");
            if (!host.endsWith(d) && d !== host)
                continue;
        }
        parts.push(`${rec.name}=${rec.value}`);
    }
    return parts.length ? parts.join("; ") : null;
}
/**
 * Resolve auth for outbound requests when useAuth is true.
 * Precedence: explicit opts → env cookie string → auth files.
 */
export function resolveAuth(opts = {}) {
    if (!opts.useAuth && !opts.cookieHeader && !opts.authStatePath) {
        // Allow env-only enable
        if (process.env.PHNEAKNGAR_USE_AUTH !== "1")
            return null;
    }
    if (opts.useAuth === false)
        return null;
    if (opts.cookieHeader) {
        return { cookieHeader: opts.cookieHeader, source: "explicit" };
    }
    const envCookie = process.env.PHNEAKNGAR_AUTH_COOKIE_HEADER;
    if (envCookie) {
        return { cookieHeader: envCookie, source: "env:PHNEAKNGAR_AUTH_COOKIE_HEADER" };
    }
    const paths = opts.authStatePath
        ? [opts.authStatePath]
        : defaultAuthPaths();
    for (const p of paths) {
        if (!p || !existsSync(p))
            continue;
        try {
            const raw = readFileSync(p, "utf-8");
            if (p.endsWith(".json") || raw.trimStart().startsWith("{")) {
                const cookie = cookiesFromStorageState(JSON.parse(raw), opts.host);
                if (cookie)
                    return { cookieHeader: cookie, source: p };
            }
            else {
                const cookie = cookiesFromNetscape(raw, opts.host);
                if (cookie)
                    return { cookieHeader: cookie, source: p };
            }
        }
        catch {
            // try next
        }
    }
    return null;
}
/** Merge auth into fetch HeadersInit. */
export function applyAuthHeaders(base, auth) {
    const h = { ...(base ?? {}) };
    if (auth?.cookieHeader)
        h.Cookie = auth.cookieHeader;
    if (auth?.headers)
        Object.assign(h, auth.headers);
    return h;
}
