import { hostname } from "os";
import { spawn } from "child_process";
import { openSync, closeSync, mkdirSync } from "fs";
import { dirname } from "path";
import { APIClient } from "./client.js";
import { loadCLIConfigForProfile, saveCLIConfigForProfile } from "./config.js";
import { cmdPrefix, isDev } from "./env.js";
import { readChhlatPid, isProcessAlive } from "../chhlat/pidfile.js";
import { chhlatLogFilePath } from "../chhlat/config.js";
import { startChhlat } from "../chhlat/chhlat.js";
import { resolveLoginShellEnv } from "./shell-env.js";
import { detectRuntimes } from "./runtimes.js";
const AL_TOKEN_RE = /al_[A-Za-z0-9_-]{8,}/g;
const MAX_BODY_CHARS = 200;
/** Strip machine-token secrets and cap body length for safe console output. */
export function sanitizeActivateBody(bodyText) {
    const redacted = bodyText.replace(AL_TOKEN_RE, "al_[redacted]");
    if (redacted.length <= MAX_BODY_CHARS)
        return redacted;
    return `${redacted.slice(0, MAX_BODY_CHARS)}…`;
}
function extractServerError(bodyText) {
    const trimmed = bodyText.trim();
    if (!trimmed)
        return "";
    try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed?.error === "string")
            return parsed.error;
    }
    catch {
        // plain text body
    }
    return trimmed;
}
/**
 * Map activate HTTP status + body to a human-readable CLI error with an actionable hint.
 * Safe for console: never includes full al_* secrets.
 */
