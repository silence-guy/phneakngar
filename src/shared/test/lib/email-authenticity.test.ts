import { describe, it, expect } from "vitest";
import {
  isSenderAuthenticated,
  resolveWhitelistTrust,
  shouldRequireSenderAuth,
  extractAuthResultsFromRaw,
  emailDomainOf,
} from "../../src/lib/email-authenticity";

describe("emailDomainOf", () => {
  it("extracts and lowercases the domain", () => {
    expect(emailDomainOf("Alice@Example.COM")).toBe("example.com");
    expect(emailDomainOf("a@b@sub.example.com")).toBe("sub.example.com");
    expect(emailDomainOf("not-an-address")).toBe("");
  });
});

describe("isSenderAuthenticated", () => {
  it("accepts dkim=pass aligned with the From domain", () => {
    expect(
      isSenderAuthenticated({
        authResultsHeader: "mx.cloudflare.com; dkim=pass header.d=example.com; spf=pass",
        fromAddress: "boss@example.com",
      }),
    ).toBe(true);
  });

  it("accepts dkim=pass on a parent domain (relaxed alignment)", () => {
    expect(
      isSenderAuthenticated({
        authResultsHeader: "mx; dkim=pass header.d=example.com",
        fromAddress: "boss@mail.example.com",
      }),
    ).toBe(true);
  });

  it("rejects when the header is absent — unverified is not trusted", () => {
    expect(
      isSenderAuthenticated({ authResultsHeader: null, fromAddress: "boss@example.com" }),
    ).toBe(false);
    expect(
      isSenderAuthenticated({ authResultsHeader: "   ", fromAddress: "boss@example.com" }),
    ).toBe(false);
  });

  it("rejects dkim=fail", () => {
    expect(
      isSenderAuthenticated({
        authResultsHeader: "mx; dkim=fail header.d=example.com",
        fromAddress: "boss@example.com",
      }),
    ).toBe(false);
  });

  it("rejects dkim=pass signed by an unrelated domain", () => {
    // The core spoofing case: attacker signs with their own domain but forges From.
    expect(
      isSenderAuthenticated({
        authResultsHeader: "mx; dkim=pass header.d=attacker.example",
        fromAddress: "boss@example.com",
      }),
    ).toBe(false);
  });

  it("rejects a lookalike suffix that is not a real parent domain", () => {
    expect(
      isSenderAuthenticated({
        authResultsHeader: "mx; dkim=pass header.d=notexample.com",
        fromAddress: "boss@example.com",
      }),
    ).toBe(false);
  });

  it("accepts dmarc=pass", () => {
    expect(
      isSenderAuthenticated({
        authResultsHeader: "mx; dmarc=pass header.from=example.com",
        fromAddress: "boss@example.com",
      }),
    ).toBe(true);
  });

  it("rejects dmarc=pass reported for a different From domain", () => {
    expect(
      isSenderAuthenticated({
        authResultsHeader: "mx; dmarc=pass header.from=attacker.example",
        fromAddress: "boss@example.com",
      }),
    ).toBe(false);
  });

  it("accepts spf=pass with aligned smtp.mailfrom", () => {
    expect(
      isSenderAuthenticated({
        authResultsHeader: "mx; spf=pass smtp.mailfrom=bounce@example.com",
        fromAddress: "boss@example.com",
      }),
    ).toBe(true);
  });

  it("rejects spf=pass whose mailfrom is a different domain", () => {
    // Classic SPF-passes-but-From-is-forged: the envelope is attacker.example, From is not.
    expect(
      isSenderAuthenticated({
        authResultsHeader: "mx; spf=pass smtp.mailfrom=bounce@attacker.example; dkim=none",
        fromAddress: "boss@example.com",
      }),
    ).toBe(false);
  });

  it("does not read a passing SPF domain as the DKIM domain", () => {
    // dkim=none but spf=pass aligned -> must not be credited to dkim.
    expect(
      isSenderAuthenticated({
        authResultsHeader: "mx; dkim=none header.d=attacker.example; spf=pass smtp.mailfrom=x@example.com",
        fromAddress: "boss@example.com",
      }),
    ).toBe(true);
    expect(
      isSenderAuthenticated({
        authResultsHeader: "mx; dkim=none; spf=fail smtp.mailfrom=x@example.com",
        fromAddress: "boss@example.com",
      }),
    ).toBe(false);
  });
});

