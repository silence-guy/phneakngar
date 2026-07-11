import { afterEach, describe, expect, it, vi } from "vitest";
import setupE2eEnvironment from "./e2e-global-setup";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("E2E global preflight", () => {
  it("requires an explicit APP_URL", async () => {
    vi.stubEnv("APP_URL", "");

    await expect(setupE2eEnvironment()).rejects.toThrow("APP_URL is required");
  });

  it("rejects an unrelated HTML service", async () => {
    vi.stubEnv("APP_URL", "http://localhost:15210");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html></html>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    })));

    await expect(setupE2eEnvironment()).rejects.toThrow("is not ភ្នាក់ងារ");
  });

  it("accepts a healthy application and normalizes APP_URL", async () => {
    vi.stubEnv("APP_URL", "http://localhost:15210/");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      status: "ok",
      checks: { database: { status: "ok" } },
    })));

    await expect(setupE2eEnvironment()).resolves.toBeUndefined();
    expect(process.env.APP_URL).toBe("http://localhost:15210");
  });
});
