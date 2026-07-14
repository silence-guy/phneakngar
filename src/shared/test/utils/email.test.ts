import { describe, it, expect } from "vitest"
import {
  parseEmailHandle,
  toPhneakngarAddress,
  isValidHandle,
  getEmailDomain,
  resolveEmailDomain,
  NON_PRODUCTION_EMAIL_DOMAIN,
} from "../../src/utils/email"

describe("getEmailDomain", () => {
  it("normalizes an explicit domain", () => {
    expect(getEmailDomain(" Example.COM ")).toBe("example.com")
    expect(getEmailDomain("@mail.example.com")).toBe("mail.example.com")
  })

  it.each([
    "",
    "localhost",
    "https://example.com",
    "example.com/path",
    "user@example.com",
    "example.com:443",
    "-example.com",
    "example-.com",
    "example..com",
    "example.com.",
  ])("rejects invalid domain %j without echoing it", (domain) => {
    expect(() => getEmailDomain(domain)).toThrow("Invalid email domain configuration")
    try {
      getEmailDomain(domain)
    } catch (error) {
      expect(String(error)).not.toContain(domain || "not-present")
    }
  })
})

describe("resolveEmailDomain", () => {
  it.each(["development", "test"] as const)("uses a visible fallback in %s", (environment) => {
    expect(resolveEmailDomain(undefined, environment)).toBe(NON_PRODUCTION_EMAIL_DOMAIN)
  })

  it("requires an explicit valid non-fallback production domain", () => {
    expect(() => resolveEmailDomain(undefined, "production")).toThrow("Invalid email domain configuration")
    expect(() => resolveEmailDomain("bad domain", "production")).toThrow("Invalid email domain configuration")
    expect(() => resolveEmailDomain(NON_PRODUCTION_EMAIL_DOMAIN, "production")).toThrow("Invalid email domain configuration")
    expect(resolveEmailDomain("agents.example.com", "production")).toBe("agents.example.com")
  })
})

describe("parseEmailHandle", () => {
  it("extracts handles only for the selected domain", () => {
    expect(parseEmailHandle("Jarvis@agents.example.com", "agents.example.com")).toBe("jarvis")
    expect(parseEmailHandle("Jarvis <jarvis@agents.example.com>", "agents.example.com")).toBe("jarvis")
    expect(parseEmailHandle("jarvis@other.example", "agents.example.com")).toBe("")
  })

  it("supports a second custom domain without code changes", () => {
    expect(parseEmailHandle("jarvis@robots.example", "robots.example")).toBe("jarvis")
  })
})

describe("toPhneakngarAddress", () => {
  it("requires and normalizes an explicit domain", () => {
    expect(toPhneakngarAddress("jarvis", "Agents.Example.com")).toBe("jarvis@agents.example.com")
  })
})

describe("isValidHandle", () => {
  it("accepts 3+ alphanum+dash", () => { expect(isValidHandle("jarvis")).toBe(true); expect(isValidHandle("my-bot")).toBe(true); expect(isValidHandle("abc")).toBe(true) })
  it("rejects <3", () => expect(isValidHandle("ab")).toBe(false))
  it("rejects spaces/underscores", () => { expect(isValidHandle("my agent")).toBe(false); expect(isValidHandle("my_bot")).toBe(false) })
  it("rejects reserved handles", () => {
    expect(isValidHandle("no-reply")).toBe(false)
    expect(isValidHandle("noreply")).toBe(false)
    expect(isValidHandle("admin")).toBe(false)
    expect(isValidHandle("support")).toBe(false)
    expect(isValidHandle("postmaster")).toBe(false)
    expect(isValidHandle("abuse")).toBe(false)
    expect(isValidHandle("phneakngar")).toBe(false)
  })
  it("rejects reserved handles case-insensitively", () => {
    expect(isValidHandle("No-Reply")).toBe(false)
    expect(isValidHandle("ADMIN")).toBe(false)
  })
})
