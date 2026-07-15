import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockLoadCLIConfigForProfile = vi.fn();
const mockSaveCLIConfigForProfile = vi.fn();
const mockReadChhlatPid = vi.fn();
const mockIsProcessAlive = vi.fn();

vi.mock("../lib/config.js", () => ({
  loadCLIConfigForProfile: (...args: any[]) => mockLoadCLIConfigForProfile(...args),
  saveCLIConfigForProfile: (...args: any[]) => mockSaveCLIConfigForProfile(...args),
}));

vi.mock("../chhlat/pidfile.js", () => ({
  readChhlatPid: (...args: any[]) => mockReadChhlatPid(...args),
  isProcessAlive: (...args: any[]) => mockIsProcessAlive(...args),
}));

vi.mock("../lib/env.js", () => ({
  cmdPrefix: () => "phneakngar",
  isDev: () => false,
}));

vi.mock("../lib/runtimes.js", () => ({
  isCommandAvailable: vi.fn(() => true),
  detectRuntimes: vi.fn(() => [{ type: "claude", version: "4.0.0" }]),
}));

vi.mock("child_process", () => ({
  execSync: vi.fn((cmd: string) => {
    if (cmd.includes("which claude")) return "/usr/bin/claude";
    if (cmd.includes("claude --version")) return "4.0.0";
    throw new Error("not found");
  }),
  spawn: vi.fn(() => ({ unref: vi.fn() })),
}));

import { registerCommand } from "./register";

