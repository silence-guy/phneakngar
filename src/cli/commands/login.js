import { Command } from "commander";
import { fork, spawn } from "child_process";
import { fileURLToPath } from "url";
import { APIClient } from "../lib/client.js";
import { activateAndSave } from "../lib/activate.js";
import { loadCLIConfigForProfile, saveCLIConfigForProfile } from "../lib/config.js";
import { cmdPrefix, getServerUrl } from "../lib/env.js";
const DEVICE_CLIENT_ID = process.env.PHNEAKNGAR_DEVICE_CLIENT_ID || "phneakngar-cli";
function openBrowser(url) {
    try {
        const cmd = process.platform === "darwin" ? "open" :
            process.platform === "linux" ? "xdg-open" :
                process.platform === "win32" ? "start" : null;
        if (cmd) {
            const args = process.platform === "win32" ? ["", url] : [url];
            spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
        }
    }
    catch {
        // Browser open is best-effort
    }
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function syncWorkspacesToConfig(serverWorkspaces, profile, sessionToken) {
    const cfg = loadCLIConfigForProfile(profile);
    const watched = cfg.watched_workspaces || [];
    const serverIds = new Set(serverWorkspaces.map((w) => w.id));
    for (const sw of serverWorkspaces) {
        const existing = watched.find((w) => w.id === sw.id);
        if (existing) {
            existing.status = "active";
            existing.name = sw.name;
        }
        else {
            watched.push({ id: sw.id, name: sw.name, token: "", status: "active", agent_ids: [] });
        }
    }
    for (const w of watched) {
        if (w.id && !serverIds.has(w.id)) {
            w.status = "deleted";
        }
    }
    saveCLIConfigForProfile(profile, {
        server_url: cfg.server_url,
        session_token: sessionToken ?? cfg.session_token,
        watched_workspaces: watched,
    });
}
async function pollAndActivate(opts) {
    const { deviceCode, expiresIn, serverUrl, profile } = opts;
    let interval = opts.interval;
    const expiresAt = Date.now() + expiresIn * 1000;
    let tokenResp;
    while (Date.now() < expiresAt) {
        await sleep(interval);
        try {
            const res = await fetch(`${serverUrl}/api/auth/device/token`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
                    device_code: deviceCode,
                    client_id: DEVICE_CLIENT_ID,
                }),
            });
            if (res.ok) {
                tokenResp = await res.json();
                break;
            }
            const errBody = await res.json();
            if (errBody.error === "slow_down") {
                interval += 5000;
            }
            else if (errBody.error === "authorization_pending") {
                // Keep polling
            }
            else if (errBody.error === "expired_token") {
                console.error("Error: device code expired before you approved it.");
                console.error("");
                console.error("Do this, then try again:");
                console.error(`  1. Sign in at ${serverUrl}/sign-in (browser OTP)`);
                console.error(`  2. Run: ${cmdPrefix()} login`);
                console.error("  3. Click Approve on the device page within 15 minutes");
                process.exit(1);
            }
            else if (errBody.error === "access_denied") {
                console.error("Error: authorization was denied.");
                process.exit(1);
            }
            else {
                console.error(`Error: unexpected error: ${errBody.error_description || errBody.error}`);
                process.exit(1);
            }
        }
        catch {
            console.error("Error: network request failed during polling.");
            process.exit(1);
        }
    }
    if (!tokenResp) {
        console.error("Error: device code expired (timed out waiting for approval).");
        console.error(`Sign in at ${serverUrl}/sign-in first, then run: ${cmdPrefix()} login`);
        process.exit(1);
    }
    const sessionToken = tokenResp.access_token;
    const client = new APIClient(serverUrl, sessionToken);
    let email = "";
    try {
        const me = await client.getJSON("/api/me");
        email = me.email;
    }
    catch {
        // Non-fatal — we can proceed without the email for display
    }
    // Sync workspaces from server and store session token
    let serverWorkspaces = [];
    try {
        serverWorkspaces = await client.getJSON("/api/workspaces");
    }
    catch {
        // Non-fatal — will create new workspace during activate
    }
    syncWorkspacesToConfig(serverWorkspaces, profile, sessionToken);
    let workspaceId = serverWorkspaces.length > 0 ? serverWorkspaces[0].id : "";
    if (!workspaceId) {
        try {
            const newWs = await client.postJSON("/api/workspaces", {
                name: "Personal",
                slug: email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 48) || "personal",
            });
            workspaceId = newWs.id;
        }
        catch (err) {
            console.error(`Error: failed to create workspace: ${err instanceof Error ? err.message : err}`);
            process.exit(1);
        }
    }
    let machineToken;
    try {
        const mtResp = await client.postJSON(`/api/machine-tokens?workspace_id=${workspaceId}`);
        machineToken = mtResp.token;
    }
    catch (err) {
        console.error(`Error: failed to create machine token: ${err instanceof Error ? err.message : err}`);
        console.error(`Create a machine token in the dashboard and run: ${cmdPrefix()} register --token al_...`);
        process.exit(1);
    }
    const result = await activateAndSave({ token: machineToken, serverUrl, profile });
    if (email) {
        console.log(`\nLogged in as ${email}`);
    }
    console.log(`Workspace: ${result.workspaceName} (${result.workspaceId})`);
    console.log(`Runtimes: ${result.runtimeProviders.join(", ")}`);
}
// Background polling entry point — invoked as a detached child process in non-TTY mode
if (process.argv.includes("--__login-poll")) {
    const idx = process.argv.indexOf("--__login-poll");
    let data;
    try {
        data = JSON.parse(process.argv[idx + 1]);
    }
    catch {
        console.error("Error: invalid poll data");
        process.exit(1);
    }
    pollAndActivate(data).catch(() => process.exit(1));
}
async function checkExistingAuth(serverUrl, profile) {
    const config = loadCLIConfigForProfile(profile);
    // Try session token first, then machine token from workspaces
    const sessionToken = config.session_token;
    const workspaces = config.watched_workspaces || [];
    const ws = workspaces[0];
    const authToken = sessionToken || ws?.token;
    if (!authToken) {
        return { valid: false };
    }
    try {
        const res = await fetch(`${serverUrl}/api/workspaces`, {
            headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!res.ok) {
            return { valid: false };
        }
        const serverWorkspaces = await res.json();
        // Sync workspaces when config has no workspace with a valid id
        const hasValidWorkspace = workspaces.some((w) => w.id && w.status !== "deleted");
        if (!hasValidWorkspace && serverWorkspaces.length > 0) {
            syncWorkspacesToConfig(serverWorkspaces, profile);
        }
        let email;
        try {
            const meRes = await fetch(`${serverUrl}/api/me`, {
                headers: { Authorization: `Bearer ${authToken}` },
            });
            if (meRes.ok) {
                const me = await meRes.json();
                email = me.email;
            }
        }
        catch {
            // Non-fatal — proceed without email
        }
        const workspaceName = (serverWorkspaces.length > 0 ? serverWorkspaces[0].name : undefined)
            || ws?.name
            || undefined;
        return { valid: true, email, workspaceName };
    }
    catch {
        return { valid: false };
    }
}
export function loginCommand() {
    const cmd = new Command("login")
        .description("Log in to ភ្នាក់ងារ via browser (device code flow)")
        .option("--server <url>", "Server URL")
        .option("--profile <name>", "Profile name")
        .option("--force", "Re-authenticate even if already logged in")
        // zsh may pass "# opens /device" as args when INTERACTIVE_COMMENTS is off
        .allowExcessArguments(true)
        .action(async (opts, command) => {
        const profile = opts.profile || command.parent?.opts().profile;
        const serverUrl = opts.server ||
            command.parent?.opts().server ||
            getServerUrl();
        // Check if already authenticated (skip with --force)
        if (!opts.force) {
            const existing = await checkExistingAuth(serverUrl, profile);
            if (existing.valid) {
                const parts = ["Already logged in"];
                if (existing.email)
                    parts[0] += ` as ${existing.email}`;
                if (existing.workspaceName)
                    parts[0] += ` (workspace: ${existing.workspaceName})`;
                parts[0] += ".";
                console.log(parts[0]);
                console.log(`Run \`${cmdPrefix()} status\` or \`${cmdPrefix()} doctor\` to verify.`);
                return;
            }
        }
        // Step 1: Request device code
        console.log("Requesting device code...");
        console.log("");
        console.log("  Prerequisites:");
        console.log(`  • Be signed in at ${serverUrl}/sign-in (OTP email) first`);
        console.log("  • Then approve this machine on the device page");
        console.log("");
        let deviceResp;
        try {
            const res = await fetch(`${serverUrl}/api/auth/device/code`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ client_id: DEVICE_CLIENT_ID }),
            });
            if (!res.ok) {
                const text = await res.text();
                console.error(`Error: failed to get device code (${res.status}): ${text}`);
                process.exit(1);
            }
            deviceResp = await res.json();
        }
        catch (err) {
            console.error(`Error: failed to request device code: ${err instanceof Error ? err.message : err}`);
            process.exit(1);
        }
        // Step 2: Display verification URL and code
        const verificationUrl = deviceResp.verification_uri_complete || deviceResp.verification_uri;
        const expiresMin = Math.max(1, Math.round((deviceResp.expires_in || 900) / 60));
        console.log(`  Open this URL in your browser (expires in ~${expiresMin} min):`);
        console.log(`  ${verificationUrl}`);
        console.log();
        console.log(`  Enter code: ${deviceResp.user_code}`);
        console.log();
        console.log("  If the page asks you to sign in, finish OTP, then click Approve.");
        console.log();
        // Non-TTY (AI agent context): fork a background poller and exit immediately
        // so the agent gets the URL output and can prompt the user to authorize.
        if (!process.stdout.isTTY) {
            const pollData = JSON.stringify({
                deviceCode: deviceResp.device_code,
                interval: (deviceResp.interval || 5) * 1000,
                expiresIn: deviceResp.expires_in,
                serverUrl,
                profile,
            });
            const thisFile = fileURLToPath(import.meta.url);
            const child = fork(thisFile, ["--__login-poll", pollData], {
                detached: true,
                stdio: "ignore",
            });
            child.unref();
            console.log(`  Polling for authorization in the background (timeout: ~${expiresMin} min).`);
            console.log(`  Once approved, run \`${cmdPrefix()} status\` to verify.`);
            return;
        }
        // TTY: open browser and poll in foreground
        openBrowser(verificationUrl);
        console.log("  (Browser opened automatically)");
        console.log();
        console.log("Waiting for authorization...");
        await pollAndActivate({
            deviceCode: deviceResp.device_code,
            interval: (deviceResp.interval || 5) * 1000,
            expiresIn: deviceResp.expires_in,
            serverUrl,
            profile,
        });
    });
    return cmd;
}
