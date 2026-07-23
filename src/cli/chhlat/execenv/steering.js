import { mkdirSync, writeFileSync, readFileSync, unlinkSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { acquireLock, releaseLock } from "./filelock.js";
import { createLogger } from "../../lib/logger.js";
const log = createLogger({ module: "steering" });
const INTENT_DIR_NAME = ".kill_intents";
const STEERING_LOCK_DIR = ".steering_locks";
const INTENT_STALE_MS = 10 * 60 * 1000; // 10 minutes
function intentFilePath(baseDir, taskId) {
    return join(baseDir, INTENT_DIR_NAME, `${taskId}.json`);
}
function intentDirPath(baseDir) {
    return join(baseDir, INTENT_DIR_NAME);
}
function steeringLockPath(baseDir, contextKey) {
    const safeKey = contextKey.replace(/[^a-zA-Z0-9_:-]/g, "_");
    return join(baseDir, STEERING_LOCK_DIR, safeKey);
}
export function writeKillIntent(baseDir, intent) {
    const dir = intentDirPath(baseDir);
    try {
        mkdirSync(dir, { recursive: true });
    }
    catch { /* already exists */ }
    const filePath = intentFilePath(baseDir, intent.targetTaskId);
    writeFileSync(filePath, JSON.stringify(intent));
}
export function readKillIntent(baseDir, taskId) {
    const filePath = intentFilePath(baseDir, taskId);
    try {
        const content = readFileSync(filePath, "utf-8");
        return JSON.parse(content);
    }
    catch {
        return null;
    }
}
export function clearKillIntent(baseDir, taskId) {
    const filePath = intentFilePath(baseDir, taskId);
    try {
        unlinkSync(filePath);
    }
    catch { /* already removed */ }
}
export function cleanupStaleIntents(baseDir) {
    const dir = intentDirPath(baseDir);
    let files;
    try {
        files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    }
    catch {
        return;
    }
    const now = Date.now();
    for (const file of files) {
        const filePath = join(dir, file);
        try {
            const content = readFileSync(filePath, "utf-8");
            const intent = JSON.parse(content);
            const stat = statSync(filePath);
            if (now - stat.mtimeMs > INTENT_STALE_MS) {
                unlinkSync(filePath);
                log.debug(`Cleaned up stale kill intent for task ${intent.targetTaskId}`);
            }
        }
        catch { /* best-effort */ }
    }
}
export function acquireSteeringLock(baseDir, contextKey) {
    const lockPath = steeringLockPath(baseDir, contextKey);
    try {
        mkdirSync(join(baseDir, STEERING_LOCK_DIR), { recursive: true });
    }
    catch { /* already exists */ }
    return acquireLock(lockPath, 60_000);
}
export function releaseSteeringLock(baseDir, contextKey) {
    const lockPath = steeringLockPath(baseDir, contextKey);
    releaseLock(lockPath);
}