describe("shouldRequireSenderAuth", () => {
  it("defaults to true when unset or unrecognised", () => {
    expect(shouldRequireSenderAuth(undefined)).toBe(true);
    expect(shouldRequireSenderAuth(null)).toBe(true);
    expect(shouldRequireSenderAuth("")).toBe(true);
    expect(shouldRequireSenderAuth("true")).toBe(true);
    expect(shouldRequireSenderAuth("maybe")).toBe(true);
  });

  it("honours explicit opt-out values", () => {
    expect(shouldRequireSenderAuth("false")).toBe(false);
    expect(shouldRequireSenderAuth("0")).toBe(false);
    expect(shouldRequireSenderAuth("NO")).toBe(false);
  });
});

describe("resolveWhitelistTrust", () => {
  const authed = "mx; dkim=pass header.d=example.com";

  it("trusts a whitelisted, authenticated sender", () => {
    expect(
      resolveWhitelistTrust({
        whitelisted: true,
        authResultsHeader: authed,
        fromAddress: "boss@example.com",
        requireAuth: true,
      }),
    ).toEqual({ trusted: true, reason: "trusted" });
  });

  it("distrusts a whitelisted but unauthenticated sender", () => {
    expect(
      resolveWhitelistTrust({
        whitelisted: true,
        authResultsHeader: null,
        fromAddress: "boss@example.com",
        requireAuth: true,
      }),
    ).toEqual({ trusted: false, reason: "unauthenticated_sender" });
  });

  it("restores legacy trust when the requirement is disabled", () => {
    expect(
      resolveWhitelistTrust({
        whitelisted: true,
        authResultsHeader: null,
        fromAddress: "boss@example.com",
        requireAuth: false,
      }),
    ).toEqual({ trusted: true, reason: "trusted" });
  });

  it("never trusts a non-whitelisted sender, however well authenticated", () => {
    expect(
      resolveWhitelistTrust({
        whitelisted: false,
        authResultsHeader: authed,
        fromAddress: "boss@example.com",
        requireAuth: true,
      }),
    ).toEqual({ trusted: false, reason: "not_whitelisted" });
  });
});

describe("extractAuthResultsFromRaw", () => {
  it("reads the header from a raw message", () => {
    const raw = [
      "From: boss@example.com",
      "Authentication-Results: mx.cloudflare.com; dkim=pass header.d=example.com",
      "Subject: hi",
      "",
      "body",
    ].join("\r\n");
    expect(extractAuthResultsFromRaw(raw)).toBe(
      "mx.cloudflare.com; dkim=pass header.d=example.com",
    );
  });

  it("unfolds a wrapped header", () => {
    const raw = [
      "From: boss@example.com",
      "Authentication-Results: mx.cloudflare.com;",
      "  dkim=pass header.d=example.com",
      "",
      "body",
    ].join("\r\n");
    expect(extractAuthResultsFromRaw(raw)).toContain("dkim=pass header.d=example.com");
  });

  it("ignores a body line that imitates the header", () => {
    // Otherwise an attacker could forge authenticity by putting the header in the body.
    const raw = [
      "From: attacker@evil.example",
      "Subject: hi",
      "",
      "Authentication-Results: mx; dkim=pass header.d=example.com",
    ].join("\r\n");
    expect(extractAuthResultsFromRaw(raw)).toBeNull();
  });

  it("returns null when no header is present", () => {
    expect(extractAuthResultsFromRaw("From: a@b.com\r\n\r\nbody")).toBeNull();
  });
});
