import { describe, expect, it } from "vitest";
import { isPublicNetworkHost, normalizePublicNetworkHost } from "../src/network-host";

describe("public network host validation", () => {
  it("accepts public provider hostnames", () => {
    expect(normalizePublicNetworkHost(" imap.gmail.com ")).toBe("imap.gmail.com");
    expect(normalizePublicNetworkHost("smtp.office365.com.")).toBe("smtp.office365.com");
    expect(isPublicNetworkHost("mail.example.com")).toBe(true);
  });

  it("accepts public IPv4 literals", () => {
    expect(isPublicNetworkHost("8.8.8.8")).toBe(true);
  });

  it.each([
    "localhost",
    "imap.localhost",
    "imap",
    "http://imap.gmail.com",
    "mail.example.com:993",
    "user@mail.example.com",
    "bad host.example.com",
    "127.0.0.1",
    "10.0.0.1",
    "172.20.0.1",
    "192.168.1.1",
    "169.254.1.1",
    "100.64.0.1",
    "198.18.0.1",
    "198.51.100.7",
    "203.0.113.9",
    "[::1]",
    "::1",
    "-bad.example.com",
    "bad-.example.com",
    "example.123",
  ])("rejects unsafe or malformed host %s", host => {
    expect(isPublicNetworkHost(host)).toBe(false);
  });
});
