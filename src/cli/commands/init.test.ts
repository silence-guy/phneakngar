import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { initConfig } from "./init.js";

const originalProjectRoot = process.env.PHNEAKNGAR_PROJECT_ROOT;
const originalServerUrl = process.env.PHNEAKNGAR_SERVER_URL;

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "phneakngar-init-"));
  process.env.PHNEAKNGAR_PROJECT_ROOT = tempDir;
  delete process.env.PHNEAKNGAR_SERVER_URL;
});

afterEach(() => {
  if (originalProjectRoot === undefined) delete process.env.PHNEAKNGAR_PROJECT_ROOT;
  else process.env.PHNEAKNGAR_PROJECT_ROOT = originalProjectRoot;
  if (originalServerUrl === undefined) delete process.env.PHNEAKNGAR_SERVER_URL;
  else process.env.PHNEAKNGAR_SERVER_URL = originalServerUrl;
  rmSync(tempDir, { recursive: true, force: true });
});

describe("initConfig", () => {
  it("creates config with default production server", () => {
    const result = initConfig({});
    expect(result.created).toBe(true);
    expect(existsSync(result.configPath)).toBe(true);
    expect(result.serverUrl).toBe("https://phneakngar-web.thatsilenceguy.workers.dev");
    const raw = JSON.parse(readFileSync(result.configPath, "utf-8"));
    expect(raw.server_url).toBe("https://phneakngar-web.thatsilenceguy.workers.dev");
  });

  it("writes provided server URL", () => {
    const result = initConfig({ server: "http://localhost:15210/" });
    expect(result.serverUrl).toBe("http://localhost:15210");
  });

  it("rejects invalid server URL", () => {
    expect(() => initConfig({ server: "not-a-url" })).toThrow(/invalid server URL/);
  });

  it("does not overwrite server without force", () => {
    initConfig({ server: "https://a.example" });
    const second = initConfig({ server: "https://b.example" });
    expect(second.updated).toBe(false);
    expect(second.serverUrl).toBe("https://a.example");
  });

  it("overwrites server with force", () => {
    initConfig({ server: "https://a.example" });
    const second = initConfig({ server: "https://b.example", force: true });
    expect(second.updated).toBe(true);
    expect(second.serverUrl).toBe("https://b.example");
  });
});