describe("phneakngar register", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrSpy: ReturnType<typeof vi.spyOn>;
  let mockExit: ReturnType<typeof vi.spyOn>;
  let mockKill: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockExit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    mockKill = vi.spyOn(process, "kill").mockImplementation(() => true);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrSpy.mockRestore();
    mockExit.mockRestore();
    mockKill.mockRestore();
  });

  function mockFetch(responses: Record<string, { status: number; body: unknown }>) {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      for (const [pattern, resp] of Object.entries(responses)) {
        if (urlStr.includes(pattern)) {
          return {
            ok: resp.status >= 200 && resp.status < 300,
            status: resp.status,
            json: async () => resp.body,
            text: async (): Promise<string> => JSON.stringify(resp.body),
          };
        }
      }
      return { ok: false, status: 404, text: async (): Promise<string> => "not found" };
    });
    globalThis.fetch = fetchMock;
    return fetchMock;
  }

  const activateResponse = {
    chhlat_id: "host1",
    workspace_id: "ws_1",
    runtimes: [{ id: "rt_1", provider: "claude" }],
  };

  it("activates pending machine token that fails pre-activate GET /api/me", async () => {
    // Mirrors real server: pending al_* is 401 on /api/me until activate promotes it.
    mockLoadCLIConfigForProfile.mockReturnValue({
      server_url: "http://localhost:3000",
      watched_workspaces: [],
    });
    mockReadChhlatPid.mockReturnValue(null);

    let activated = false;
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      if (urlStr.includes("/api/machine-tokens/activate")) {
        activated = true;
        return {
          ok: true,
          status: 200,
          json: async () => activateResponse,
          text: async () => JSON.stringify(activateResponse),
        };
      }
      if (urlStr.includes("/api/me")) {
        if (!activated) {
          return {
            ok: false,
            status: 401,
            json: async () => ({ error: "invalid token" }),
            text: async () => JSON.stringify({ error: "invalid token" }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: "u1", email: "pending@test.com" }),
          text: async () => JSON.stringify({ id: "u1", email: "pending@test.com" }),
        };
      }
      if (urlStr.includes("/api/workspaces")) {
        return {
          ok: true,
          status: 200,
          json: async () => [{ id: "ws_1", name: "Personal" }],
          text: async () => JSON.stringify([{ id: "ws_1", name: "Personal" }]),
        };
      }
      if (urlStr.includes("/api/agents")) {
        return {
          ok: true,
          status: 200,
          json: async () => [],
          text: async () => "[]",
        };
      }
      return {
        ok: false,
        status: 404,
        text: async () => "not found",
        json: async () => ({}),
      };
    });
    globalThis.fetch = fetchMock;

    const cmd = registerCommand();
    await cmd.parseAsync([
      "node",
      "register",
      "--token",
      "al_pendingtoken123",
      "--server",
      "http://localhost:3000",
    ]);

    const fetchPaths = fetchMock.mock.calls.map(([url]) => String(url));
    const activateIdx = fetchPaths.findIndex((url) =>
      url.includes("/api/machine-tokens/activate"),
    );
    const meIdx = fetchPaths.findIndex((url) => url.includes("/api/me"));

    expect(activateIdx).toBeGreaterThanOrEqual(0);
    // Activate must run; /api/me may come after (or not at all). Old code called /api/me first and exited 1.
    if (meIdx >= 0) {
      expect(activateIdx).toBeLessThan(meIdx);
    }
    expect(mockExit).not.toHaveBeenCalledWith(1);
    expect(mockSaveCLIConfigForProfile).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        server_url: "http://localhost:3000",
        watched_workspaces: [
          {
            id: "ws_1",
            name: "Personal",
            token: "al_pendingtoken123",
            status: "active",
            agent_ids: [],
          },
        ],
      }),
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Workspace: Personal (ws_1)"),
    );
    // After activate, /api/me can resolve email for display
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Registered as pending@test.com"),
    );
  });

  it("activates token and saves workspace to config", async () => {
    mockLoadCLIConfigForProfile.mockReturnValue({
      server_url: "http://localhost:3000",
      watched_workspaces: [],
    });
    mockReadChhlatPid.mockReturnValue(null);

    const fetchMock = mockFetch({
      "/api/me": { status: 200, body: { id: "u1", email: "test@test.com" } },
      "/api/machine-tokens/activate": { status: 200, body: activateResponse },
      "/api/workspaces": { status: 200, body: [{ id: "ws_1", name: "Personal" }] },
      "/api/agents": { status: 200, body: [] },
    });

    const cmd = registerCommand();
    await cmd.parseAsync(["node", "register", "--token", "al_testtoken123", "--server", "http://localhost:3000"]);
    const fetchPaths = fetchMock.mock.calls.map(([url]) => String(url));
    const meIdx = fetchPaths.findIndex((url) => url.includes("/api/me"));
    const activateIdx = fetchPaths.findIndex((url) =>
      url.includes("/api/machine-tokens/activate"),
    );
    // Activate first; optional /api/me only after activate (for display email)
    expect(activateIdx).toBeGreaterThanOrEqual(0);
    if (meIdx >= 0) {
      expect(activateIdx).toBeLessThan(meIdx);
    }

    expect(mockSaveCLIConfigForProfile).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        server_url: "http://localhost:3000",
        watched_workspaces: [
          { id: "ws_1", name: "Personal", token: "al_testtoken123", status: "active", agent_ids: [] },
        ],
      }),
    );
  });

  it("still succeeds when post-activate GET /api/me fails", async () => {
    mockLoadCLIConfigForProfile.mockReturnValue({
      server_url: "http://localhost:3000",
      watched_workspaces: [],
    });
    mockReadChhlatPid.mockReturnValue(null);

    const fetchMock = mockFetch({
      "/api/me": { status: 500, body: { error: "server error" } },
      "/api/machine-tokens/activate": { status: 200, body: activateResponse },
      "/api/workspaces": { status: 200, body: [{ id: "ws_1", name: "Personal" }] },
      "/api/agents": { status: 200, body: [] },
    });

    const cmd = registerCommand();
    await cmd.parseAsync([
      "node",
      "register",
      "--token",
      "al_postme_fail",
      "--server",
      "http://localhost:3000",
    ]);

    expect(mockExit).not.toHaveBeenCalledWith(1);
    expect(mockSaveCLIConfigForProfile).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Workspace: Personal (ws_1)"),
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Runtimes:"),
    );
    // Must not print Registered as when /api/me failed
    const registeredLogs = consoleSpy.mock.calls
      .map((c) => String(c[0]))
      .filter((s) => s.includes("Registered as"));
    expect(registeredLogs).toHaveLength(0);

    const fetchPaths = fetchMock.mock.calls.map(([url]) => String(url));
    expect(fetchPaths.some((url) => url.includes("/api/machine-tokens/activate"))).toBe(true);
  });

  it("rejects non-al_ token before any network call", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    const cmd = registerCommand();
    await cmd.parseAsync([
      "node",
      "register",
      "--token",
      "sk_notamachinetoken",
      "--server",
      "http://localhost:3000",
    ]);

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(consoleErrSpy).toHaveBeenCalledWith(
      expect.stringContaining("must start with 'al_'"),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockSaveCLIConfigForProfile).not.toHaveBeenCalled();
  });

  it("preserves existing watched_workspaces and updates matching entry", async () => {
    mockLoadCLIConfigForProfile.mockReturnValue({
      server_url: "http://localhost:3000",
      watched_workspaces: [
        { id: "ws_1", name: "Existing", token: "al_old", status: "active", agent_ids: ["ag_1"] },
      ],
    });
    mockReadChhlatPid.mockReturnValue(null);

    mockFetch({
      "/api/me": { status: 200, body: { id: "u1", email: "test@test.com" } },
      "/api/machine-tokens/activate": { status: 200, body: activateResponse },
      "/api/workspaces": { status: 200, body: [{ id: "ws_1", name: "Personal" }] },
      "/api/agents": { status: 200, body: [{ id: "ag_1" }] },
    });

    const cmd = registerCommand();
    await cmd.parseAsync(["node", "register", "--token", "al_newtoken", "--server", "http://localhost:3000"]);

    expect(mockSaveCLIConfigForProfile).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        watched_workspaces: [
          { id: "ws_1", name: "Personal", token: "al_newtoken", status: "active", agent_ids: ["ag_1"] },
        ],
      }),
    );
  });

  it("sends SIGHUP when chhlat is running", async () => {
    mockLoadCLIConfigForProfile.mockReturnValue({
      server_url: "http://localhost:3000",
      watched_workspaces: [],
    });
    mockReadChhlatPid.mockReturnValue(12345);
    mockIsProcessAlive.mockReturnValue(true);

    mockFetch({
      "/api/me": { status: 200, body: { id: "u1", email: "test@test.com" } },
      "/api/machine-tokens/activate": { status: 200, body: activateResponse },
      "/api/workspaces": { status: 200, body: [{ id: "ws_1", name: "Personal" }] },
      "/api/agents": { status: 200, body: [] },
    });

    const cmd = registerCommand();
    await cmd.parseAsync(["node", "register", "--token", "al_test", "--server", "http://localhost:3000"]);

    expect(mockKill).toHaveBeenCalledWith(12345, "SIGHUP");
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Chhlat (pid 12345) notified"));
  });

  it("auto-starts chhlat when not running", async () => {
    mockLoadCLIConfigForProfile.mockReturnValue({
      server_url: "http://localhost:3000",
      watched_workspaces: [],
    });
    mockReadChhlatPid.mockReturnValue(null);

    mockFetch({
      "/api/me": { status: 200, body: { id: "u1", email: "test@test.com" } },
      "/api/machine-tokens/activate": { status: 200, body: activateResponse },
      "/api/workspaces": { status: 200, body: [{ id: "ws_1", name: "Personal" }] },
      "/api/agents": { status: 200, body: [] },
    });

    const cmd = registerCommand();
    await cmd.parseAsync(["node", "register", "--token", "al_test", "--server", "http://localhost:3000"]);

    expect(mockKill).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Starting chhlat"));
  });
});
