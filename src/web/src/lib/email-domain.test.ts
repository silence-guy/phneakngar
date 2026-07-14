import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getPublicEmailDomain,
  resolvePublicEmailDomain,
  resolveServerEmailDomain,
  toPublicPhneakngarAddress,
} from "./email-domain";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("web email domain boundaries", () => {
  it("keeps browser and server on the same explicit configured domain", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_PHNEAKNGAR_DOMAIN", "Agents.Example");

    expect(getPublicEmailDomain()).toBe("agents.example");
    expect(resolveServerEmailDomain({ PHNEAKNGAR_DOMAIN: "agents.example", NODE_ENV: "production" })).toBe("agents.example");
    expect(toPublicPhneakngarAddress("jarvis")).toBe("jarvis@agents.example");
  });

  it("supports a second custom domain without code changes", () => {
    expect(resolvePublicEmailDomain("robots.example", "production")).toBe("robots.example");
    expect(resolveServerEmailDomain({ PHNEAKNGAR_DOMAIN: "robots.example", NODE_ENV: "production" })).toBe("robots.example");
  });

  it("uses only the visible non-production fallback outside production", () => {
    expect(resolvePublicEmailDomain(undefined, "development")).toBe("phneakngar.invalid");
    expect(resolveServerEmailDomain({ NODE_ENV: "test" })).toBe("phneakngar.invalid");
  });

  it("rejects a production browser build without explicit domain configuration", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_PHNEAKNGAR_DOMAIN", "");
    expect(() => getPublicEmailDomain()).toThrow("Invalid email domain configuration");
  });

  it("allows an explicitly marked local optimized build to use the visible fallback", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_PHNEAKNGAR_ENVIRONMENT", "development");
    vi.stubEnv("NEXT_PUBLIC_PHNEAKNGAR_DOMAIN", "phneakngar.invalid");
    expect(getPublicEmailDomain()).toBe("phneakngar.invalid");
  });

  it("rejects missing, invalid, and fallback production values generically", () => {
    for (const value of [undefined, "https://private.example/path", "phneakngar.invalid"]) {
      expect(() => resolvePublicEmailDomain(value, "production")).toThrow("Invalid email domain configuration");
    }
  });

  it("restores browser environment mutations in isolated setup", () => {
    vi.stubEnv("NEXT_PUBLIC_PHNEAKNGAR_DOMAIN", "temporary.example");
    expect(getPublicEmailDomain()).toBe("temporary.example");

    vi.unstubAllEnvs();
    expect(resolvePublicEmailDomain(undefined, "test")).toBe("phneakngar.invalid");
  });
});
