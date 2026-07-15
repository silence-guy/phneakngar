import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { formatStatusReport } from "./status.js";

const originalProjectRoot = process.env.PHNEAKNGAR_PROJECT_ROOT;
let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "phneakngar-status-"));
  process.env.PHNEAKNGAR_PROJECT_ROOT = tempDir;
});

afterEach(() => {
  if (originalProjectRoot === undefined) delete process.env.PHNEAKNGAR_PROJECT_ROOT;
  else process.env.PHNEAKNGAR_PROJECT_ROOT = originalProjectRoot;
  rmSync(tempDir, { recursive: true, force: true });
});

describe("formatStatusReport", () => {
  it("reports not registered when config empty", () => {
    const lines = formatStatusReport();
    expect(lines.some((l) => l.includes("Not registered"))).toBe(true);
    expect(lines.some((l) => /register --token al_/.test(l))).toBe(true);
    expect(lines.some((l) => l.startsWith("CLI version:"))).toBe(true);
    expect(lines.some((l) => l.startsWith("Chhlat:"))).toBe(true);
    expect(lines.some((l) => l.startsWith("AI runtimes:"))).toBe(true);
  });

  it("reports empty watched_workspaces when present but empty", () => {
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(
      join(tempDir, "config.json"),
      JSON.stringify({ server_url: "https://example.com", watched_workspaces: [] }),
    );
    const lines = formatStatusReport();
    expect(lines.some((l) => /watched_workspaces empty/.test(l))).toBe(true);
    expect(lines.some((l) => /register --token al_/.test(l))).toBe(true);
  });

  it("reports registered workspace", () => {
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(
      join(tempDir, "config.json"),
      JSON.stringify({
        server_url: "https://example.com",
        watched_workspaces: [
          { id: "ws1", name: "Acme", token: "al_token", status: "active" },
        ],
      }),
    );
    const lines = formatStatusReport();
    expect(lines.some((l) => l.includes("Registered"))).toBe(true);
    expect(lines.some((l) => l.includes("Acme"))).toBe(true);
    expect(lines.some((l) => l.includes("https://example.com"))).toBe(true);
  });
});
