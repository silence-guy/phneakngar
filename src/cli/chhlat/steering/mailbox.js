/**
 * Filesystem Mailbox — IPC between chhlat and session-runner for steering.
 *
 * Protocol:
 * 1. Chhlat atomically writes <seq>.json.tmp → renames to <seq>.json
 * 2. Session-runner watches inbox via fs.watch() + polling fallback
 * 3. Session-runner reads file, delivers to agent stdin
 * 4. Session-runner writes <seq>.ack (or <seq>.nack with reason)
 * 5. Chhlat polls for ack within timeout, falls back on nack/timeout
 */
import { mkdirSync, writeFileSync, readFileSync, renameSync, readdirSync, unlinkSync, rmSync, existsSync, watch } from "fs";
import { join } from "path";
import { createLogger } from "../../lib/logger.js";
const log = createLogger({ module: "mailbox" });
// --- Directory structure helpers ---
export function inboxDir(baseDir, contextKey) {
    const safeKey = contextKey.replace(/[^a-zA-Z0-9_:-]/g, "_");
    return join(baseDir, ".steering", safeKey, "inbox");
}
export function ackDir(baseDir, contextKey) {
    const safeKey = contextKey.replace(/[^a-zA-Z0-9_:-]/g, "_");
    return join(baseDir, ".steering", safeKey, "ack");
}
export function steeringDir(baseDir, contextKey) {
    const safeKey = contextKey.replace(/[^a-zA-Z0-9_:-]/g, "_");
    return join(baseDir, ".steering", safeKey);
}
// --- Chhlat side (writer) ---
export function ensureMailboxDirs(baseDir, contextKey) {
    const inbox = inboxDir(baseDir, contextKey);
    const ack = ackDir(baseDir, contextKey);
    mkdirSync(inbox, { recursive: true });
    mkdirSync(ack, { recursive: true });
}
let seqCounter = 0;
export function writeSteerMessage(baseDir, contextKey, message) {
    const inbox = inboxDir(baseDir, contextKey);
    const seq = String(++seqCounter).padStart(6, "0");
    const tmpPath = join(inbox, `${seq}.json.tmp`);
    const finalPath = join(inbox, `${seq}.json`);
    writeFileSync(tmpPath, JSON.stringify(message));
    renameSync(tmpPath, finalPath);
    return seq;
}
export function waitForAck(baseDir, contextKey, seq, timeoutMs = 3000) {
    const ackPath = join(ackDir(baseDir, contextKey), `${seq}.ack`);
    const nackPath = join(ackDir(baseDir, contextKey), `${seq}.nack`);
    return new Promise((resolve) => {
        const deadline = Date.now() + timeoutMs;
        const pollInterval = 100;
        const check = () => {
            try {
                if (existsSync(ackPath)) {
                    resolve({ acked: true });
                    return;
                }
                if (existsSync(nackPath)) {
                    let reason = "unknown";
                    try {
                        const content = readFileSync(nackPath, "utf-8");
                        const parsed = JSON.parse(content);
                        reason = parsed.reason || "unknown";
                    }
                    catch { /* best-effort */ }
                    resolve({ acked: false, nackReason: reason });
                    return;
                }
            }
            catch { /* best-effort */ }
            if (Date.now() >= deadline) {
                resolve({ acked: false, nackReason: "timeout" });
                return;
            }
            setTimeout(check, pollInterval);
        };
        check();
    });
}
// --- Session-runner side (reader) ---
export function readSteerMessage(filePath) {
    try {
        const content = readFileSync(filePath, "utf-8");
        return JSON.parse(content);
    }
    catch {
        return null;
    }
}
export function writeAck(baseDir, contextKey, seq) {
    const ack = ackDir(baseDir, contextKey);
    mkdirSync(ack, { recursive: true });
    writeFileSync(join(ack, `${seq}.ack`), "");
}
export function writeNack(baseDir, contextKey, seq, reason) {
    const ack = ackDir(baseDir, contextKey);
    mkdirSync(ack, { recursive: true });
    writeFileSync(join(ack, `${seq}.nack`), JSON.stringify({ reason }));
}
export function cleanupInboxFile(baseDir, contextKey, seq) {
    try {
        unlinkSync(join(inboxDir(baseDir, contextKey), `${seq}.json`));
    }
    catch { /* best-effort */ }
}
export function cleanupSteeringDir(baseDir, contextKey) {
    const dir = steeringDir(baseDir, contextKey);
    try {
        rmSync(dir, { recursive: true, force: true });
    }
    catch { /* best-effort */ }
}
/**
 * Watch the inbox directory for new steer messages.
 * Calls onMessage for each new .json file detected.
 * Uses fs.watch + polling fallback for reliability.
 */
export function watchInbox(baseDir, contextKey, onMessage) {
    const inbox = inboxDir(baseDir, contextKey);
    mkdirSync(inbox, { recursive: true });
    const seen = new Set();
    let stopped = false;
    const scan = () => {
        if (stopped)
            return;
        try {
            const files = readdirSync(inbox).filter((f) => f.endsWith(".json") && !f.endsWith(".tmp")).sort();
            for (const file of files) {
                if (seen.has(file))
                    continue;
                seen.add(file);
                const seq = file.replace(/\.json$/, "");
                const msg = readSteerMessage(join(inbox, file));
                if (msg) {
                    onMessage(seq, msg);
                }
            }
        }
        catch { /* best-effort */ }
    };
    // Initial scan for any pre-existing messages
    scan();
    // fs.watch for real-time detection
    let watcher = null;
    try {
        watcher = watch(inbox, () => {
            if (!stopped)
                scan();
        });
    }
    catch {
        log.debug("fs.watch failed, relying on polling only");
    }
    // Polling fallback (200ms)
    const pollTimer = setInterval(scan, 200);
    return {
        stop() {
            stopped = true;
            clearInterval(pollTimer);
            watcher?.close();
        },
    };
}
// --- Chhlat restart: stale message detection ---
export function findStaleInboxMessages(baseDir, contextKey, maxAgeMs = 30_000) {
    const inbox = inboxDir(baseDir, contextKey);
    const stale = [];
    try {
        const files = readdirSync(inbox).filter((f) => f.endsWith(".json") && !f.endsWith(".tmp"));
        const now = Date.now();
        for (const file of files) {
            try {
                const content = readFileSync(join(inbox, file), "utf-8");
                const msg = JSON.parse(content);
                if (msg.createdAt && now - Date.parse(msg.createdAt) > maxAgeMs) {
                    stale.push(file.replace(/\.json$/, ""));
                }
            }
            catch { /* skip malformed */ }
        }
    }
    catch { /* inbox doesn't exist */ }
    return stale;
}