export function formatActivateFailure(status, bodyText) {
    const shortBody = sanitizeActivateBody(bodyText || "(empty body)");
    const serverError = extractServerError(bodyText).toLowerCase();
    const hint = activateFailureHint(status, serverError);
    if (hint) {
        return `Error: registration failed (${status}): ${shortBody}\n  → ${hint}`;
    }
    return `Error: registration failed (${status}): ${shortBody}`;
}
function activateFailureHint(status, serverError) {
    if (status === 404 || serverError.includes("token not found")) {
        return ("Token not found on this server. Check the server URL " +
            `('${cmdPrefix()} init --server <url>' / config) and copy a fresh token from the UI.`);
    }
    if (status === 422
        || serverError.includes("workspace_id")
        || serverError.includes("no workspace")) {
        return ("Token has no workspace. Open or create a workspace in the app first, " +
            "then generate a new token.");
    }
    if (status === 409) {
        if (serverError.includes("another user")) {
            return ("This machine hostname is already linked to another user. " +
                "Use a different hostname or create a new token in the UI after resolving ownership.");
        }
        if (serverError.includes("already claimed")
            || serverError.includes("another machine")
            || serverError.includes("already used")
            || serverError.includes("could not be finalized")) {
            return ("Token already used on another machine (or a different runtime set). " +
                "Create a new token in the UI for this machine.");
        }
        return ("Token activation conflict (already claimed or used). " +
            "Create a new token in the UI and try again.");
    }
    if (status === 503 || serverError.includes("temporarily unavailable")) {
        return "Token activation temporarily unavailable. Retry in a moment.";
    }
    if (status === 400) {
        return ("Invalid activation request. Re-copy the token from the UI and ensure " +
            "at least one runtime (claude, codex, opencode, or grok) is installed.");
    }
    if (status === 401) {
        return ("Server rejected this token. Copy a fresh token from the UI and confirm " +
            `the server URL ('${cmdPrefix()} init --server <url>' / config).`);
    }
    return null;
}
function fatalExit(code = 1) {
    process.exit(code);
    // process.exit is typed `never` but test mocks may return; keep control flow terminal.
    throw new Error(`process.exit(${code})`);
}
export async function activateAndSave(opts) {
    const { token, serverUrl, profile } = opts;
    console.log("Scanning for AI runtimes...");
    const runtimes = detectRuntimes();
    if (runtimes.length === 0) {
        console.error("Error: no runtimes found. Install claude, codex, opencode, or grok first.");
        fatalExit(1);
    }
    console.log(`Found: ${runtimes.map((r) => r.type).join(", ")}`);
    const host = hostname();
    console.log("Registering machine...");
    let activateResp;
    let res;
    try {
        res = await fetch(`${serverUrl}/api/machine-tokens/activate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, hostname: host, runtimes }),
        });
    }
    catch (err) {
        console.error(`Error: failed to activate: ${err instanceof Error ? err.message : err}`);
        fatalExit(1);
    }
    if (!res.ok) {
        const text = await res.text();
        console.error(formatActivateFailure(res.status, text));
        fatalExit(1);
    }
    try {
        activateResp = await res.json();
    }
    catch (err) {
        console.error(`Error: failed to activate: ${err instanceof Error ? err.message : err}`);
        fatalExit(1);
    }
    const client = new APIClient(serverUrl, token);
    let workspaces;
    try {
        workspaces = await client.getJSON("/api/workspaces");
    }
    catch (err) {
        console.error(`Error: failed to fetch workspaces: ${err instanceof Error ? err.message : err}`);
        fatalExit(1);
    }
    if (!workspaces.length) {
        console.error("Error: no workspaces found for this user");
        fatalExit(1);
    }
    const ws = workspaces.find((w) => w.id === activateResp.workspace_id) || workspaces[0];
    const wsClient = new APIClient(serverUrl, token, ws.id);
    let agentIds = [];
    try {
        const agents = await wsClient.getJSON(`/api/agents?workspace_id=${ws.id}`);
        agentIds = agents.map((a) => a.id);
    }
    catch {
        // Non-fatal
    }
    const existing = loadCLIConfigForProfile(profile);
    const watched = existing.watched_workspaces || [];
    const idx = watched.findIndex((w) => w.id === ws.id);
    if (idx >= 0) {
        watched[idx] = { id: ws.id, name: ws.name, token, status: "active", agent_ids: agentIds };
    }
    else {
        watched.push({ id: ws.id, name: ws.name, token, status: "active", agent_ids: agentIds });
    }
    saveCLIConfigForProfile(profile, {
        server_url: serverUrl,
        watched_workspaces: watched,
    });
    const chhlatPid = readChhlatPid(profile);
    if (chhlatPid && isProcessAlive(chhlatPid)) {
        try {
            process.kill(chhlatPid, "SIGHUP");
            console.log(`\nChhlat (pid ${chhlatPid}) notified — workspace will be active shortly.`);
        }
        catch {
            console.log(`\nChhlat is running but could not be notified. Restart it to pick up the new workspace.`);
        }
    }
    else if (isDev() && process.stdout.isTTY) {
        console.log("\nStarting chhlat in foreground...");
        await startChhlat(profile, serverUrl);
    }
    else {
        console.log("\nStarting chhlat...");
        try {
            const entry = process.argv[1];
            const args = [entry];
            if (profile)
                args.push("--profile", profile);
            args.push("chhlat", "start", "--foreground");
            const logPath = chhlatLogFilePath();
            mkdirSync(dirname(logPath), { recursive: true, mode: 0o700 });
            const logFd = openSync(logPath, "a", 0o600);
            const child = spawn(process.execPath, args, {
                detached: true,
                stdio: ["ignore", logFd, logFd],
                env: resolveLoginShellEnv(),
            });
            child.unref();
            closeSync(logFd);
            console.log("Chhlat started in background.");
            console.log(`Logs: ${logPath}`);
        }
        catch {
            console.log(`Failed to auto-start chhlat. Run '${cmdPrefix()} chhlat start' manually.`);
        }
    }
    return {
        workspaceId: ws.id,
        workspaceName: ws.name,
        runtimeProviders: activateResp.runtimes.map((r) => r.provider),
    };
}
