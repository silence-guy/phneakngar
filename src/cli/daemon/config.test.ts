import { vi, describe, it, expect, afterEach } from "vitest";
import { hostname } from "os";
import { join } from "path";
import { homedir } from "os";
import { loadDaemonConfig, normalizeServerBaseURL, daemonLogFilePath, daemonLogDir, sessionRunnerLogDir } from "./config.js";

const DAEMON_ENV_KEYS = [
  "PHNEAKNGAR_SERVER_URL",
  "PHNEAKNGAR_PROJECT_ROOT",
  "PHNEAKNGAR_DAEMON_POLL_INTERVAL",
  "PHNEAKNGAR_AGENT_TIMEOUT",
  "PHNEAKNGAR_DAEMON_MAX_CONCURRENT_TASKS",
  "PHNEAKNGAR_CLAUDE_PATH",
  "PHNEAKNGAR_DAEMON_ID",
  "PHNEAKNGAR_WORKSPACES_ROOT",
  "PHNEAKNGAR_DAEMON_DEVICE_NAME",
  "PHNEAKNGAR_KEEP_ENV_AFTER_TASK",
  "PHNEAKNGAR_CODEX_PATH",
  "PHNEAKNGAR_OPENCODE_PATH",
  "PHNEAKNGAR_CLAUDE_MODEL",
  "PHNEAKNGAR_CODEX_MODEL",
  "PHNEAKNGAR_OPENCODE_MODEL",
  "PHNEAKNGAR_MESSAGE_INACTIVITY_TIMEOUT",
];

afterEach(() => {
  for (const key of DAEMON_ENV_KEYS) {
    delete process.env[key];
  }
});

describe("loadDaemonConfig defaults", () => {
  it("returns correct defaults when no env vars set", () => {
    const cfg = loadDaemonConfig();

    expect(cfg.serverURL).toBe("https://phneakngar.ai");
    expect(cfg.pollInterval).toBe(3000);
    expect(cfg.agentTimeout).toBe(43200000);
    expect(cfg.maxConcurrentTasks).toBe(20);
    expect(cfg.claudePath).toBe("claude");
    expect(cfg.messageInactivityTimeout).toBe(1200000);
  });
});

