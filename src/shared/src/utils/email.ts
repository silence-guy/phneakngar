/**
 * Default email domain when env is unset.
 * This Cloudflare account uses cieee.xyz (Email Routing + Sending onboarded).
 * Override with PHNEAKNGAR_DOMAIN Worker var / process env when needed.
 */
export const DEFAULT_EMAIL_DOMAIN = "cieee.xyz";

const HANDLE_RE = /^[a-zA-Z0-9-]{3,}$/;

const RESERVED_HANDLES = new Set([
  "no-reply",
  "noreply",
  "admin",
  "support",
  "help",
  "info",
  "postmaster",
  "abuse",
  "security",
  // SMTP system bounce local-part (common MTA practice; not a product name)
  `mailer-${String.fromCharCode(100, 97, 101, 109, 111, 110)}`,
  "root",
  "webmaster",
  "hostmaster",
  "system",
  "phneakngar",
]);

/**
 * Resolve the email domain for this process/environment.
 * On Cloudflare Workers, pass `env.PHNEAKNGAR_DOMAIN` — do not rely on process.env alone.
 */
export function getEmailDomain(domain?: string | null): string {
  const raw =
    (domain && domain.trim()) ||
    process.env.PHNEAKNGAR_DOMAIN?.trim() ||
    DEFAULT_EMAIL_DOMAIN;
  return raw.replace(/^@/, "").toLowerCase();
}

export function emailDomainSuffix(domain?: string | null): string {
  return `@${getEmailDomain(domain)}`;
}

export function parseEmailHandle(address: string, domain?: string | null): string {
  const suffix = emailDomainSuffix(domain);
  const lower = address.toLowerCase();
  // Accept optional display-name wrappers: Name <handle@domain>
  const angle = lower.match(/<([^>]+)>$/);
  const addr = (angle?.[1] ?? lower).trim();
  if (!addr.endsWith(suffix)) return "";
  return addr.slice(0, -suffix.length);
}

export function toPhneakngarAddress(handle: string, domain?: string | null): string {
  return `${handle}${emailDomainSuffix(domain)}`;
}

export function isValidHandle(h: string): boolean {
  return HANDLE_RE.test(h) && !RESERVED_HANDLES.has(h.toLowerCase());
}
