/**
 * Sender authenticity for inbound email.
 *
 * The From address on inbound mail is attacker-controlled: any SMTP client can claim to be
 * anyone. Treating it as an identity means a spoofed From that matches a whitelist entry (or
 * another agent's handle) auto-dispatches an agent task on attacker content. Before trusting
 * it we require a passing authentication result aligned with the claimed From domain.
 *
 * Cloudflare Email Routing and most receiving MTAs prepend an `Authentication-Results`
 * header (RFC 8601). Absence of that header means "unverified", never "trusted".
 */

/** Domain part of an email address, lowercased. "" when unparseable. */
export function emailDomainOf(address: string): string {
  const at = address.lastIndexOf("@");
  if (at < 0) return "";
  return address
    .slice(at + 1)
    .trim()
    .replace(/^<|>$/g, "")
    .toLowerCase();
}

/**
 * True when `candidate` is the From domain or a parent of it.
 * Relaxed alignment: a DKIM signature from example.com authenticates mail@sub.example.com.
 */
function domainsAligned(candidate: string, fromDomain: string): boolean {
  if (!candidate || !fromDomain) return false;
  if (candidate === fromDomain) return true;
  return fromDomain.endsWith(`.${candidate}`);
}

/** Extract a `key=value` property for a given method from an Authentication-Results header. */
function methodProperty(
  header: string,
  method: string,
  property: string,
): string | null {
  // e.g. "dkim=pass header.d=example.com" — scope the property lookup to the segment that
  // follows the method result so a passing SPF's domain can't be read as DKIM's.
  const methodIdx = header.toLowerCase().indexOf(`${method}=`);
  if (methodIdx < 0) return null;
  const segment = header.slice(methodIdx);
  const re = new RegExp(`${property}\\s*=\\s*"?([^;\\s"]+)"?`, "i");
  const m = re.exec(segment);
  return m ? m[1].trim().toLowerCase().replace(/^@/, "") : null;
}

/** True when the named method reported `pass`. */
function methodPassed(header: string, method: string): boolean {
  return new RegExp(`\\b${method}\\s*=\\s*pass\\b`, "i").test(header);
}

export interface SenderAuthenticityInput {
  /** Raw Authentication-Results header value, or null when absent. */
  authResultsHeader: string | null | undefined;
  /** The claimed From address (or its domain). */
  fromAddress: string;
}

/**
 * Whether the inbound sender is authenticated well enough to trust its From address.
 *
 * Accepts either:
 *  - `dkim=pass` with `header.d` aligned to the From domain, or
 *  - `dmarc=pass` (DMARC already requires aligned SPF or DKIM), or
 *  - `spf=pass` with the envelope/smtp.mailfrom domain aligned to the From domain.
 */
export function isSenderAuthenticated(input: SenderAuthenticityInput): boolean {
  const header = input.authResultsHeader?.trim();
  if (!header) return false;

  const fromDomain = input.fromAddress.includes("@")
    ? emailDomainOf(input.fromAddress)
    : input.fromAddress.trim().toLowerCase();
  if (!fromDomain) return false;

  if (methodPassed(header, "dkim")) {
    const d = methodProperty(header, "dkim", "header\\.d");
    if (d && domainsAligned(d, fromDomain)) return true;
  }

  // DMARC passing already implies aligned SPF or DKIM for the From domain.
  if (methodPassed(header, "dmarc")) {
    const dmarcFrom = methodProperty(header, "dmarc", "header\\.from");
    if (!dmarcFrom || domainsAligned(dmarcFrom, fromDomain)) return true;
  }

  if (methodPassed(header, "spf")) {
    const mailFrom =
      methodProperty(header, "spf", "smtp\\.mailfrom") ??
      methodProperty(header, "spf", "smtp\\.helo");
    if (mailFrom) {
      const spfDomain = mailFrom.includes("@") ? emailDomainOf(mailFrom) : mailFrom;
      if (domainsAligned(spfDomain, fromDomain)) return true;
    }
  }

  return false;
}

/**
 * Resolve the effective whitelist decision.
 *
 * `requireAuth` reflects EMAIL_REQUIRE_SENDER_AUTH and defaults to true. Operators whose
 * upstream MTA strips Authentication-Results can opt out, accepting that a spoofed From can
 * then trigger agent dispatch.
 */
export function resolveWhitelistTrust(opts: {
  whitelisted: boolean;
  authResultsHeader: string | null | undefined;
  fromAddress: string;
  requireAuth: boolean;
}): { trusted: boolean; reason: "not_whitelisted" | "unauthenticated_sender" | "trusted" } {
  if (!opts.whitelisted) return { trusted: false, reason: "not_whitelisted" };
  if (!opts.requireAuth) return { trusted: true, reason: "trusted" };
  const authenticated = isSenderAuthenticated({
    authResultsHeader: opts.authResultsHeader,
    fromAddress: opts.fromAddress,
  });
  return authenticated
    ? { trusted: true, reason: "trusted" }
    : { trusted: false, reason: "unauthenticated_sender" };
}

/** Parse EMAIL_REQUIRE_SENDER_AUTH; secure default (true) when unset or unrecognised. */
export function shouldRequireSenderAuth(value: string | undefined | null): boolean {
  const v = value?.trim().toLowerCase();
  if (v === "false" || v === "0" || v === "no") return false;
  return true;
}

/** Pull the Authentication-Results header out of a raw RFC822 message. */
export function extractAuthResultsFromRaw(raw: string): string | null {
  // Header section only; stop at the first blank line so a body mention can't be read as one.
  const headerEnd = raw.search(/\r?\n\r?\n/);
  const headerBlock = headerEnd >= 0 ? raw.slice(0, headerEnd) : raw;
  // Unfold continuation lines (leading whitespace) before matching.
  const unfolded = headerBlock.replace(/\r?\n[ \t]+/g, " ");
  const match = /^Authentication-Results\s*:\s*(.+)$/im.exec(unfolded);
  return match ? match[1].trim() : null;
}
