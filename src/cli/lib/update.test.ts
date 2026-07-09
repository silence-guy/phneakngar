import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mocks } = vi.hoisted(() => {
  const mocks = {
  spawn: vi.fn(),
  };
  return { mocks };
});

vi.mock("child_process", () => ({
  spawn: mocks.spawn,
}));

import { fetchLatestVersion, isValidCliVersion, runNpmUpdate } from "./update";

// Note: afterEach is imported from vitest globals in vitest.shared.ts

describe("isValidCliVersion", () => {
  it.each(["1.2.3", "1.2.3-beta.1", "1.2.3+build.5"])("accepts exact semver %s", (version) => {
    expect(isValidCliVersion(version)).toBe(true);
  });

  it.each(["latest", "1.2", "1.2.3/latest", "1.2.3 --ignore-scripts", "file:/tmp/pkg.tgz"])("rejects npm package spec %s", (version) => {
    expect(isValidCliVersion(version)).toBe(false);
  });
});

describe("fetchLatestVersion", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("parses npm registry response correctly", async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ version: "1.2.3" }),
    });
    const v = await fetchLatestVersion();
    expect(v).toBe("1.2.3");
  });

  it("returns null on network error", async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("network error"),
    );
    const v = await fetchLatestVersion();
    expect(v).toBeNull();
  });

  it("returns null on non-ok response", async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
    });
    const v = await fetchLatestVersion();
    expect(v).toBeNull();
  });

  it("returns null when npm returns a non-version package spec", async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ version: "latest" }),
    });
    const v = await fetchLatestVersion();
    expect(v).toBeNull();
  });
});

describe("runNpmUpdate", () => {
  beforeEach(() => {
    mocks.spawn.mockClear();
  });

  it("rejects unsafe version specs before spawning npm", async () => {
    const result = await runNpmUpdate("1.0.0 --ignore-scripts");

    expect(result.success).toBe(false);
    expect(result.output).toBe("invalid target version");
    expect(mocks.spawn).not.toHaveBeenCalled();
  });

  // Note: The runNpmUpdate tests that spawn npm are skipped because
  // mocking child_process.spawn with EventEmitter is unreliable in vitest.
  // These functions are tested manually or through integration tests.
});