describe("loadDaemonConfig env overrides", () => {
  it("PHNEAKNGAR_SERVER_URL overrides serverURL", () => {
    process.env.PHNEAKNGAR_SERVER_URL = "http://remote:9090";
    expect(loadDaemonConfig().serverURL).toBe("http://remote:9090");
  });

  it("PHNEAKNGAR_DAEMON_POLL_INTERVAL='5s' → 5000", () => {
    process.env.PHNEAKNGAR_DAEMON_POLL_INTERVAL = "5s";
    expect(loadDaemonConfig().pollInterval).toBe(5000);
  });

  it("PHNEAKNGAR_DAEMON_MAX_CONCURRENT_TASKS='10' → 10", () => {
    process.env.PHNEAKNGAR_DAEMON_MAX_CONCURRENT_TASKS = "10";
    expect(loadDaemonConfig().maxConcurrentTasks).toBe(10);
  });

  it("PHNEAKNGAR_MESSAGE_INACTIVITY_TIMEOUT='10m' → 600000", () => {
    process.env.PHNEAKNGAR_MESSAGE_INACTIVITY_TIMEOUT = "10m";
    expect(loadDaemonConfig().messageInactivityTimeout).toBe(600000);
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

describe("daemonId profile suffix", () => {
  it("uses hostname when no profile", () => {
    const cfg = loadDaemonConfig();
    expect(cfg.daemonId).toBe(hostname());
  });

  it("appends -profile to hostname with profile", () => {
    const cfg = loadDaemonConfig("staging");
    expect(cfg.daemonId).toBe(`${hostname()}-staging`);
  });

  it("doesn't double-append when PHNEAKNGAR_DAEMON_ID already has suffix", () => {
    process.env.PHNEAKNGAR_DAEMON_ID = `myhost-staging`;
    const cfg = loadDaemonConfig("staging");
    expect(cfg.daemonId).toBe("myhost-staging");
  });
});

describe("daemonLogFilePath", () => {
  it("returns <configDir>/daemon/logs/YYYY-MM-DD.log for a fixed date", () => {
    const d = new Date(2026, 3, 17); // 2026-04-17 local
    const p = daemonLogFilePath(d);
    expect(p).toBe(join(homedir(), ".phneakngar", "daemon", "logs", "2026-04-17.log"));
  });

  it("zero-pads month and day", () => {
    const d = new Date(2026, 0, 5); // 2026-01-05 local
    expect(daemonLogFilePath(d).endsWith("2026-01-05.log")).toBe(true);
  });
});

describe("daemonLogDir — three PHNEAKNGAR_PROJECT_ROOT scenarios", () => {
  it("production: ~/.phneakngar/daemon/logs", () => {
    delete process.env.PHNEAKNGAR_PROJECT_ROOT;
    expect(daemonLogDir()).toBe(join(homedir(), ".phneakngar", "daemon", "logs"));
  });

  it("dev mode: <PROJECT>/.phneakngar/daemon/logs", () => {
    process.env.PHNEAKNGAR_PROJECT_ROOT = "/tmp/my-project/.phneakngar";
    expect(daemonLogDir()).toBe(join("/tmp/my-project/.phneakngar", "daemon", "logs"));
  });

  it("app mode: ~/.phneakngar/self-hosted/daemon/logs", () => {
    process.env.PHNEAKNGAR_PROJECT_ROOT = join(homedir(), ".phneakngar", "self-hosted");
    expect(daemonLogDir()).toBe(join(homedir(), ".phneakngar", "self-hosted", "daemon", "logs"));
  });
});

describe("workspacesRoot — three PHNEAKNGAR_PROJECT_ROOT scenarios", () => {
  it("production: ~/.phneakngar/workspaces", () => {
    delete process.env.PHNEAKNGAR_PROJECT_ROOT;
    const cfg = loadDaemonConfig();
    expect(cfg.workspacesRoot).toBe(join(homedir(), ".phneakngar", "workspaces"));
  });

  it("production + profile: ~/.phneakngar/workspaces_{profile}", () => {
    delete process.env.PHNEAKNGAR_PROJECT_ROOT;
    const cfg = loadDaemonConfig("dev");
    expect(cfg.workspacesRoot).toBe(
      join(homedir(), ".phneakngar", "workspaces_dev"),
    );
  });

  it("dev mode: <PROJECT>/.phneakngar/workspaces", () => {
    process.env.PHNEAKNGAR_PROJECT_ROOT = "/tmp/my-project/.phneakngar";
    const cfg = loadDaemonConfig();
    expect(cfg.workspacesRoot).toBe(
      join("/tmp/my-project/.phneakngar", "workspaces"),
    );
  });

  it("dev mode + profile: <PROJECT>/.phneakngar/workspaces_{profile}", () => {
    process.env.PHNEAKNGAR_PROJECT_ROOT = "/tmp/my-project/.phneakngar";
    const cfg = loadDaemonConfig("staging");
    expect(cfg.workspacesRoot).toBe(
      join("/tmp/my-project/.phneakngar", "workspaces_staging"),
    );
  });

  it("app mode: ~/.phneakngar/self-hosted/workspaces", () => {
    process.env.PHNEAKNGAR_PROJECT_ROOT = join(homedir(), ".phneakngar", "self-hosted");
    const cfg = loadDaemonConfig();
    expect(cfg.workspacesRoot).toBe(
      join(homedir(), ".phneakngar", "self-hosted", "workspaces"),
    );
  });

  it("PHNEAKNGAR_WORKSPACES_ROOT overrides all defaults", () => {
    process.env.PHNEAKNGAR_PROJECT_ROOT = "/tmp/my-project/.phneakngar";
    process.env.PHNEAKNGAR_WORKSPACES_ROOT = "/custom/path";
    const cfg = loadDaemonConfig();
    expect(cfg.workspacesRoot).toBe("/custom/path");
  });
});

describe("sessionRunnerLogDir — three PHNEAKNGAR_PROJECT_ROOT scenarios", () => {
  it("production: ~/.phneakngar/daemon/session-runners", () => {
    delete process.env.PHNEAKNGAR_PROJECT_ROOT;
    expect(sessionRunnerLogDir()).toBe(
      join(homedir(), ".phneakngar", "daemon", "session-runners"),
    );
  });

  it("dev mode: <PROJECT>/.phneakngar/daemon/session-runners", () => {
    process.env.PHNEAKNGAR_PROJECT_ROOT = "/tmp/my-project/.phneakngar";
    expect(sessionRunnerLogDir()).toBe(
      join("/tmp/my-project/.phneakngar", "daemon", "session-runners"),
    );
  });

  it("app mode: ~/.phneakngar/self-hosted/daemon/session-runners", () => {
    process.env.PHNEAKNGAR_PROJECT_ROOT = join(homedir(), ".phneakngar", "self-hosted");
    expect(sessionRunnerLogDir()).toBe(
      join(homedir(), ".phneakngar", "self-hosted", "daemon", "session-runners"),
    );
  });
});
