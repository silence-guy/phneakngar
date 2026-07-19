import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  checkNodeVersion,
  checkRegistration,
  checkAgentWorkdirScope,
  checkRuntimes,
  checkConfig,
  checkApprovalHoldEnv,
  runDoctor,
  type DoctorCheck,
} from "./doctor.js";

const originalProjectRoot = process.env.PHNEAKNGAR_PROJECT_ROOT;
const originalHealthPort = process.env.PHNEAKNGAR_HEALTH_PORT;

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "phneakngar-doctor-"));
  process.env.PHNEAKNGAR_PROJECT_ROOT = tempDir;
  delete process.env.PHNEAKNGAR_HEALTH_PORT;
});

afterEach(() => {
  if (originalProjectRoot === undefined) delete process.env.PHNEAKNGAR_PROJECT_ROOT;
  else process.env.PHNEAKNGAR_PROJECT_ROOT = originalProjectRoot;
  if (originalHealthPort === undefined) delete process.env.PHNEAKNGAR_HEALTH_PORT;
  else process.env.PHNEAKNGAR_HEALTH_PORT = originalHealthPort;
  rmSync(tempDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function writeConfig(payload: unknown): void {
  mkdirSync(tempDir, { recursive: true });
  writeFileSync(join(tempDir, "config.json"), JSON.stringify(payload, null, 2));
}

describe("checkNodeVersion", () => {
  it("passes for Node 20.19+", () => {
    expect(checkNodeVersion("20.19.0").status).toBe("pass");
    expect(checkNodeVersion("22.1.0").status).toBe("pass");
  });

  it("fails for older Node", () => {
    const result = checkNodeVersion("18.20.0");
    expect(result.status).toBe("fail");
    expect(result.hint).toMatch(/Install Node/);
  });
});

describe("checkConfig / checkRegistration", () => {
  it("warns when config is missing", () => {
    const result = checkConfig();
    expect(result.status).toBe("warn");
  });

  it("fails registration when watched_workspaces is empty", () => {
    writeConfig({ server_url: "https://example.com", watched_workspaces: [] });
    const result = checkRegistration();
    expect(result.status).toBe("fail");
    expect(result.detail).toMatch(/watched_workspaces empty|not registered/i);
    expect(result.detail).toMatch(/empty/i);
    expect(result.hint).toMatch(/register --token al_/);
    // Fail-closed: agents cannot reach this PC without a machine token
    expect(result.hint).toMatch(/workspace/i);
  });

  it("fails registration when config has no watched_workspaces key", () => {
    writeConfig({ server_url: "https://example.com" });
    const result = checkRegistration();
    expect(result.status).toBe("fail");
    expect(result.hint).toMatch(/register --token al_/);
  });

  it("fails registration when only deleted or tokenless entries exist", () => {
    writeConfig({
      server_url: "https://example.com",
      watched_workspaces: [
        { id: "ws1", name: "Gone", token: "al_old", status: "deleted" },
        { id: "ws2", name: "Empty", token: "", status: "active" },
      ],
    });
    const result = checkRegistration();
    expect(result.status).toBe("fail");
    expect(result.detail).toMatch(/no active|none usable|not registered/i);
    expect(result.hint).toMatch(/register --token al_/);
  });

  it("fails registration when no token", () => {
    writeConfig({ server_url: "https://example.com", watched_workspaces: [] });
    expect(checkRegistration().status).toBe("fail");
  });

  it("passes registration when token present", () => {
    writeConfig({
      server_url: "https://example.com",
      watched_workspaces: [
        { id: "ws1", name: "Acme", token: "al_testtoken", status: "active" },
      ],
    });
    const result = checkRegistration();
    expect(result.status).toBe("pass");
    expect(result.detail).toContain("Acme");
  });
});

describe("checkAgentWorkdirScope", () => {
  it("is info-only and documents workdir-only access (not whole PC)", () => {
    const result = checkAgentWorkdirScope();
    expect(result.status).toBe("info");
    expect(result.detail).toMatch(/workdir/i);
    expect(result.detail).toMatch(/workspaces/);
    expect(result.detail).toMatch(/not (the )?whole (PC|machine|filesystem)/i);
  });
});

describe("checkRuntimes", () => {
  it("returns pass or fail based on PATH detections", () => {
    const result = checkRuntimes();
    expect(["pass", "fail"]).toContain(result.status);
    expect(result.name).toBe("AI runtimes");
  });
});

describe("runDoctor", () => {
  it("returns fail exit when not registered (skip network)", async () => {
    writeConfig({ server_url: "https://example.com", watched_workspaces: [] });
    const result = await runDoctor(undefined, { skipNetwork: true });
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(1);
    const names = result.checks.map((c: DoctorCheck) => c.name);
    expect(names).toContain("Registration");
    expect(names).toContain("Chhlat");
    expect(names).toContain("Agent workdir scope");
    const reg = result.checks.find((c) => c.name === "Registration")!;
    expect(reg.status).toBe("fail");
    expect(reg.hint).toMatch(/register --token al_/);
    const scope = result.checks.find((c) => c.name === "Agent workdir scope")!;
    expect(scope.status).toBe("info");
  });

  it("passes registration when token present (skip network) and still includes workdir info", async () => {
    writeConfig({
      server_url: "https://example.com",
      watched_workspaces: [
        { id: "ws1", name: "Acme", token: "al_testtoken", status: "active" },
      ],
    });
    const result = await runDoctor(undefined, { skipNetwork: true });
    const reg = result.checks.find((c) => c.name === "Registration")!;
    expect(reg.status).toBe("pass");
    const scope = result.checks.find((c) => c.name === "Agent workdir scope")!;
    expect(scope.status).toBe("info");
    // Registration pass alone is not enough for overall ok if chhlat/runtimes fail —
    // but registration must not be a fail when token present.
    expect(result.checks.some((c) => c.name === "Registration" && c.status === "fail")).toBe(
      false,
    );
  });

  it("includes network checks when enabled", async () => {
    writeConfig({
      server_url: "https://example.com",
      watched_workspaces: [
        { id: "ws1", name: "Acme", token: "al_testtoken", status: "active" },
      ],
    });
    const fetchImpl = vi.fn(async () => new Response("ok", { status: 200 }));
    const result = await runDoctor(undefined, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result.checks.some((c) => c.name === "Server")).toBe(true);
    expect(result.checks.some((c) => c.name === "Chhlat health")).toBe(true);
  });

  it("includes approval hold env check", async () => {
    const result = await runDoctor(undefined, { skipNetwork: true });
    expect(result.checks.some((c) => c.name === "Approval hold")).toBe(true);
  });
});

describe("checkApprovalHoldEnv", () => {
  it("reports env force off", () => {
    const c = checkApprovalHoldEnv({ CHHLAT_APPROVAL_HOLD: "0" });
    expect(c.status).toBe("info");
    expect(c.detail).toMatch(/forces off/i);
  });

  it("reports env force on", () => {
    const c = checkApprovalHoldEnv({ PHNEAKNGAR_APPROVAL_HOLD: "true" });
    expect(c.status).toBe("info");
    expect(c.detail).toMatch(/forces on/i);
  });

  it("reports unset default on", () => {
    const c = checkApprovalHoldEnv({});
    expect(c.status).toBe("info");
    expect(c.detail).toMatch(/default on/i);
  });
});
