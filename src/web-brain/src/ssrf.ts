/**
 * SSRF guards for outbound web fetch.
 * Blocks non-http(s), credentials-in-URL abuse patterns, and private/link-local/metadata hosts/IPs.
 */

import { isIP } from "node:net";
import type { WebError, WebErrorCode } from "./types.js";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata",
  "0.0.0.0",
]);

export type SafeUrlResult =
  | { ok: true; url: URL }
  | { ok: false; code: WebErrorCode; message: string };

function fail(code: WebErrorCode, message: string): SafeUrlResult {
  return { ok: false, code, message };
}

/** True for IPv4 private, loopback, link-local, CGNAT, etc. */
export function isBlockedIPv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local / cloud metadata 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && b === 168) return true; // 192.168/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a === 192 && b === 0 && parts[2] === 0) return true; // 192.0.0.0/24
  if (a === 192 && b === 0 && parts[2] === 2) return true; // TEST-NET-1
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 198 && b === 51 && parts[2] === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && parts[2] === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // multicast / reserved
  return false;
}

/** True for IPv6 loopback, ULA, link-local, IPv4-mapped private, etc. */
export function isBlockedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fe80:")) return true; // link-local
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // ULA
  if (normalized.startsWith("ff")) return true; // multicast
  // IPv4-mapped ::ffff:x.x.x.x
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return isBlockedIPv4(mapped[1]!);
  return false;
}

export function isBlockedIpAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return isBlockedIPv4(ip);
  if (v === 6) return isBlockedIPv6(ip);
  return true;
}

/**
 * Validate that a string is a safe public http(s) URL before any network I/O.
 * Does not perform DNS — call {@link assertResolvedAddressesSafe} after lookup.
 */
export function assertSafeHttpUrl(
  raw: string,
  opts: { allowPrivateNetwork?: boolean } = {},
): SafeUrlResult {
  if (typeof raw !== "string" || !raw.trim()) {
    return fail("invalid_url", "URL is required");
  }
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return fail("invalid_url", `Invalid URL: ${raw}`);
  }

  const scheme = url.protocol.replace(/:$/, "").toLowerCase();
  if (scheme !== "http" && scheme !== "https") {
    return fail("blocked_scheme", `Blocked URL scheme: ${scheme}`);
  }

  if (url.username || url.password) {
    return fail("invalid_url", "URLs with embedded credentials are not allowed");
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) {
    return fail("invalid_url", "URL host is required");
  }

  if (!opts.allowPrivateNetwork) {
    if (BLOCKED_HOSTNAMES.has(host) || host.endsWith(".localhost") || host.endsWith(".local")) {
      return fail("blocked_host", `Blocked host: ${host}`);
    }
    // Decimal / hex IP tricks — only accept if node:net parses and not blocked
    const ipVersion = isIP(host);
    if (ipVersion === 4 || ipVersion === 6) {
      if (isBlockedIpAddress(host)) {
        return fail("blocked_ip", `Blocked IP address: ${host}`);
      }
    } else if (/^\d+$/.test(host)) {
      // Integer IPv4 form e.g. 2130706433 → 127.0.0.1
      try {
        const n = Number(host) >>> 0;
        const dotted = [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
        if (isBlockedIPv4(dotted)) {
          return fail("blocked_ip", `Blocked IP address: ${host}`);
        }
      } catch {
        return fail("invalid_url", `Invalid host: ${host}`);
      }
    }
  }

  return { ok: true, url };
}

/** After DNS resolve, ensure no private address is targeted. */
export function assertResolvedAddressesSafe(
  addresses: string[],
  opts: { allowPrivateNetwork?: boolean } = {},
): SafeUrlResult | { ok: true } {
  if (opts.allowPrivateNetwork) return { ok: true };
  if (!addresses.length) {
    return fail("dns_failed", "DNS returned no addresses");
  }
  for (const addr of addresses) {
    if (isBlockedIpAddress(addr)) {
      return fail("blocked_ip", `Resolved to blocked address: ${addr}`);
    }
  }
  return { ok: true };
}

export function toWebError(code: WebErrorCode, message: string): WebError {
  return { ok: false, error: { code, message } };
}
