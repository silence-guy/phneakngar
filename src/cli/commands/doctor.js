import { Command } from "commander";
import { existsSync, accessSync, constants } from "fs";
import { loadCLIConfigForProfile, configPath, configDir } from "../lib/config.js";
import { getServerUrl, cmdPrefix } from "../lib/env.js";
import { detectRuntimes } from "../lib/runtimes.js";
import { getCurrentVersion } from "../lib/version.js";
import { isProcessAlive, readChhlatPid } from "../chhlat/pidfile.js";
import { chhlatLogFilePath, pidFilePath } from "../chhlat/config.js";
import { checkFilesystemAccess } from "../chhlat/fs-access.js";
import { webBrainDoctorCheck } from "./web.js";
/**
 * Pure doctor row for approval-hold env override.
 * Does not read agent runtime_config (no agent context in doctor).
 * Env unset → runtime default on; env forces on/off when recognized.
 */
export function checkApprovalHoldEnv(env = process.env) {
    const raw = (env.CHHLAT_APPROVAL_HOLD ?? env.PHNEAKNGAR_APPROVAL_HOLD ?? "")
        .toString()
        .trim()
        .toLowerCase();
    if (raw === "0" || raw === "false" || raw === "no" || raw === "off") {
        return {
            name: "Approval hold",
            status: "info",
            detail: "env forces off (CHHLAT_APPROVAL_HOLD / PHNEAKNGAR_APPROVAL_HOLD)",
            hint: "Unset env to use agent runtime_config (default on when missing)",
        };
    }
    if (raw === "1" || raw === "true" || raw === "yes" || raw === "on") {
        return {
            name: "Approval hold",
            status: "info",
            detail: "env forces on (CHHLAT_APPROVAL_HOLD / PHNEAKNGAR_APPROVAL_HOLD)",
        };
    }
    return {
        name: "Approval hold",
        status: "info",
        detail: "env unset — agent runtime_config.approvalHold (missing key = product default on)",
        hint: "Disable per agent in Runtime settings, or set CHHLAT_APPROVAL_HOLD=0",
    };
}
const MIN_NODE_MAJOR = 20;
const MIN_NODE_MINOR = 19;
function nodeVersionParts(version = process.versions.node) {
    const [major = 0, minor = 0, patch = 0] = version.split(".").map((p) => Number(p) || 0);
    return { major, minor, patch };
}
export function checkNodeVersion(version = process.versions.node) {
    const { major, minor } = nodeVersionParts(version);
    const ok = major > MIN_NODE_MAJOR || (major === MIN_NODE_MAJOR && minor >= MIN_NODE_MINOR);
    return {
        name: "Node.js",
        status: ok ? "pass" : "fail",
        detail: `v${version}`,
        hint: ok
            ? undefined
            : `Install Node.js >= ${MIN_NODE_MAJOR}.${MIN_NODE_MINOR}.0 (https://nodejs.org/)`,
    };
}
export function checkCliVersion() {
    return {
        name: "CLI version",
        status: "info",
        detail: getCurrentVersion(),
    };
}
export function checkConfig(profile) {
    const path = configPath();
    const dir = configDir();
    if (!existsSync(path)) {
        return {
            name: "Config",
            status: "warn",
            detail: `not found at ${path}`,
            hint: `Run '${cmdPrefix()} init' then '${cmdPrefix()} login' or '${cmdPrefix()} register --token <token>'`,
        };
    }
    try {
        accessSync(dir, constants.R_OK | constants.W_OK);
    }
    catch {
        return {
            name: "Config",
            status: "fail",
            detail: `cannot read/write ${dir}`,
            hint: `Fix permissions on ${dir} (recommended: chmod 700)`,
        };
    }
    const cfg = loadCLIConfigForProfile(profile);
    return {
        name: "Config",
        status: "pass",
        detail: `${path} (server=${cfg.server_url || getServerUrl()})`,
    };
}
/**
 * Fail closed when this PC has no usable watched workspace machine token.
 * Agents cannot reach the machine until `register --token al_...` succeeds
 * for the workspace (per-workspace). There is no separate server "machine online"
 * heartbeat API in doctor — reachability is registration + chhlat running.
 */
