import { Command } from "commander";
import { loadCLIConfigForProfile } from "../lib/config.js";
import { cmdPrefix, getServerUrl } from "../lib/env.js";
import { detectRuntimes } from "../lib/runtimes.js";
import { getCurrentVersion } from "../lib/version.js";
import { isProcessAlive, readChhlatPid } from "../chhlat/pidfile.js";
import { pidFilePath } from "../chhlat/config.js";
export function formatStatusReport(profile) {
    const lines = [];
    const cfg = loadCLIConfigForProfile(profile);
    const server = cfg.server_url || getServerUrl();
    const ws = cfg.watched_workspaces?.find((w) => w.token && w.status !== "deleted") ||
        cfg.watched_workspaces?.[0];
    lines.push(`CLI version: ${getCurrentVersion()}`);
    lines.push(`Server: ${server}`);
    if (!ws?.token) {
        const empty = !cfg.watched_workspaces?.length ||
            !cfg.watched_workspaces.some((w) => w.token && w.status !== "deleted");
        lines.push(empty && !cfg.watched_workspaces?.length
            ? "Registration: Not registered (watched_workspaces empty)"
            : "Registration: Not registered (no active machine token)");
        lines.push(`Hint: Run '${cmdPrefix()} register --token al_...' (per workspace). Or '${cmdPrefix()} login'.`);
    }
    else {
        lines.push("Registration: Registered");
        lines.push(`Workspace: ${ws.name || "unknown"} (${ws.id || "no-id"})`);
    }
    const pid = readChhlatPid(profile);
    if (pid == null) {
        lines.push("Chhlat: not running");
    }
    else if (!isProcessAlive(pid)) {
        lines.push(`Chhlat: not running (stale pidfile at ${pidFilePath(profile)})`);
    }
    else {
        lines.push(`Chhlat: running (pid=${pid})`);
    }
    const runtimes = detectRuntimes();
    if (runtimes.length === 0) {
        lines.push("AI runtimes: none found (install claude, codex, opencode, or grok)");
    }
    else {
        lines.push(`AI runtimes: ${runtimes.map((r) => (r.version ? `${r.type} (${r.version})` : r.type)).join(", ")}`);
    }
    return lines;
}
export function statusCommand() {
    const cmd = new Command("status")
        .description("Show registration, chhlat, and runtime status")
        .action((_opts, command) => {
        const profile = command.parent?.opts().profile;
        for (const line of formatStatusReport(profile)) {
            console.log(line);
        }
    });
    return cmd;
}
