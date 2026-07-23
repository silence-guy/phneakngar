import { mkdirSync } from "fs";
import { join } from "path";
import { configDir } from "../../lib/config.js";
// Avoid 8787 — the email-worker's `wrangler dev` binds it (src/email-worker/wrangler.toml),
// so a bare TCP probe there would mistake wrangler for the Headroom proxy.
const DEFAULT_PORT = 8799;
const MIN_PORT = 1024;
const MAX_PORT = 65535;
function asRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : null;
}
function boolValue(value) {
    if (typeof value === "boolean")
        return value;
    if (typeof value === "string")
        return ["1", "true", "yes", "on"].includes(value.toLowerCase());
    return false;
}
// Tri-state env override: unset -> defer to per-agent config; truthy -> force on;
// explicit falsy ("0"/"false"/"no"/"off") -> force off (fleet-wide kill switch).
function envBoolOverride(value) {
    if (typeof value !== "string" || !value.trim())
        return null;
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized))
        return true;
    if (["0", "false", "no", "off"].includes(normalized))
        return false;
    return null;
}
function parsePort(value) {
    const parsed = typeof value === "number"
        ? value
        : typeof value === "string" && value.trim()
            ? Number(value)
            : NaN;
    if (!Number.isInteger(parsed) || parsed < MIN_PORT || parsed > MAX_PORT)
        return null;
    return parsed;
}
export function normalizeHeadroomRuntimeConfig(runtimeConfig, env = process.env) {
    const runtime = asRecord(runtimeConfig);
    const headroom = asRecord(runtime?.headroom);
    const envOverride = envBoolOverride(env.PHNEAKNGAR_HEADROOM_ENABLED);
    const enabled = envOverride ?? boolValue(headroom?.enabled);
    const port = parsePort(env.PHNEAKNGAR_HEADROOM_PORT) ??
        parsePort(headroom?.port) ??
        parsePort(env.HEADROOM_PORT) ??
        DEFAULT_PORT;
    // Only parse upstream when headroom is enabled
    const upstream = enabled
        ? (() => {
            const upstreamRaw = asRecord(headroom?.upstream);
            return upstreamRaw
                ? {
                    claude: typeof upstreamRaw.claude === "string" ? upstreamRaw.claude : undefined,
                    openai: typeof upstreamRaw.openai === "string" ? upstreamRaw.openai : undefined,
                }
                : undefined;
        })()
        : undefined;
    return {
        enabled,
        mode: "proxy",
        requireOptimization: boolValue(headroom?.requireOptimization),
        outputShaper: boolValue(headroom?.outputShaper),
        memory: boolValue(headroom?.memory),
        ccr: boolValue(headroom?.ccr),
        port,
        executable: typeof env.PHNEAKNGAR_HEADROOM_PATH === "string" && env.PHNEAKNGAR_HEADROOM_PATH.trim()
            ? env.PHNEAKNGAR_HEADROOM_PATH.trim()
            : "headroom",
        upstream,
    };
}
export function resolveHeadroomPaths(root = configDir()) {
    const base = join(root, "headroom");
    return {
        configDir: join(base, "config"),
        workspaceDir: join(base, "workspace"),
        savingsPath: join(base, "savings.json"),
    };
}
export function ensureHeadroomDirs(paths) {
    mkdirSync(paths.configDir, { recursive: true, mode: 0o700 });
    mkdirSync(paths.workspaceDir, { recursive: true, mode: 0o700 });
}