export function checkRegistration(profile) {
    const cfg = loadCLIConfigForProfile(profile);
    const list = cfg.watched_workspaces ?? [];
    const ws = list.find((w) => w.token && w.status !== "deleted");
    const registerHint = `Run '${cmdPrefix()} register --token al_...' (per workspace; create token in the dashboard). Or '${cmdPrefix()} login'.`;
    if (!ws?.token) {
        let detail;
        if (list.length === 0) {
            detail = "not registered — watched_workspaces empty (no machine token for this PC)";
        }
        else {
            const deleted = list.filter((w) => w.status === "deleted").length;
            const tokenless = list.filter((w) => !w.token).length;
            detail = `not registered — no active watched workspace token (${list.length} entries, none usable`;
            const parts = [];
            if (deleted)
                parts.push(`${deleted} deleted`);
            if (tokenless)
                parts.push(`${tokenless} without token`);
            if (parts.length)
                detail += `; ${parts.join(", ")}`;
            detail += ")";
        }
        return {
            name: "Registration",
            status: "fail",
            detail,
            hint: registerHint,
        };
    }
    return {
        name: "Registration",
        status: "pass",
        detail: `workspace ${ws.name || "unknown"} (${ws.id || "no-id"}) — agent can use this PC once chhlat is running`,
    };
}
/**
 * Probes whether the agent runtime can read the user's files across the whole
 * machine (Hermes / OpenClaw-style full-FS read access). On macOS this is gated
 * by TCC (Full Disk Access); on Linux/Windows the user's own files are readable
 * by default. Memory/index files stay scoped to the per-agent workdir, but that
 * is a write-scoping rule, not a read restriction — hence warn (not fail) when
 * blocked, since agents remain fully functional inside their workdir.
 */
export async function checkFilesystemAccessDoctor() {
    const result = await checkFilesystemAccess();
    if (result.ok) {
        return {
            name: "Filesystem access",
            status: "pass",
            detail: `full read access on ${result.platform} (agents can read the whole machine; ` +
                `memory/index files stay in the per-agent workdir)`,
        };
    }
    return {
        name: "Filesystem access",
        status: "warn",
        detail: `blocked by OS privacy gate: ${result.blocked.join(", ")}`,
        hint: `${result.hint} Run '${cmdPrefix()} grant-access' to re-open the settings pane.`,
    };
}
export function checkRuntimes() {
    const runtimes = detectRuntimes();
    if (runtimes.length === 0) {
        return {
            name: "AI runtimes",
            status: "fail",
            detail: "none found on PATH",
            hint: "Install at least one of: claude, codex, opencode, grok — then re-run doctor",
        };
    }
    return {
        name: "AI runtimes",
        status: "pass",
        detail: runtimes.map((r) => (r.version ? `${r.type} (${r.version})` : r.type)).join(", "),
    };
}
export function checkChhlat(profile) {
    const pid = readChhlatPid(profile);
    if (pid == null) {
        return {
            name: "Chhlat",
            status: "fail",
            detail: "not running",
            hint: `Start with '${cmdPrefix()} chhlat start'`,
        };
    }
    if (!isProcessAlive(pid)) {
        return {
            name: "Chhlat",
            status: "fail",
            detail: `stale pidfile (pid=${pid}) at ${pidFilePath(profile)}`,
            hint: `Remove stale pidfile or run '${cmdPrefix()} chhlat stop' then '${cmdPrefix()} chhlat start'`,
        };
    }
    return {
        name: "Chhlat",
        status: "pass",
        detail: `running (pid=${pid})`,
    };
}
export async function checkChhlatHealth(profile, fetchImpl = fetch) {
    const pid = readChhlatPid(profile);
    if (pid == null || !isProcessAlive(pid)) {
        return {
            name: "Chhlat health",
            status: "warn",
            detail: "skipped (chhlat not running)",
        };
    }
    const port = Number(process.env.PHNEAKNGAR_HEALTH_PORT) || 19514;
    const url = `http://127.0.0.1:${port}/health`;
    try {
        const res = await fetchImpl(url, { signal: AbortSignal.timeout(3000) });
        if (!res.ok) {
            return {
                name: "Chhlat health",
                status: "warn",
                detail: `HTTP ${res.status} from ${url}`,
                hint: `Check logs: ${chhlatLogFilePath()}`,
            };
        }
        let body = "";
        try {
            body = await res.text();
        }
        catch {
            // optional
        }
        return {
            name: "Chhlat health",
            status: "pass",
            detail: body ? `ok (${url})` : `ok HTTP ${res.status} (${url})`,
        };
    }
    catch (err) {
        return {
            name: "Chhlat health",
            status: "warn",
            detail: `unreachable at ${url}: ${err instanceof Error ? err.message : String(err)}`,
            hint: `Check logs: ${chhlatLogFilePath()}`,
        };
    }
}
export async function checkServerReachability(profile, fetchImpl = fetch) {
    const cfg = loadCLIConfigForProfile(profile);
    const serverUrl = (cfg.server_url || getServerUrl()).replace(/\/$/, "");
    const healthUrl = `${serverUrl}/api/health`;
    try {
        const res = await fetchImpl(healthUrl, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) {
            return {
                name: "Server",
                status: "warn",
                detail: `HTTP ${res.status} from ${healthUrl}`,
                hint: "Confirm PHNEAKNGAR_SERVER_URL / config server_url and that the control plane is up",
            };
        }
        return {
            name: "Server",
            status: "pass",
            detail: `reachable (${healthUrl})`,
        };
    }
    catch (err) {
        return {
            name: "Server",
            status: "warn",
            detail: `unreachable: ${err instanceof Error ? err.message : String(err)}`,
            hint: `Set server with '${cmdPrefix()} init --server <url>' or '${cmdPrefix()} config set-server <url>'`,
        };
    }
}
/**
 * Dry-config only: local process env for GATEWAY_TEAM_MAP / GATEWAY_WEBHOOK_SECRET.
 * When the map is set without a shared secret, control-plane webhooks fail closed.
 * Does not call provider APIs or list workspace bindings (no live channel probe).
 */
