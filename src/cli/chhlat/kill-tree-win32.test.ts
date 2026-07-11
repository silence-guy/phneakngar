import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock execSync at module scope because Vitest hoists vi.mock calls before test suites.
const { execSyncMock } = vi.hoisted(() => ({ execSyncMock: vi.fn() }));
vi.mock("child_process", () => ({
  execSync: (...args: any[]) => execSyncMock(...args),
}));

// This test file tests Windows-specific kill-tree behavior.
// These tests only work reliably when running on Windows or with proper module mocking.
// Skip on non-Windows platforms where the module-level isPosix check won't match.
const isWindows = process.platform === "win32";

describe.skipIf(!isWindows)("killProcessTree (Windows)", () => {

  beforeEach(() => {
    execSyncMock.mockReset();
  });

  it("calls taskkill /PID <pid> /T /F on Windows", async () => {
    const { killProcessTree } = await import("./kill-tree.js");

    const killSpy = vi.spyOn(process, "kill").mockImplementation((_pid: number, signal?: string | number) => {
      if (signal === 0) return true; // isAlive → true
      return true;
    });

    await killProcessTree(9999);

    expect(execSyncMock).toHaveBeenCalledWith("taskkill /PID 9999 /T /F", { stdio: "ignore" });
    killSpy.mockRestore();
  });

  it("does not poll or escalate to SIGKILL on Windows", async () => {
    const { killProcessTree } = await import("./kill-tree.js");

    const killSpy = vi.spyOn(process, "kill").mockImplementation((_pid: number, signal?: string | number) => {
      if (signal === 0) return true;
      return true;
    });

    const start = Date.now();
    await killProcessTree(8888);
    const elapsed = Date.now() - start;

    // Should return immediately — no POLL_MS loop on Windows
    expect(elapsed).toBeLessThan(200);
    expect(execSyncMock).toHaveBeenCalledWith("taskkill /PID 8888 /T /F", { stdio: "ignore" });
    killSpy.mockRestore();
  });

  it("does not throw when taskkill fails (process already dead)", async () => {
    const { killProcessTree } = await import("./kill-tree.js");

    const killSpy = vi.spyOn(process, "kill").mockImplementation((_pid: number, signal?: string | number) => {
      if (signal === 0) return true;
      return true;
    });
    execSyncMock.mockImplementationOnce(() => { throw new Error("process not found"); });

    await expect(killProcessTree(7777)).resolves.toBeUndefined();
    killSpy.mockRestore();
  });

  it("skips if process is already dead (isAlive returns false)", async () => {
    const { killProcessTree } = await import("./kill-tree.js");

    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => {
      throw Object.assign(new Error("ESRCH"), { code: "ESRCH" });
    });
    execSyncMock.mockClear();

    await killProcessTree(6666);

    expect(execSyncMock).not.toHaveBeenCalled();
    killSpy.mockRestore();
  });
});
