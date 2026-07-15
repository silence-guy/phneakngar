import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockDetectRuntimes = vi.fn();
const mockLoadCLIConfigForProfile = vi.fn();
const mockSaveCLIConfigForProfile = vi.fn();
const mockReadChhlatPid = vi.fn();
const mockIsProcessAlive = vi.fn();

vi.mock("./runtimes.js", () => ({
  detectRuntimes: (...args: unknown[]) => mockDetectRuntimes(...args),
}));

vi.mock("./config.js", () => ({
  loadCLIConfigForProfile: (...args: unknown[]) => mockLoadCLIConfigForProfile(...args),
  saveCLIConfigForProfile: (...args: unknown[]) => mockSaveCLIConfigForProfile(...args),
}));

vi.mock("../chhlat/pidfile.js", () => ({
  readChhlatPid: (...args: unknown[]) => mockReadChhlatPid(...args),
  isProcessAlive: (...args: unknown[]) => mockIsProcessAlive(...args),
}));

vi.mock("./env.js", () => ({
  cmdPrefix: () => "phneakngar",
  isDev: () => false,
}));

vi.mock("child_process", () => ({
  spawn: vi.fn(() => ({ unref: vi.fn() })),
}));

import { activateAndSave, formatActivateFailure } from "./activate.js";

function errorBody(error: string): string {
  return JSON.stringify({ error });
}

describe("formatActivateFailure", () => {
  it("maps 404 token not found to server URL + fresh token hint", () => {
    const msg = formatActivateFailure(404, errorBody("token not found"));
    expect(msg).toContain("404");
    expect(msg).toMatch(/token not found/i);
    expect(msg).toMatch(/server URL|init --server|config/i);
    expect(msg).toMatch(/fresh token|UI/i);
  });

  it("maps 422 missing workspace to create workspace first", () => {
    const msg = formatActivateFailure(
      422,
      errorBody("token has no workspace_id — create workspace first"),
    );
    expect(msg).toContain("422");
    expect(msg).toMatch(/workspace/i);
    expect(msg).toMatch(/create|open/i);
  });

  it("maps 409 already claimed / other machine to create new token", () => {
    for (const err of [
      "token activation already claimed",
      "token already used by another machine",
      "token already used",
      "machine belongs to another user",
      "token activation could not be finalized",
    ]) {
      const msg = formatActivateFailure(409, errorBody(err));
      expect(msg).toContain("409");
      expect(msg).toMatch(/another machine|already used|new token/i);
      expect(msg).toMatch(/UI|new token/i);
    }
  });

  it("maps 503 temporarily unavailable to retry", () => {
    const msg = formatActivateFailure(
      503,
      errorBody("token activation temporarily unavailable"),
    );
    expect(msg).toContain("503");
    expect(msg).toMatch(/temporarily unavailable|retry/i);
  });

  it("maps 400 invalid body/payload with re-copy hint", () => {
    const msg = formatActivateFailure(400, errorBody("invalid payload"));
    expect(msg).toContain("400");
    expect(msg).toMatch(/invalid/i);
  });

  it("maps residual 401 to fresh token / server check", () => {
    const msg = formatActivateFailure(401, errorBody("invalid token"));
    expect(msg).toContain("401");
    expect(msg).toMatch(/token|server/i);
  });

  it("includes short body but never full al_ secrets", () => {
    const secret = "al_" + "x".repeat(64);
    const msg = formatActivateFailure(
      404,
      JSON.stringify({ error: "token not found", leaked: secret }),
    );
    expect(msg).not.toContain(secret);
    expect(msg).toMatch(/al_\*+|\[redacted\]/i);
  });

  it("still produces a useful message for non-JSON bodies", () => {
    const msg = formatActivateFailure(502, "Bad Gateway");
    expect(msg).toContain("502");
    expect(msg).toContain("Bad Gateway");
  });
});

describe("activateAndSave error paths", () => {
  let consoleErrSpy: ReturnType<typeof vi.spyOn>;
  let mockExit: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockExit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    mockDetectRuntimes.mockReturnValue([{ type: "claude", version: "1.0.0" }]);
    mockLoadCLIConfigForProfile.mockReturnValue({
      server_url: "http://localhost:3000",
      watched_workspaces: [],
    });
    mockReadChhlatPid.mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockActivateResponse(status: number, body: unknown) {
    globalThis.fetch = vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    })) as unknown as typeof fetch;
  }

  function errOutput(): string {
    return consoleErrSpy.mock.calls.map((c) => String(c[0])).join("\n");
  }

  it("keeps existing no-runtimes message", async () => {
    mockDetectRuntimes.mockReturnValue([]);
    await expect(
      activateAndSave({
        token: "al_testtoken",
        serverUrl: "http://localhost:3000",
      }),
    ).rejects.toThrow("process.exit(1)");
    expect(consoleErrSpy).toHaveBeenCalledWith(
      "Error: no runtimes found. Install claude, codex, opencode, or grok first.",
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("prints actionable hint and exits 1 on 404 activate failure", async () => {
    mockActivateResponse(404, { error: "token not found" });
    await expect(
      activateAndSave({
        token: "al_testtoken",
        serverUrl: "https://wrong.example",
      }),
    ).rejects.toThrow("process.exit(1)");

    expect(errOutput()).toContain("404");
    expect(errOutput()).toMatch(/server URL|init --server|fresh token/i);
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("prints actionable hint on 409 host/claim conflict", async () => {
    mockActivateResponse(409, { error: "token already used by another machine" });
    await expect(
      activateAndSave({
        token: "al_testtoken",
        serverUrl: "http://localhost:3000",
      }),
    ).rejects.toThrow("process.exit(1)");

    expect(errOutput()).toContain("409");
    expect(errOutput()).toMatch(/another machine|new token/i);
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("prints actionable hint on 422 no workspace", async () => {
    mockActivateResponse(422, {
      error: "token has no workspace_id — create workspace first",
    });
    await expect(
      activateAndSave({
        token: "al_testtoken",
        serverUrl: "http://localhost:3000",
      }),
    ).rejects.toThrow("process.exit(1)");

    expect(errOutput()).toContain("422");
    expect(errOutput()).toMatch(/workspace/i);
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("prints actionable hint on 503 temporary failure", async () => {
    mockActivateResponse(503, {
      error: "token activation temporarily unavailable",
    });
    await expect(
      activateAndSave({
        token: "al_testtoken",
        serverUrl: "http://localhost:3000",
      }),
    ).rejects.toThrow("process.exit(1)");

    expect(errOutput()).toContain("503");
    expect(errOutput()).toMatch(/retry|temporarily unavailable/i);
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
