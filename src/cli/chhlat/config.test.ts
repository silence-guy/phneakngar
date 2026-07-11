import { vi, describe, it, expect, afterEach } from "vitest";
import { join } from "path";
import { homedir, hostname } from "os";

// Mock os module for Bun test compatibility
vi.mock("os", () => ({
  homedir: () => "/home/testuser",
  hostname: () => "test-host",
  tmpdir: () => "/tmp",
  platform: "linux",
  arch: () => "x64",
}));

import { loadChhlatConfig, normalizeServerBaseURL, chhlatLogFilePath, chhlatLogDir, sessionRunnerLogDir } from "./config.js";

const CHHLAT_ENV_KEYS = [
  "PHNEAKNGAR_SERVER_URL",
  "PHNEAKNGAR_PROJECT_ROOT",
  "PHNEAKNGAR_CHHLAT_POLL_INTERVAL",
  "PHNEAKNGAR_AGENT_TIMEOUT",
  "PHNEAKNGAR_CHHLAT_MAX_CONCURRENT_TASKS",
  "PHNEAKNGAR_CLAUDE_PATH",
  "PHNEAKNGAR_CHHLAT_ID",
  "PHNEAKNGAR_WORKSPACES_ROOT",
  "PHNEAKNGAR_CHHLAT_DEVICE_NAME",
  "PHNEAKNGAR_KEEP_ENV_AFTER_TASK",
  "PHNEAKNGAR_CODEX_PATH",
  "PHNEAKNGAR_OPENCODE_PATH",
  "PHNEAKNGAR_GROK_PATH",
  "PHNEAKNGAR_CLAUDE_MODEL",
  "PHNEAKNGAR_CODEX_MODEL",
  "PHNEAKNGAR_OPENCODE_MODEL",
  "PHNEAKNGAR_GROK_MODEL",
  "PHNEAKNGAR_MESSAGE_INACTIVITY_TIMEOUT",
];

afterEach(() => {
  for (const key of CHHLAT_ENV_KEYS) {
    delete process.env[key];
  }
});

describe("loadChhlatConfig defaults", () => {
  it("returns correct defaults when no env vars set", () => {
    const cfg = loadChhlatConfig();

    expect(cfg.serverURL).toBe("https://phneakngar-web.thatsilenceguy.workers.dev");
    expect(cfg.pollInterval).toBe(3000);
    expect(cfg.agentTimeout).toBe(43200000);
    expect(cfg.maxConcurrentTasks).toBe(20);
    expect(cfg.claudePath).toBe("claude");
    expect(cfg.grokPath).toBe("grok");
    expect(cfg.grokModel).toBe("");
    expect(cfg.messageInactivityTimeout).toBe(1200000);
  });

  it("PHNEAKNGAR_GROK_PATH and PHNEAKNGAR_GROK_MODEL override defaults", () => {
    process.env.PHNEAKNGAR_GROK_PATH = "/opt/grok";
    process.env.PHNEAKNGAR_GROK_MODEL = "grok-4.5";
    const cfg = loadChhlatConfig();
    expect(cfg.grokPath).toBe("/opt/grok");
    expect(cfg.grokModel).toBe("grok-4.5");
  });
});

describe("loadChhlatConfig env overrides", () => {
  it("PHNEAKNGAR_SERVER_URL overrides serverURL", () => {
    process.env.PHNEAKNGAR_SERVER_URL = "http://remote:9090";
    expect(loadChhlatConfig().serverURL).toBe("http://remote:9090");
  });

  it("PHNEAKNGAR_CHHLAT_POLL_INTERVAL='5s' → 5000", () => {
    process.env.PHNEAKNGAR_CHHLAT_POLL_INTERVAL = "5s";
    expect(loadChhlatConfig().pollInterval).toBe(5000);
  });

  it("PHNEAKNGAR_CHHLAT_MAX_CONCURRENT_TASKS='10' → 10", () => {
    process.env.PHNEAKNGAR_CHHLAT_MAX_CONCURRENT_TASKS = "10";
    expect(loadChhlatConfig().maxConcurrentTasks).toBe(10);
  });

  it("PHNEAKNGAR_MESSAGE_INACTIVITY_TIMEOUT='10m' → 600000", () => {
    process.env.PHNEAKNGAR_MESSAGE_INACTIVITY_TIMEOUT = "10m";
    expect(loadChhlatConfig().messageInactivityTimeout).toBe(600000);
  });
});

describe("normalizeServerBaseURL", () => {
  it("converts ws:// to http://", () => {
    expect(normalizeServerBaseURL("ws://localhost:8080")).toBe(
      "http://localhost:8080",
    );
  });

  it("converts wss:// to https://", () => {
    expect(normalizeServerBaseURL("wss://example.com")).toBe(
      "https://example.com",
    );
  });

  it("strips /ws suffix", () => {
    expect(normalizeServerBaseURL("http://example.com/ws")).toBe(
      "http://example.com",
    );
  });

  it("leaves http:// unchanged", () => {
    expect(normalizeServerBaseURL("http://example.com")).toBe(
      "http://example.com",
    );
  });
});

describe("chhlatId profile suffix", () => {
  it("uses hostname when no profile", () => {
    const cfg = loadChhlatConfig();
    expect(cfg.chhlatId).toBe(hostname());
  });

  it("appends -profile to hostname with profile", () => {
    const cfg = loadChhlatConfig("staging");
    expect(cfg.chhlatId).toBe(`${hostname()}-staging`);
  });

  it("doesn't double-append when PHNEAKNGAR_CHHLAT_ID already has suffix", () => {
    process.env.PHNEAKNGAR_CHHLAT_ID = `myhost-staging`;
    const cfg = loadChhlatConfig("staging");
    expect(cfg.chhlatId).toBe("myhost-staging");
  });
});

