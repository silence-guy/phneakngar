import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("child_process", () => ({
  spawn: vi.fn(),
}));

import { spawn } from "child_process";
import { getCurrentVersion, fetchLatestVersion, isValidCliVersion, runNpmUpdate } from "./update";
import { EventEmitter } from "events";

const mockSpawn = vi.mocked(spawn);

describe("getCurrentVersion", () => {
  it("returns a version string", () => {
    const v = getCurrentVersion();
    expect(v).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("isValidCliVersion", () => {
  it.each(["1.2.3", "1.2.3-beta.1", "1.2.3+build.5"])("accepts exact semver %s", (version) => {
    expect(isValidCliVersion(version)).toBe(true);
  });

  it.each(["latest", "1.2", "1.2.3/latest", "1.2.3 --ignore-scripts", "file:/tmp/pkg.tgz"])("rejects npm package spec %s", (version) => {
    expect(isValidCliVersion(version)).toBe(false);
  });
});

describe("fetchLatestVersion", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
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
    mockSpawn.mockReset();
  });

  it("spawns npm install -g with correct args", async () => {
    const child = new EventEmitter() as any;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    mockSpawn.mockReturnValue(child);

    const promise = runNpmUpdate("1.0.0");
    child.stdout.emit("data", Buffer.from("added 1 package"));
    child.emit("close", 0);

    const result = await promise;
    expect(mockSpawn).toHaveBeenCalledWith(
      "npm",
      ["install", "-g", "@phneakngar/cli@1.0.0"],
      expect.objectContaining({ stdio: ["ignore", "pipe", "pipe"] }),
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain("added 1 package");
  });

  it("resolves with success: false on npm error", async () => {
    const child = new EventEmitter() as any;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    mockSpawn.mockReturnValue(child);

    const promise = runNpmUpdate("1.0.0");
    child.stderr.emit("data", Buffer.from("ERR! 404 Not Found"));
    child.emit("close", 1);

    const result = await promise;
    expect(result.success).toBe(false);
    expect(result.output).toContain("ERR! 404");
  });

  it("handles spawn error", async () => {
    const child = new EventEmitter() as any;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    mockSpawn.mockReturnValue(child);

    const promise = runNpmUpdate("1.0.0");
    child.emit("error", new Error("ENOENT"));

    const result = await promise;
    expect(result.success).toBe(false);
    expect(result.output).toContain("ENOENT");
  });

  it("rejects unsafe version specs before spawning npm", async () => {
    const result = await runNpmUpdate("1.0.0 --ignore-scripts");

    expect(result.success).toBe(false);
    expect(result.output).toBe("invalid target version");
    expect(mockSpawn).not.toHaveBeenCalled();
  });
});
