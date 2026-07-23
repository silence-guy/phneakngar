import { hostname } from "os";
import { join } from "path";
import { configDir } from "../lib/config.js";
import { getServerUrl } from "../lib/env.js";
import { getCurrentVersion } from "../lib/version.js";
export function pidFilePath(profile) {
    const name = profile ? `chhlat_${profile}.pid` : "chhlat.pid";
    return join(configDir(), name);
}
export function pidFilePathPrimary(profile) {
    return pidFilePath(profile);
}
export function lastUpdateMarkerPath(profile) {
    const name = profile ? `last_update_${profile}` : "last_update";
    return join(configDir(), name);
}
export function chhlatLogDir() {
    return join(configDir(), "chhlat", "logs");
}
export function sessionRunnerLogDir() {
    return join(configDir(), "chhlat", "session-runners");
}
export function chhlatLogFilePath(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return join(chhlatLogDir(), `${y}-${m}-${d}.log`);
}
function parseDuration(s) {
    if (!s)
        return 0;
    let total = 0;
    const regex = /(\d+(?:\.\d+)?)(ns|us|µs|ms|s|m|h)/g;
    let match;
    while ((match = regex.exec(s)) !== null) {
        const val = parseFloat(match[1]);
        switch (match[2]) {
            case "ns":
                total += val / 1e6;
                break;
            case "us":
            case "µs":
                total += val / 1e3;
                break;
            case "ms":
                total += val;
                break;
            case "s":
                total += val * 1000;
                break;
            case "m":
                total += val * 60000;
                break;
            case "h":
                total += val * 3600000;
                break;
        }
    }
    return total;
}
export function loadChhlatConfig(profile) {
    const h = hostname();
    let chhlatId = process.env.PHNEAKNGAR_CHHLAT_ID || h;
    if (profile && !chhlatId.endsWith(`-${profile}`)) {
        chhlatId = `${chhlatId}-${profile}`;
    }
    const defaultRoot = join(configDir(), profile ? `workspaces_${profile}` : "workspaces");
    const workspacesRoot = process.env.PHNEAKNGAR_WORKSPACES_ROOT || defaultRoot;
    return {
        serverURL: normalizeServerBaseURL(getServerUrl()),
        claudePath: process.env.PHNEAKNGAR_CLAUDE_PATH || "claude",
        codexPath: process.env.PHNEAKNGAR_CODEX_PATH || "codex",
        opencodePath: process.env.PHNEAKNGAR_OPENCODE_PATH || "opencode",
        grokPath: process.env.PHNEAKNGAR_GROK_PATH || "grok",
        claudeModel: process.env.PHNEAKNGAR_CLAUDE_MODEL || "",
        codexModel: process.env.PHNEAKNGAR_CODEX_MODEL || "",
        opencodeModel: process.env.PHNEAKNGAR_OPENCODE_MODEL || "",
        grokModel: process.env.PHNEAKNGAR_GROK_MODEL || "",
        pollInterval: parseDuration(process.env.PHNEAKNGAR_CHHLAT_POLL_INTERVAL || "3s"),
        wsPollInterval: parseDuration(process.env.PHNEAKNGAR_CHHLAT_WS_POLL_INTERVAL || "60s"),
        heartbeatInterval: parseDuration(process.env.PHNEAKNGAR_CHHLAT_HEARTBEAT_INTERVAL || "15s"),
        sweepInterval: parseDuration(process.env.PHNEAKNGAR_CHHLAT_SWEEP_INTERVAL || "60s"),
        agentTimeout: parseDuration(process.env.PHNEAKNGAR_AGENT_TIMEOUT || "12h"),
        messageInactivityTimeout: parseDuration(process.env.PHNEAKNGAR_MESSAGE_INACTIVITY_TIMEOUT || "20m"),
        maxConcurrentTasks: parseInt(process.env.PHNEAKNGAR_CHHLAT_MAX_CONCURRENT_TASKS || "20"),
        enableSteering: process.env.PHNEAKNGAR_ENABLE_STEERING === "1",
        chhlatId,
        deviceName: process.env.PHNEAKNGAR_CHHLAT_DEVICE_NAME || h,
        workspacesRoot,
        cliVersion: getCurrentVersion(),
    };
}
export function normalizeServerBaseURL(url) {
    return url
        .replace(/^ws:\/\//, "http://")
        .replace(/^wss:\/\//, "https://")
        .replace(/\/ws$/, "");
}
