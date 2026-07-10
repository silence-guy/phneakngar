import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { execFileSync } from "child_process";

vi.mock("child_process", () => ({
  execFileSync: vi.fn(),
}));

vi.mock("./platform.js", () => ({
  isWindows: false,
}));

const mockedExecFileSync = vi.mocked(execFileSync);

describe("resolveLoginShellEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, SHELL: "/bin/zsh", PATH: "/usr/bin" };
    vi.resetModules();
    vi.doMock("./platform.js", () => ({ isWindows: false }));
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("calls the configured shell without command-string interpolation", async () => {
    mockedExecFileSync.mockReturnValue("PATH=/usr/bin:/new/path\nHOME=/Users/test\n");
    const { resolveLoginShellEnv } = await import("./shell-env.js");
    resolveLoginShellEnv();
    expect(mockedExecFileSync).toHaveBeenCalledWith(
      "/bin/zsh",
      ["-ilc", "env"],
      expect.objectContaining({ encoding: "utf-8", timeout: 5000 }),
    );
  });

  it("uses interactive mode so shell PATH additions are picked up", async () => {
    mockedExecFileSync.mockReturnValue(
      "HOME=/Users/test\nPATH=/usr/bin:/Users/test/.opencode/bin\nSHELL=/bin/zsh\n",
    );
    const { resolveLoginShellEnv } = await import("./shell-env.js");
    const env = resolveLoginShellEnv();
    expect(env.PATH).toContain("/Users/test/.opencode/bin");
  });

  it("falls back to process.env when shell execution fails", async () => {
    mockedExecFileSync.mockImplementation(() => {
      throw new Error("command failed");
    });
    const { resolveLoginShellEnv } = await import("./shell-env.js");
    const env = resolveLoginShellEnv();
    expect(env.PATH).toBe("/usr/bin");
  });

  it("falls back to process.env when output has no PATH", async () => {
    mockedExecFileSync.mockReturnValue("HOME=/Users/test\nUSER=test\n");
    const { resolveLoginShellEnv } = await import("./shell-env.js");
    const env = resolveLoginShellEnv();
    expect(env.PATH).toBe("/usr/bin");
  });

  it("parses multiline env output correctly", async () => {
    mockedExecFileSync.mockReturnValue(
      "HOME=/Users/gener\nPATH=/opt/homebrew/bin:/usr/bin\nSHELL=/bin/zsh\nLANG=en_US.UTF-8\n",
    );
    const { resolveLoginShellEnv } = await import("./shell-env.js");
    const env = resolveLoginShellEnv();
    expect(env.HOME).toBe("/Users/gener");
    expect(env.PATH).toBe("/opt/homebrew/bin:/usr/bin");
    expect(env.LANG).toBe("en_US.UTF-8");
  });

  it("uses default /bin/zsh when SHELL is not set", async () => {
    delete process.env.SHELL;
    mockedExecFileSync.mockReturnValue("PATH=/usr/bin\n");
    const { resolveLoginShellEnv } = await import("./shell-env.js");
    resolveLoginShellEnv();
    expect(mockedExecFileSync).toHaveBeenCalledWith(
      "/bin/zsh",
      ["-ilc", "env"],
      expect.anything(),
    );
  });

  it("passes a custom SHELL value as an executable path, not a command", async () => {
    process.env.SHELL = "/bin/bash";
    mockedExecFileSync.mockReturnValue("PATH=/usr/bin\n");
    const { resolveLoginShellEnv } = await import("./shell-env.js");
    resolveLoginShellEnv();
    expect(mockedExecFileSync).toHaveBeenCalledWith(
      "/bin/bash",
      ["-ilc", "env"],
      expect.anything(),
    );
  });
});

describe("resolveLoginShellEnv (windows)", () => {
  it("returns process.env copy on Windows", async () => {
    vi.resetModules();
    vi.doMock("./platform.js", () => ({ isWindows: true }));
    mockedExecFileSync.mockClear();
    const { resolveLoginShellEnv } = await import("./shell-env.js");
    const env = resolveLoginShellEnv();
    expect(env.PATH).toBe(process.env.PATH);
    expect(mockedExecFileSync).not.toHaveBeenCalled();
  });
});
