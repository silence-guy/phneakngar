import { describe, expect, it } from "vitest";
import { resolveMetadataBase } from "./public-site-url";

describe("resolveMetadataBase", () => {
  it("uses the configured canonical origin", () => {
    expect(resolveMetadataBase("https://app.example.com", "production").href)
      .toBe("https://app.example.com/");
  });

  it("uses the production canonical origin when configuration is absent", () => {
    expect(resolveMetadataBase("", "production").href)
      .toBe("https://phneakngar.ai/");
  });

  it("uses the documented local web origin outside production", () => {
    expect(resolveMetadataBase(undefined, "development").href)
      .toBe("http://localhost:15210/");
  });

  it.each([
    "ftp://example.com",
    "https://example.com/app",
    "https://example.com?preview=1",
    "https://example.com#section",
  ])("rejects a non-origin site URL: %s", (siteUrl) => {
    expect(() => resolveMetadataBase(siteUrl, "production")).toThrow();
  });
});
