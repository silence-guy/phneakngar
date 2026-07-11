import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, readFileSync, unlinkSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// Use a temp directory for each test
let testDir: string;

vi.mock("./config.js", () => ({
  pidFilePath: (profile?: string) => {
    const name = profile ? `chhlat_${profile}.pid` : "chhlat.pid";
    return join(testDir, name);
  },
  pidFilePathPrimary: (profile?: string) => {
    const name = profile ? `chhlat_${profile}.pid` : "chhlat.pid";
    return join(testDir, name);
  },
}));

vi.mock("../lib/logger.js", () => {
  const mockLog = { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() };
  return { createLogger: () => mockLog, log: mockLog };
});

import { acquireChhlatPid, releaseChhlatPid, isProcessAlive, readChhlatPid } from "./pidfile.js";

describe("pidfile", () => {
  beforeEach(() => {
    testDir = join(tmpdir(), `pidfile-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up
    try {
      for (const name of ["chhlat.pid", "chhlat_dev.pid", "chhlat.pid", "chhlat_dev.pid"]) {
        try { unlinkSync(join(testDir, name)); } catch {}
      }
      unlinkSync(testDir);
    } catch {}
  });

  it("writes PID file and returns true on fresh acquire", () => {
    const result = acquireChhlatPid();
    expect(result).toBe(true);

    const content = readFileSync(join(testDir, "chhlat.pid"), "utf-8");
    expect(parseInt(content, 10)).toBe(process.pid);
  });

  it("returns false when PID file exists and process is alive", () => {
    // Write current process PID — it's alive
    writeFileSync(join(testDir, "chhlat.pid"), String(process.pid));

    const result = acquireChhlatPid();
    expect(result).toBe(false);
  });

  it("overwrites stale PID file when process is not running", () => {
    // PID 999999999 is almost certainly not running
    writeFileSync(join(testDir, "chhlat.pid"), "999999999");

    const result = acquireChhlatPid();
    expect(result).toBe(true);

    const content = readFileSync(join(testDir, "chhlat.pid"), "utf-8");
    expect(parseInt(content, 10)).toBe(process.pid);
  });

  it("release removes PID file", () => {
    writeFileSync(join(testDir, "chhlat.pid"), String(process.pid));
    expect(existsSync(join(testDir, "chhlat.pid"))).toBe(true);

    releaseChhlatPid();
    expect(existsSync(join(testDir, "chhlat.pid"))).toBe(false);
  });

  it("release is no-op if file does not exist", () => {
    // Should not throw
    expect(() => releaseChhlatPid()).not.toThrow();
  });

  it("release does not remove pidfile owned by a different process", () => {
    writeFileSync(join(testDir, "chhlat.pid"), "999999999");
    releaseChhlatPid();
    expect(existsSync(join(testDir, "chhlat.pid"))).toBe(true);
  });

  it("release removes pidfile when contents match own pid", () => {
    writeFileSync(join(testDir, "chhlat.pid"), String(process.pid));
    releaseChhlatPid();
    expect(existsSync(join(testDir, "chhlat.pid"))).toBe(false);
  });

  it("uses profile-specific PID file path", () => {
    const result = acquireChhlatPid("dev");
    expect(result).toBe(true);

    expect(existsSync(join(testDir, "chhlat_dev.pid"))).toBe(true);
  });
});

describe("isProcessAlive", () => {
  it("returns true for the current process", () => {
    expect(isProcessAlive(process.pid)).toBe(true);
  });

  it("returns false for a PID that does not exist", () => {
    expect(isProcessAlive(999999999)).toBe(false);
  });
});

describe("readChhlatPid", () => {
  beforeEach(() => {
    testDir = join(tmpdir(), `pidfile-read-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    try {
      for (const name of ["chhlat.pid", "chhlat_dev.pid", "chhlat.pid", "chhlat_dev.pid"]) {
        try { unlinkSync(join(testDir, name)); } catch {}
      }
      unlinkSync(testDir);
    } catch {}
  });

  it("returns null when pidfile is absent", () => {
    expect(readChhlatPid()).toBeNull();
  });

  it("returns integer when pidfile contains a number", () => {
    writeFileSync(join(testDir, "chhlat.pid"), "12345");
    expect(readChhlatPid()).toBe(12345);
  });

  it("trims whitespace before parsing", () => {
    writeFileSync(join(testDir, "chhlat.pid"), "  42  \n");
    expect(readChhlatPid()).toBe(42);
  });

  it("returns null when contents are unparsable", () => {
    writeFileSync(join(testDir, "chhlat.pid"), "not-a-number");
    expect(readChhlatPid()).toBeNull();
  });

  it("uses profile-specific path", () => {
    writeFileSync(join(testDir, "chhlat_dev.pid"), "7");
    expect(readChhlatPid("dev")).toBe(7);
    expect(readChhlatPid()).toBeNull();
  });
});
