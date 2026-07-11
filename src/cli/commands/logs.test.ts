import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { listLogFiles, readLastLines } from "./logs.js";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "phneakngar-logs-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("readLastLines", () => {
  it("returns empty when file missing", () => {
    expect(readLastLines(join(tempDir, "missing.log"), 10)).toEqual([]);
  });

  it("returns last N lines", () => {
    const file = join(tempDir, "a.log");
    writeFileSync(file, "one\ntwo\nthree\nfour\n");
    expect(readLastLines(file, 2)).toEqual(["three", "four"]);
  });
});

describe("listLogFiles", () => {
  it("returns empty for missing directory", () => {
    expect(listLogFiles(join(tempDir, "nope"))).toEqual([]);
  });

  it("lists only .log files newest first", async () => {
    const dir = join(tempDir, "logs");
    mkdirSync(dir);
    const older = join(dir, "2026-01-01.log");
    const newer = join(dir, "2026-01-02.log");
    writeFileSync(older, "old");
    await new Promise((r) => setTimeout(r, 20));
    writeFileSync(newer, "new");
    writeFileSync(join(dir, "notes.txt"), "ignore");
    const files = listLogFiles(dir);
    expect(files[0]).toBe(newer);
    expect(files).toContain(older);
    expect(files.some((f) => f.endsWith("notes.txt"))).toBe(false);
  });
});
