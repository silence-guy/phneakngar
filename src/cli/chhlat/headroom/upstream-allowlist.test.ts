import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { validateUpstreamBaseUrl } from "./config-generator.js";

/**
 * The upstream base_url is server-pushed in the task payload and decides where the headroom
 * proxy forwards requests carrying the operator's real API keys. These cases pin that a
 * hostile control plane cannot redirect credentialed traffic to a host of its choosing.
 */
const ORIGINAL = process.env.PHNEAKNGAR_HEADROOM_UPSTREAM_HOSTS;

beforeEach(() => {
  delete process.env.PHNEAKNGAR_HEADROOM_UPSTREAM_HOSTS;
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.PHNEAKNGAR_HEADROOM_UPSTREAM_HOSTS;
  else process.env.PHNEAKNGAR_HEADROOM_UPSTREAM_HOSTS = ORIGINAL;
});

describe("validateUpstreamBaseUrl", () => {
  it("accepts the official provider endpoints", () => {
    expect(validateUpstreamBaseUrl("https://api.anthropic.com", "claude")).toBe(
      "https://api.anthropic.com",
    );
    expect(validateUpstreamBaseUrl("https://api.openai.com/v1", "openai")).toBe(
      "https://api.openai.com/v1",
    );
  });

  it("rejects an attacker-chosen host by default", () => {
    expect(validateUpstreamBaseUrl("https://attacker.example/v1", "claude")).toBeNull();
    expect(validateUpstreamBaseUrl("https://attacker.example/v1", "openai")).toBeNull();
  });

  it("rejects a lookalike domain that merely ends with the provider name", () => {
    expect(validateUpstreamBaseUrl("https://notanthropic.com", "claude")).toBeNull();
    expect(validateUpstreamBaseUrl("https://anthropic.com.evil.example", "claude")).toBeNull();
  });

  it("does not let a claude host authorize an openai upstream", () => {
    expect(validateUpstreamBaseUrl("https://api.anthropic.com", "openai")).toBeNull();
  });

  it("rejects http — the API key travels on this connection", () => {
    expect(validateUpstreamBaseUrl("http://api.anthropic.com", "claude")).toBeNull();
  });

  it("rejects embedded credentials", () => {
    expect(
      validateUpstreamBaseUrl("https://user:pass@api.anthropic.com", "claude"),
    ).toBeNull();
  });

  it("rejects CRLF that could break out of the YAML scalar", () => {
    expect(
      validateUpstreamBaseUrl("https://api.anthropic.com\r\nopenai:\n  base_url: x", "claude"),
    ).toBeNull();
  });

  it("rejects a malformed URL and blank values", () => {
    expect(validateUpstreamBaseUrl("not-a-url", "claude")).toBeNull();
    expect(validateUpstreamBaseUrl("", "claude")).toBeNull();
    expect(validateUpstreamBaseUrl(undefined, "claude")).toBeNull();
  });

  it("accepts a third-party gateway only once the operator approves the host", () => {
    expect(validateUpstreamBaseUrl("https://litellm.internal/v1", "claude")).toBeNull();

    process.env.PHNEAKNGAR_HEADROOM_UPSTREAM_HOSTS = "litellm.internal, openrouter.ai";
    expect(validateUpstreamBaseUrl("https://litellm.internal/v1", "claude")).toBe(
      "https://litellm.internal/v1",
    );
    expect(validateUpstreamBaseUrl("https://openrouter.ai/api/v1", "openai")).toBe(
      "https://openrouter.ai/api/v1",
    );
    // Still not a free pass for anything else.
    expect(validateUpstreamBaseUrl("https://attacker.example", "claude")).toBeNull();
  });

  it("treats an approved host's subdomains as approved", () => {
    process.env.PHNEAKNGAR_HEADROOM_UPSTREAM_HOSTS = "corp.example";
    expect(validateUpstreamBaseUrl("https://llm.corp.example/v1", "openai")).toBe(
      "https://llm.corp.example/v1",
    );
  });
});
