import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  checkNodeVersion,
  checkRegistration,
  checkRuntimes,
  checkConfig,
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
});
