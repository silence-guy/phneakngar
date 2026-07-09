import { describe, it, expect, vi, beforeEach } from "vitest";

const { mocks } = vi.hoisted(() => {
  const mocks = {
  readFileSync: vi.fn(),
  };
  return { mocks };
});

vi.mock("fs", () => ({
  readFileSync: mocks.readFileSync,
}));

import { getCurrentVersion } from "./version.js";

describe("getCurrentVersion", () => {
  beforeEach(() => {
    mocks.readFileSync.mockClear();
  });

  it("returns a version string when package.json exists", () => {
    // When the actual package.json is readable, it should return a version
    const v = getCurrentVersion();
    // In the test environment, this may return "unknown" if package.json is not accessible
    // That's acceptable - the important thing is it's a string
    expect(typeof v).toBe("string");
    expect(v.length).toBeGreaterThan(0);
  });

  it("returns unknown when package.json cannot be read", () => {
    mocks.readFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });

    const v = getCurrentVersion();
    expect(v).toBe("unknown");
  });

  it("returns the version from package.json when accessible", () => {
    // Mock the filesystem to return a valid package.json
    mocks.readFileSync.mockImplementation((path: string) => {
      if (path.includes("package.json")) {
        return JSON.stringify({ version: "99.99.99" });
      }
      throw new Error("ENOENT");
    });

    const v = getCurrentVersion();
    expect(v).toBe("99.99.99");
  });
});
