import { describe, it, expect } from "vitest"
import {
  parseEmailHandle,
  toPhneakngarAddress,
  isValidHandle,
  getEmailDomain,
} from "../../src/utils/email"

describe("getEmailDomain", () => {
  it("normalizes and strips leading @", () => {
    expect(getEmailDomain("cieee.xyz")).toBe("cieee.xyz")
    expect(getEmailDomain("@cieee.xyz")).toBe("cieee.xyz")
  })
  it("defaults to cieee.xyz when unset", () => {
    const prev = process.env.PHNEAKNGAR_DOMAIN
    delete process.env.PHNEAKNGAR_DOMAIN
    expect(getEmailDomain()).toBe("cieee.xyz")
    if (prev === undefined) delete process.env.PHNEAKNGAR_DOMAIN
    else process.env.PHNEAKNGAR_DOMAIN = prev
  })
})

describe("parseEmailHandle", () => {
  it("extracts handle", () => expect(parseEmailHandle("jarvis@cieee.xyz")).toBe("jarvis"))
  it("uses explicit domain", () =>
    expect(parseEmailHandle("jarvis@example.com", "example.com")).toBe("jarvis"))
  it("empty for foreign domain", () => expect(parseEmailHandle("u@gmail.com")).toBe(""))
})
describe("toPhneakngarAddress", () => {
  it("appends domain", () => expect(toPhneakngarAddress("jarvis")).toBe("jarvis@cieee.xyz"))
  it("uses explicit domain", () =>
    expect(toPhneakngarAddress("no-reply", "cieee.xyz")).toBe("no-reply@cieee.xyz"))
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
