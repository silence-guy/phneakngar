import { Command } from "commander";
import { spawn } from "child_process";
import { openSync, closeSync, mkdirSync } from "fs";
import { dirname } from "path";
import { startChhlat } from "../chhlat/chhlat.js";
import { chhlatLogFilePath, pidFilePath } from "../chhlat/config.js";
import { isProcessAlive, readChhlatPid, removePidFileIfMatches, } from "../chhlat/pidfile.js";
import { resolveLoginShellEnv } from "../lib/shell-env.js";
import { isWindows } from "../lib/platform.js";
import { loadCLIConfigForProfile } from "../lib/config.js";
import { cmdPrefix } from "../lib/env.js";
const PID_POLL_INTERVAL_MS = 200;
const PID_POLL_TIMEOUT_MS = 2000;
const STOP_POLL_INTERVAL_MS = 200;
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
function buildChildArgs(profile, serverUrl) {
    const entry = process.argv[1];
    const args = [entry];
    if (profile)
        args.push("--profile", profile);
    if (serverUrl)
        args.push("--server", serverUrl);
    args.push("chhlat", "start", "--foreground");
    return args;
}
async function waitForPidFile(profile) {
    const deadline = Date.now() + PID_POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
        const pid = readChhlatPid(profile);
        if (pid != null && isProcessAlive(pid))
            return pid;
        await sleep(PID_POLL_INTERVAL_MS);
    }
    return null;
}
async function startInBackground(profile, serverUrl) {
    const existing = readChhlatPid(profile);
    if (existing != null && isProcessAlive(existing)) {
        console.error(`Chhlat already running (pid=${existing}).`);
        process.exit(1);
        return;
    }
    const logPath = chhlatLogFilePath();
    mkdirSync(dirname(logPath), { recursive: true, mode: 0o700 });
    const logFd = openSync(logPath, "a", 0o600);
    const child = spawn(process.execPath, buildChildArgs(profile, serverUrl), {
        detached: true,
        stdio: ["ignore", logFd, logFd],
        env: resolveLoginShellEnv(),
    });
    child.unref();
    closeSync(logFd);
    const pid = await waitForPidFile(profile);
    if (pid != null) {
        console.log(`Chhlat started (pid=${pid})`);
        console.log(`Logs: ${logPath}`);
        return;
    }
    console.error(`Chhlat did not write a pidfile within ${PID_POLL_TIMEOUT_MS}ms — check logs: ${logPath}`);
    process.exit(1);
}
function statusCommand(profile) {
    const pid = readChhlatPid(profile);
    const profileSuffix = profile ? ` profile=${profile}` : "";
    if (pid == null) {
        console.log(`Chhlat not running.${profileSuffix}`);
        return;
    }
    if (!isProcessAlive(pid)) {
        console.log(`Chhlat not running (stale pidfile at ${pidFilePath(profile)}).${profileSuffix}`);
        return;
    }
    console.log(`Chhlat running (pid=${pid})${profileSuffix}`);
}
async function stopCommand(profile) {
    const pid = readChhlatPid(profile);
    if (pid == null) {
        console.log("Chhlat not running.");
        return;
    }
    if (!isProcessAlive(pid)) {
        removePidFileIfMatches(pid, profile);
        console.log("Chhlat not running.");
        return;
    }
    console.log(`Stopping chhlat (pid=${pid})...`);
    try {
        process.kill(pid, "SIGTERM");
    }
    catch (e) {
        console.error(`Failed to signal chhlat: ${e}`);
        process.exit(1);
    }
    const shutdownMs = Number(process.env.PHNEAKNGAR_SHUTDOWN_TIMEOUT_MS) || 5000;
    const deadline = Date.now() + shutdownMs;
    while (Date.now() < deadline) {
        if (!isProcessAlive(pid)) {
            console.log("Chhlat stopped.");
            return;
        }
        await sleep(STOP_POLL_INTERVAL_MS);
    }
    console.warn(`Chhlat did not exit within ${shutdownMs}ms — force killing.`);
    if (!isWindows) {
        try {
            process.kill(pid, "SIGKILL");
        }
        catch {
            // already dead
        }
    }
    removePidFileIfMatches(pid, profile);
    console.log("Chhlat stopped.");
}
export function chhlatCommand() {
    const cmd = new Command("chhlat").description("Manage the ភ្នាក់ងារ chhlat (always-on agent)");
    cmd
        .command("start")
        .description("Start chhlat")
        .option("--foreground", "Run in foreground")
        .option("--server <url>", "Server URL override")
        .action(async (opts, command) => {
        const parentOpts = command.parent?.parent?.opts() || {};
        const profile = parentOpts.profile;
        const serverUrl = opts.server || parentOpts.server;
        const cfg = loadCLIConfigForProfile(profile);
        const registered = cfg.watched_workspaces?.some((w) => w.token && w.status !== "deleted");
        if (!registered) {
            console.error("Error: this machine is not registered yet.");
            console.error(`Run: ${cmdPrefix()} login`);
            console.error(`  or: ${cmdPrefix()} register --token al_...`);
            console.error("Then start chhlat again.");
            process.exit(1);
        }
        if (opts.foreground) {
            await startChhlat(profile, serverUrl);
            return;
        }
        await startInBackground(profile, serverUrl);
    });
    cmd
        .command("status")
        .description("Show chhlat status")
        .action((_opts, command) => {
        const parentOpts = command.parent?.parent?.opts() || {};
        statusCommand(parentOpts.profile);
    });
    cmd
        .command("stop")
        .description("Stop the running chhlat")
        .action(async (_opts, command) => {
        const parentOpts = command.parent?.parent?.opts() || {};
        await stopCommand(parentOpts.profile);
    });
    return cmd;
}
