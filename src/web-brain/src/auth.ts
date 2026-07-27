/**
 * Lean authenticated fetch helpers.
 * Supports: Cookie header env, Netscape cookie file, Playwright storageState JSON.
 * (No Chrome CDP / full browser profile — keep install lean.)
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type AuthConfig = {
  /** Raw Cookie header value. */
  cookieHeader?: string;
  /** Extra headers (Authorization, etc.). */
  headers?: Record<string, string>;
  source?: string;
};

/**
 * Hosts the env cookie may be sent to, from PHNEAKNGAR_AUTH_COOKIE_HOSTS
 * (comma-separated; suffix match, so "example.com" covers "docs.example.com").
 */
function envCookieAllowedHosts(): string[] {
  return (process.env.PHNEAKNGAR_AUTH_COOKIE_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase().replace(/^\./, ""))
    .filter(Boolean);
}

/**
 * Whether PHNEAKNGAR_AUTH_COOKIE_HEADER may be attached to a request for `host`.
 *
 * Fails closed: with no allowlist configured the cookie is never attached, because the
 * alternative is sending it to every host the agent is pointed at.
 */
export function envCookieHostAllowed(host: string | undefined): boolean {
  const allowed = envCookieAllowedHosts();
  if (allowed.length === 0) return false;
  if (!host) return false;
  const h = host.trim().toLowerCase();
  return allowed.some((a) => h === a || h.endsWith(`.${a}`));
}

let envCookieWarned = false;
function warnEnvCookieSkipped(host: string | undefined): void {
  if (envCookieWarned) return;
  envCookieWarned = true;
  const allowed = envCookieAllowedHosts();
  console.warn(
    allowed.length === 0
      ? "[web-brain] PHNEAKNGAR_AUTH_COOKIE_HEADER is set but PHNEAKNGAR_AUTH_COOKIE_HOSTS is not; " +
          "the cookie will not be sent. Set the allowlist to the host(s) it belongs to."
      : `[web-brain] not attaching PHNEAKNGAR_AUTH_COOKIE_HEADER to ${host ?? "unknown host"}: ` +
          `not in PHNEAKNGAR_AUTH_COOKIE_HOSTS (${allowed.join(", ")}).`,
  );
}

function defaultAuthPaths(): string[] {
  const home = homedir();
  return [
    process.env.PHNEAKNGAR_AUTH_STATE || "",
    process.env.PHNEAKNGAR_AUTH_COOKIES || "",
    join(home, ".phneakngar", "auth", "storageState.json"),
    join(home, ".phneakngar", "auth", "cookies.txt"),
  ].filter(Boolean);
}

/** Parse Netscape / curl cookie file into Cookie header for a host. */
export function cookiesFromNetscape(
  text: string,
  host?: string,
): string | null {
  const parts: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const cols = line.split("\t");
    if (cols.length < 7) continue;
    const domain = cols[0]!.replace(/^\./, "");
    const name = cols[5]!;
    const value = cols[6]!;
    if (host && !host.endsWith(domain) && domain !== host) continue;
    parts.push(`${name}=${value}`);
  }
  return parts.length ? parts.join("; ") : null;
}

/** Playwright storageState.json → Cookie header for host. */
export function cookiesFromStorageState(
  json: unknown,
  host?: string,
): string | null {
  if (!json || typeof json !== "object") return null;
  const cookies = (json as { cookies?: unknown }).cookies;
  if (!Array.isArray(cookies)) return null;
  const parts: string[] = [];
  for (const c of cookies) {
    if (!c || typeof c !== "object") continue;
    const rec = c as { name?: string; value?: string; domain?: string };
    if (!rec.name || rec.value == null) continue;
    if (host && rec.domain) {
      const d = rec.domain.replace(/^\./, "");
      if (!host.endsWith(d) && d !== host) continue;
    }
    parts.push(`${rec.name}=${rec.value}`);
  }
  return parts.length ? parts.join("; ") : null;
}

/**
 * Resolve auth for outbound requests when useAuth is true.
 * Precedence: explicit opts → env cookie string → auth files.
 */
export function resolveAuth(
  opts: {
    useAuth?: boolean;
    cookieHeader?: string;
    authStatePath?: string;
    host?: string;
  } = {},
): AuthConfig | null {
  if (!opts.useAuth && !opts.cookieHeader && !opts.authStatePath) {
    // Allow env-only enable
    if (process.env.PHNEAKNGAR_USE_AUTH !== "1") return null;
  }
  if (opts.useAuth === false) return null;

  if (opts.cookieHeader) {
    return { cookieHeader: opts.cookieHeader, source: "explicit" };
  }

  const envCookie = process.env.PHNEAKNGAR_AUTH_COOKIE_HEADER;
  if (envCookie) {
    // Scope by host exactly like the file-based sources below. Without this the operator's
    // session cookie is attached to every destination once use_auth is set — including a
    // redirect hop or a cross-origin link discovered mid-crawl — which hands it to whatever
    // host the agent was steered at.
    if (envCookieHostAllowed(opts.host)) {
      return { cookieHeader: envCookie, source: "env:PHNEAKNGAR_AUTH_COOKIE_HEADER" };
    }
    warnEnvCookieSkipped(opts.host);
  }

  const paths = opts.authStatePath
    ? [opts.authStatePath]
    : defaultAuthPaths();

  for (const p of paths) {
    if (!p || !existsSync(p)) continue;
    try {
      const raw = readFileSync(p, "utf-8");
      if (p.endsWith(".json") || raw.trimStart().startsWith("{")) {
        const cookie = cookiesFromStorageState(JSON.parse(raw), opts.host);
        if (cookie) return { cookieHeader: cookie, source: p };
      } else {
        const cookie = cookiesFromNetscape(raw, opts.host);
        if (cookie) return { cookieHeader: cookie, source: p };
      }
    } catch {
      // try next
    }
  }
  return null;
}

/** Merge auth into fetch HeadersInit. */
export function applyAuthHeaders(
  base: Record<string, string> | undefined,
  auth: AuthConfig | null,
): Record<string, string> {
  const h = { ...(base ?? {}) };
  if (auth?.cookieHeader) h.Cookie = auth.cookieHeader;
  if (auth?.headers) Object.assign(h, auth.headers);
  return h;
}
