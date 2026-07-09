import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

const { mocks } = vi.hoisted(() => {
  const mocks = {
  execSync: vi.fn(),
  };
  return { mocks };
});

vi.mock("child_process", () => ({
  execSync: mocks.execSync,
}));

import { isCommandAvailable, detectRuntimes } from "./runtimes.js";

const originalPlatform = process.platform;

beforeEach(() => {
  mocks.execSync.mockClear();
  Object.defineProperty(process, "platform", { value: "linux" });
});

afterEach(() => {
  Object.defineProperty(process, "platform", { value: originalPlatform });
});

describe("isCommandAvailable", () => {
  it("returns true when command exists", () => {
    mocks.execSync.mockReturnValue("");
    expect(isCommandAvailable("claude")).toBe(true);
  });

  it("returns false when command does not exist", () => {
    mocks.execSync.mockImplementation(() => {
      throw new Error("not found");
    });
    expect(isCommandAvailable("nonexistent")).toBe(false);
  });

  it("uses 'which' on non-windows platforms", () => {
    mocks.execSync.mockReturnValue("");
    isCommandAvailable("claude");
    expect(mocks.execSync).toHaveBeenCalledWith("which claude", { stdio: "ignore" });
  });

  it("uses 'where' on windows", () => {
    Object.defineProperty(process, "platform", { value: "win32" });
    mocks.execSync.mockReturnValue("");
    isCommandAvailable("claude");
    expect(mocks.execSync).toHaveBeenCalledWith("where claude", { stdio: "ignore" });
  });
});

describe("detectRuntimes", () => {
  it("returns empty array when no runtimes found", () => {
    mocks.execSync.mockImplementation(() => {
      throw new Error("not found");
    });
    expect(detectRuntimes()).toEqual([]);
  });

  it("detects available runtimes with versions", () => {
    mocks.execSync.mockImplementation((cmd: string) => {
      if (cmd === "which claude") return "";
      if (cmd === "claude --version") return "1.0.0\n";
      if (cmd === "which codex") return "";
      if (cmd === "codex --version") return "2.0.0\n";
      if (cmd === "which opencode") return "";
      if (cmd === "opencode --version") return "3.0.0\n";
      throw new Error("not found");
    });

    const result = detectRuntimes();
    expect(result).toEqual([
      { type: "claude", version: "1.0.0" },
      { type: "codex", version: "2.0.0" },
      { type: "opencode", version: "3.0.0" },
    ]);
  });

  it("detects runtimes on windows using 'where'", () => {
    Object.defineProperty(process, "platform", { value: "win32" });
    mocks.execSync.mockImplementation((cmd: string) => {
      if (cmd === "where claude") return "";
      if (cmd === "claude --version") return "1.0.0\n";
      if (cmd === "where codex") return "";
      if (cmd === "codex --version") return "2.0.0\n";
      throw new Error("not found");
    });

    const result = detectRuntimes();
    expect(result).toEqual([
      { type: "claude", version: "1.0.0" },
      { type: "codex", version: "2.0.0" },
    ]);
  });

  it("includes runtime with empty version when --version fails", () => {
    mocks.execSync.mockImplementation((cmd: string) => {
      if (cmd === "which claude") return "";
      if (cmd === "claude --version") throw new Error("no version");
      throw new Error("not found");
    });

    const result = detectRuntimes();
    expect(result).toEqual([{ type: "claude", version: "" }]);
  });

  it("only checks claude, codex, opencode", () => {
    mocks.execSync.mockImplementation((cmd: string) => {
      if (cmd === "which claude") return "";
      if (cmd === "claude --version") return "1.0.0\n";
      throw new Error("not found");
    });

    const result = detectRuntimes();
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("claude");
  });
});