export function checkGatewayWebhookConfig(env = process.env) {
    const mapConfigured = Boolean(env.GATEWAY_TEAM_MAP?.trim());
    const secretConfigured = Boolean(env.GATEWAY_WEBHOOK_SECRET?.trim());
    if (mapConfigured && !secretConfigured) {
        return {
            name: "Gateway webhook secret",
            status: "fail",
            detail: "GATEWAY_TEAM_MAP is set without GATEWAY_WEBHOOK_SECRET (fail-closed dry-config)",
            hint: "Set GATEWAY_WEBHOOK_SECRET or clear GATEWAY_TEAM_MAP. Live provider probes are not performed.",
        };
    }
    if (mapConfigured && secretConfigured) {
        return {
            name: "Gateway webhook secret",
            status: "pass",
            detail: "map + secret present in this environment (dry-config; no live probe)",
        };
    }
    return {
        name: "Gateway webhook secret",
        status: "info",
        detail: "GATEWAY_TEAM_MAP not set in this environment (workspace bindings assessed via web settings/health)",
    };
}
export async function runDoctor(profile, options = {}) {
    const fetchImpl = options.fetchImpl ?? fetch;
    const checks = [
        checkNodeVersion(),
        checkCliVersion(),
        checkConfig(profile),
        checkRegistration(profile),
    ];
    checks.push(await checkFilesystemAccessDoctor());
    checks.push(checkRuntimes(), checkChhlat(profile), checkGatewayWebhookConfig(), webBrainDoctorCheck(), checkApprovalHoldEnv());
    if (!options.skipNetwork) {
        checks.push(await checkChhlatHealth(profile, fetchImpl));
        checks.push(await checkServerReachability(profile, fetchImpl));
    }
    const hasFail = checks.some((c) => c.status === "fail");
    return {
        checks,
        ok: !hasFail,
        exitCode: hasFail ? 1 : 0,
    };
}
function formatStatus(status) {
    switch (status) {
        case "pass":
            return "PASS";
        case "fail":
            return "FAIL";
        case "warn":
            return "WARN";
        case "info":
            return "INFO";
    }
}
export function printDoctorResult(result) {
    console.log("\nphneakngar doctor\n");
    for (const check of result.checks) {
        const label = formatStatus(check.status).padEnd(4);
        console.log(`  [${label}] ${check.name}: ${check.detail}`);
        if (check.hint) {
            console.log(`         → ${check.hint}`);
        }
    }
    console.log("");
    if (result.ok) {
        console.log("Result: ready (no hard failures).");
    }
    else {
        console.log("Result: not ready — fix FAIL items above, then re-run doctor.");
    }
    console.log("");
}
export function doctorCommand() {
    return new Command("doctor")
        .description("Diagnose local agent install and runtime readiness")
        .option("--skip-network", "Skip server and health HTTP checks")
        .action(async (opts, command) => {
        const profile = command.parent?.opts().profile;
        const result = await runDoctor(profile, { skipNetwork: !!opts.skipNetwork });
        printDoctorResult(result);
        process.exitCode = result.exitCode;
    });
}