describe("chhlatLogFilePath", () => {
  it("returns <configDir>/chhlat/logs/YYYY-MM-DD.log for a fixed date", () => {
    const d = new Date(2026, 3, 17); // 2026-04-17 local
    const p = chhlatLogFilePath(d);
    expect(p).toBe(join(homedir(), ".phneakngar", "chhlat", "logs", "2026-04-17.log"));
  });

  it("zero-pads month and day", () => {
    const d = new Date(2026, 0, 5); // 2026-01-05 local
    expect(chhlatLogFilePath(d).endsWith("2026-01-05.log")).toBe(true);
  });
});

describe("chhlatLogDir — three PHNEAKNGAR_PROJECT_ROOT scenarios", () => {
  it("production: ~/.phneakngar/chhlat/logs", () => {
    delete process.env.PHNEAKNGAR_PROJECT_ROOT;
    expect(chhlatLogDir()).toBe(join(homedir(), ".phneakngar", "chhlat", "logs"));
  });

  it("dev mode: <PROJECT>/.phneakngar/chhlat/logs", () => {
    process.env.PHNEAKNGAR_PROJECT_ROOT = "/tmp/my-project/.phneakngar";
    expect(chhlatLogDir()).toBe(join("/tmp/my-project/.phneakngar", "chhlat", "logs"));
  });

  it("app mode: ~/.phneakngar/self-hosted/chhlat/logs", () => {
    process.env.PHNEAKNGAR_PROJECT_ROOT = join(homedir(), ".phneakngar", "self-hosted");
    expect(chhlatLogDir()).toBe(join(homedir(), ".phneakngar", "self-hosted", "chhlat", "logs"));
  });
});

describe("workspacesRoot — three PHNEAKNGAR_PROJECT_ROOT scenarios", () => {
  it("production: ~/.phneakngar/workspaces", () => {
    delete process.env.PHNEAKNGAR_PROJECT_ROOT;
    const cfg = loadChhlatConfig();
    expect(cfg.workspacesRoot).toBe(join(homedir(), ".phneakngar", "workspaces"));
  });

  it("production + profile: ~/.phneakngar/workspaces_{profile}", () => {
    delete process.env.PHNEAKNGAR_PROJECT_ROOT;
    const cfg = loadChhlatConfig("dev");
    expect(cfg.workspacesRoot).toBe(
      join(homedir(), ".phneakngar", "workspaces_dev"),
    );
  });

  it("dev mode: <PROJECT>/.phneakngar/workspaces", () => {
    process.env.PHNEAKNGAR_PROJECT_ROOT = "/tmp/my-project/.phneakngar";
    const cfg = loadChhlatConfig();
    expect(cfg.workspacesRoot).toBe(
      join("/tmp/my-project/.phneakngar", "workspaces"),
    );
  });

  it("dev mode + profile: <PROJECT>/.phneakngar/workspaces_{profile}", () => {
    process.env.PHNEAKNGAR_PROJECT_ROOT = "/tmp/my-project/.phneakngar";
    const cfg = loadChhlatConfig("staging");
    expect(cfg.workspacesRoot).toBe(
      join("/tmp/my-project/.phneakngar", "workspaces_staging"),
    );
  });

  it("app mode: ~/.phneakngar/self-hosted/workspaces", () => {
    process.env.PHNEAKNGAR_PROJECT_ROOT = join(homedir(), ".phneakngar", "self-hosted");
    const cfg = loadChhlatConfig();
    expect(cfg.workspacesRoot).toBe(
      join(homedir(), ".phneakngar", "self-hosted", "workspaces"),
    );
  });

  it("PHNEAKNGAR_WORKSPACES_ROOT overrides all defaults", () => {
    process.env.PHNEAKNGAR_PROJECT_ROOT = "/tmp/my-project/.phneakngar";
    process.env.PHNEAKNGAR_WORKSPACES_ROOT = "/custom/path";
    const cfg = loadChhlatConfig();
    expect(cfg.workspacesRoot).toBe("/custom/path");
  });
});

describe("sessionRunnerLogDir — three PHNEAKNGAR_PROJECT_ROOT scenarios", () => {
  it("production: ~/.phneakngar/chhlat/session-runners", () => {
    delete process.env.PHNEAKNGAR_PROJECT_ROOT;
    expect(sessionRunnerLogDir()).toBe(
      join(homedir(), ".phneakngar", "chhlat", "session-runners"),
    );
  });

  it("dev mode: <PROJECT>/.phneakngar/chhlat/session-runners", () => {
    process.env.PHNEAKNGAR_PROJECT_ROOT = "/tmp/my-project/.phneakngar";
    expect(sessionRunnerLogDir()).toBe(
      join("/tmp/my-project/.phneakngar", "chhlat", "session-runners"),
    );
  });

  it("app mode: ~/.phneakngar/self-hosted/chhlat/session-runners", () => {
    process.env.PHNEAKNGAR_PROJECT_ROOT = join(homedir(), ".phneakngar", "self-hosted");
    expect(sessionRunnerLogDir()).toBe(
      join(homedir(), ".phneakngar", "self-hosted", "chhlat", "session-runners"),
    );
  });
});
