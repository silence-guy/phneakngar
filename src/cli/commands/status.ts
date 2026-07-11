import { Command } from "commander";
import { loadCLIConfigForProfile } from "../lib/config.js";
import { cmdPrefix, getServerUrl } from "../lib/env.js";
import { detectRuntimes } from "../lib/runtimes.js";
import { getCurrentVersion } from "../lib/version.js";
import { isProcessAlive, readDaemonPid } from "../daemon/pidfile.js";
import { pidFilePath } from "../daemon/config.js";

export function formatStatusReport(profile?: string): string[] {
  const lines: string[] = [];
  const cfg = loadCLIConfigForProfile(profile);
  const server = cfg.server_url || getServerUrl();
  const ws =
    cfg.watched_workspaces?.find((w) => w.token && w.status !== "deleted") ||
    cfg.watched_workspaces?.[0];

  lines.push(`CLI version: ${getCurrentVersion()}`);
  lines.push(`Server: ${server}`);

  if (!ws?.token) {
    lines.push("Registration: Not registered");
    lines.push(`Hint: Run '${cmdPrefix()} login' or '${cmdPrefix()} register --token <token>'`);
  } else {
    lines.push("Registration: Registered");
    lines.push(`Workspace: ${ws.name || "unknown"} (${ws.id || "no-id"})`);
  }

  const pid = readDaemonPid(profile);
  if (pid == null) {
    lines.push("Daemon: not running");
  } else if (!isProcessAlive(pid)) {
    lines.push(`Daemon: not running (stale pidfile at ${pidFilePath(profile)})`);
  } else {
    lines.push(`Daemon: running (pid=${pid})`);
  }

  const runtimes = detectRuntimes();
  if (runtimes.length === 0) {
    lines.push("AI runtimes: none found (install claude, codex, opencode, or grok)");
  } else {
    lines.push(
      `AI runtimes: ${runtimes.map((r) => (r.version ? `${r.type} (${r.version})` : r.type)).join(", ")}`,
    );
  }

  return lines;
}

export function statusCommand(): Command {
  const cmd = new Command("status")
    .description("Show registration, daemon, and runtime status")
    .action((_opts, command) => {
      const profile: string | undefined = command.parent?.opts().profile;
      for (const line of formatStatusReport(profile)) {
        console.log(line);
      }
    });

  return cmd;
}
