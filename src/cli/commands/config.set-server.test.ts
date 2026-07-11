import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { setServerUrl } from "./config.js";
import { configPath } from "../lib/config.js";

const originalProjectRoot = process.env.PHNEAKNGAR_PROJECT_ROOT;
let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "phneakngar-config-"));
  process.env.PHNEAKNGAR_PROJECT_ROOT = tempDir;
});

afterEach(() => {
  if (originalProjectRoot === undefined) delete process.env.PHNEAKNGAR_PROJECT_ROOT;
  else process.env.PHNEAKNGAR_PROJECT_ROOT = originalProjectRoot;
  rmSync(tempDir, { recursive: true, force: true });
});

describe("setServerUrl", () => {
  it("persists normalized URL", () => {
    const saved = setServerUrl("https://example.com/");
    expect(saved).toBe("https://example.com");
    const raw = JSON.parse(readFileSync(configPath(), "utf-8"));
    expect(raw.server_url).toBe("https://example.com");
  });

  it("rejects invalid URL", () => {
    expect(() => setServerUrl("ftp://bad")).toThrow(/invalid server URL/);
  });
});
