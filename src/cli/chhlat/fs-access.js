import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { readdir } from "fs/promises";
import { execSync } from "child_process";
import { homedir as osHomedir } from "os";
import { dirname, join } from "path";
import { configDir } from "../lib/config.js";
import { cmdPrefix } from "../lib/env.js";
const FDA_URI = "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles";
const THROTTLE_MS = 60 * 60 * 1000;
// Bounded per-directory probe. A synchronous readdir on a hung NFS / FUSE /
// autofs / dead-SMB mount would block the event loop forever and hang chhlat
// startup — fatal for an "always-on" agent. The probe is therefore async and
// raced against a timeout; a timeout is reported as "blocked" (fail-closed for
// reporting; on macOS the probed dirs are local APFS and never time out, and on
// Linux/Windows we never auto-open a settings pane anyway).
const PROBE_TIMEOUT_MS = 1500;
function platformOf(p) {
    if (p === "darwin" || p === "linux" || p === "win32")
        return p;
    return "other";
}
function sensitiveDirs(platform, home) {
    switch (platform) {
        case "darwin":
            return [join(home, "Downloads"), join(home, "Desktop"), join(home, "Documents")];
        case "win32":
            return [join(home, "Documents"), join(home, "Desktop"), join(home, "Downloads")];
        case "linux":
        case "other":
        default:
            return [home];
    }
}
function settingsUriFor(platform) {
    if (platform === "darwin")
        return FDA_URI;
    return undefined;
}
function hintFor(platform, blocked) {
    const list = blocked.join(", ");
    switch (platform) {
        case "darwin":
            return (`macOS privacy (TCC) blocks reading ${list}. Grant Full Disk Access to the app that runs ` +
                `phneakngar (Terminal / iTerm / the desktop app): System Settings → Privacy & Security → ` +
                `Full Disk Access, then restart chhlat. Re-open the pane with 'phneakngar grant-access'.`);
        case "win32":
            return (`Could not read ${list}. On Windows your own files are readable by default, so this usually ` +
                `means the CLI is not running under your logged-in user (e.g. started as SYSTEM / a service), ` +
                `or a security product is blocking it. Run phneakngar as your own user; if Windows Security → ` +
                `Ransomware protection → Controlled folder access is on, allow your terminal / Node through it.`);
        case "linux":
        case "other":
        default:
            return (`Could not read ${list}. On Linux your own files are readable by default, so this usually ` +
                `means the CLI is confined (Snap / Flatpak / AppArmor / a container) or running as another ` +
                `user. Run the native (non-sandboxed) phneakngar as your own user, or grant the sandbox ` +
                `access to your home directory.`);
    }
}
export async function defaultProbe(dir, opts = {}) {
    const timeoutMs = opts.timeoutMs ?? PROBE_TIMEOUT_MS;
    const read = opts.read ?? readdir;
    let timer;
    const timedOut = new Promise((resolve) => {
        timer = setTimeout(() => resolve("blocked"), timeoutMs);
    });
    const work = read(dir).then(() => "ok", (err) => {
        const code = err?.code;
        return code === "ENOENT" || code === "ENOTDIR" ? "missing" : "blocked";
    });
    try {
        return await Promise.race([work, timedOut]);
    }
    finally {
        if (timer)
            clearTimeout(timer);
    }
}
// Only macOS has a privacy settings pane we can deep-link to (the FDA URI), so
// the opener is darwin-only. On Linux/Windows the settings URI is undefined and
// callers never invoke this; a no-op there avoids shipping broken cmd.exe /
// xdg-open quoting for an unreachable path.
export function defaultOpen(target) {
    if (platformOf(process.platform) !== "darwin")
        return;
    try {
        execSync(`open ${shellQuote(target)}`, { stdio: "ignore" });
    }
    catch {
        // Best-effort: never crash startup if the OS opener is unavailable.
    }
}
function shellQuote(s) {
    return `'${s.replace(/'/g, `'\\''`)}'`;
}
export async function checkFilesystemAccess(deps = {}) {
    const platform = platformOf(deps.platform ?? process.platform);
    const home = (deps.homedir ?? osHomedir)();
    const probe = deps.probe ?? defaultProbe;
    const dirs = sensitiveDirs(platform, home);
    const outcomes = await Promise.all(dirs.map(async (dir) => ({ dir, r: await probe(dir) })));
    const checked = [];
    const blocked = [];
    for (const { dir, r } of outcomes) {
        checked.push(dir);
        if (r === "blocked")
            blocked.push(dir);
    }
    return {
        platform,
        ok: blocked.length === 0,
        checked,
        blocked,
        settingsUri: settingsUriFor(platform),
        hint: blocked.length === 0 ? "" : hintFor(platform, blocked),
    };
}
export function isOpenablePlatform(platform) {
    return platform === "darwin";
}
function readMarker(path) {
    try {
        const n = Number.parseInt(readFileSync(path, "utf8").trim(), 10);
        return Number.isFinite(n) ? n : null;
    }
    catch {
        return null;
    }
}
function writeMarker(path, ts) {
    try {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, String(ts), "utf8");
    }
    catch {
        // Best-effort throttle persistence.
    }
}
export async function ensureFilesystemAccess(deps = {}) {
    const result = await checkFilesystemAccess(deps);
    const autoOpen = deps.autoOpen !== false;
    const open = deps.open ?? defaultOpen;
    const now = deps.now ?? Date.now;
    const markerPath = deps.markerPath ?? join(configDir(), "fs-access-prompted-at");
    if (result.ok || !autoOpen || !isOpenablePlatform(result.platform) || !result.settingsUri) {
        return { ...result, opened: false, throttled: false };
    }
    const throttleMs = deps.throttleMs ?? THROTTLE_MS;
    const ts = now();
    const lastPrompted = readMarker(markerPath);
    if (!deps.ignoreThrottle && lastPrompted != null && ts - lastPrompted < throttleMs) {
        return { ...result, opened: false, throttled: true };
    }
    open(result.settingsUri);
    writeMarker(markerPath, ts);
    return { ...result, opened: true, throttled: false };
}
// Pure decision for the chhlat startup log lines, extracted so the
// warn / opened / throttled branches are unit-testable without a logger.
export function fsAccessStartupNotes(result) {
    if (result.ok)
        return { info: [] };
    const info = [];
    if (result.opened) {
        info.push("Opened the OS privacy settings pane — grant access there, then restart chhlat.");
    }
    else if (result.throttled) {
        info.push(`Settings prompt throttled (once per hour). Run '${cmdPrefix()} grant-access' to open it now.`);
    }
    return {
        warn: `Filesystem access restricted by OS privacy gate: ${result.blocked.join(", ")}. ${result.hint}`,
        info,
    };
}
