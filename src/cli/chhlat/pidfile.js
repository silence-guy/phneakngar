import { readFileSync, writeFileSync, unlinkSync, mkdirSync } from "fs";
import { dirname } from "path";
import { pidFilePath, pidFilePathPrimary } from "./config.js";
import { createLogger } from "../lib/logger.js";
const log = createLogger({ module: "pidfile" });
export function isProcessAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch {
        return false;
    }
}
export function readChhlatPid(profile) {
    try {
        const content = readFileSync(pidFilePath(profile), "utf-8").trim();
        const pid = parseInt(content, 10);
        return Number.isNaN(pid) ? null : pid;
    }
    catch {
        return null;
    }
}
/**
 * Write a PID file to prevent duplicate chhlat starts.
 * Returns true if acquired, false if another process is already running.
 */
export function acquireChhlatPid(profile) {
    const pidPath = pidFilePathPrimary(profile);
    const existing = readChhlatPid(profile);
    if (existing != null && isProcessAlive(existing)) {
        log.error(`Another chhlat is already running (PID ${existing}). ` +
            `Remove ${pidFilePath(profile)} if this is stale.`);
        return false;
    }
    mkdirSync(dirname(pidPath), { recursive: true, mode: 0o700 });
    writeFileSync(pidPath, String(process.pid), { mode: 0o600 });
    return true;
}
/**
 * Remove the pidfile only if its contents match the given PID.
 */
export function removePidFileIfMatches(pid, profile) {
    const pidPath = pidFilePath(profile);
    const onDisk = readChhlatPid(profile);
    if (onDisk !== pid)
        return;
    try {
        unlinkSync(pidPath);
    }
    catch {
        // already removed
    }
}
/** Remove our own pidfile on shutdown. */
export function releaseChhlatPid(profile) {
    removePidFileIfMatches(process.pid, profile);
}
