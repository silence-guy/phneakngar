export const NON_PRODUCTION_EMAIL_DOMAIN = "phneakngar.invalid";

export type EmailDomainEnvironment = "development" | "test" | "production";

const HANDLE_RE = /^[a-zA-Z0-9-]{3,}$/;
const DOMAIN_LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

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

function invalidDomain(): never {
  throw new Error("Invalid email domain configuration");
}

/** Normalize and validate an explicitly configured DNS email domain. */
export function getEmailDomain(domain: string): string {
  if (typeof domain !== "string") return invalidDomain();

  const normalized = domain.trim().replace(/^@/, "").toLowerCase();
  if (
    !normalized ||
    normalized.length > 253 ||
    normalized.includes("@") ||
    normalized.includes(":") ||
    normalized.includes("/") ||
    normalized.endsWith(".")
  ) {
    return invalidDomain();
  }

  const labels = normalized.split(".");
  if (labels.length < 2 || labels.some((label) => !DOMAIN_LABEL_RE.test(label))) {
    return invalidDomain();
  }

  return normalized;
}

/**
 * Resolve an environment-provided domain. Only development and tests may use
 * the visibly non-production fallback. Production always requires an explicit,
 * valid, non-fallback domain.
 */
export function resolveEmailDomain(
  domain: string | null | undefined,
  environment: EmailDomainEnvironment,
): string {
  if (environment !== "development" && environment !== "test" && environment !== "production") {
    return invalidDomain();
  }

  if (!domain?.trim()) {
    if (environment === "production") return invalidDomain();
    return NON_PRODUCTION_EMAIL_DOMAIN;
  }

  const normalized = getEmailDomain(domain);
  if (environment === "production" && normalized === NON_PRODUCTION_EMAIL_DOMAIN) {
    return invalidDomain();
  }
  return normalized;
}

export function emailDomainSuffix(domain: string): string {
  return `@${getEmailDomain(domain)}`;
}

export function parseEmailHandle(address: string, domain: string): string {
  const suffix = emailDomainSuffix(domain);
  const lower = address.toLowerCase();
  // Accept optional display-name wrappers: Name <handle@domain>
  const angle = lower.match(/<([^>]+)>$/);
  const addr = (angle?.[1] ?? lower).trim();
  if (!addr.endsWith(suffix)) return "";
  return addr.slice(0, -suffix.length);
}

export function toPhneakngarAddress(handle: string, domain: string): string {
  return `${handle}${emailDomainSuffix(domain)}`;
}

export function isValidHandle(h: string): boolean {
  return HANDLE_RE.test(h) && !RESERVED_HANDLES.has(h.toLowerCase());
}
