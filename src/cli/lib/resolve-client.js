import { loadCLIConfigForProfile } from "./config.js";
import { cmdPrefix } from "./env.js";
import { getRootOpts } from "./command-utils.js";
export function resolveClientOpts(command, opts = {}) {
    const result = resolveClientOptsPartial(command, opts);
    if (!result.workspaceId) {
        console.error("Error: cannot determine workspace. Set PHNEAKNGAR_WORKSPACE_ID env var or use --workspace flag.");
        process.exit(1);
    }
    return result;
}
export function resolveClientOptsPartial(command, opts = {}) {
    const parentOpts = getRootOpts(command);
    const cfg = loadCLIConfigForProfile(parentOpts.profile);
    // Server URL: flag > env > config
    const serverUrl = parentOpts.server || process.env.PHNEAKNGAR_SERVER_URL || cfg.server_url;
    if (!serverUrl) {
        console.error("Error: no server URL configured. Set PHNEAKNGAR_SERVER_URL or run register.");
        process.exit(1);
    }
    const workspaces = cfg.watched_workspaces || [];
    // Workspace resolution: flag > env > config lookup by agent_id > single workspace fallback
    let ws;
    const envWorkspaceId = process.env.PHNEAKNGAR_WORKSPACE_ID;
    if (opts.workspace) {
        ws = workspaces.find((w) => w.id === opts.workspace);
        if (!ws) {
            if (envWorkspaceId === opts.workspace) {
                ws = undefined;
            }
            else {
                console.error(`Error: workspace ${opts.workspace} not found in config.`);
                process.exit(1);
            }
        }
    }
    else if (opts.agentId) {
        ws = workspaces.find((w) => w.agent_ids?.includes(opts.agentId));
        if (!ws) {
            if (workspaces.length === 1) {
                ws = workspaces[0];
            }
        }
    }
    else if (workspaces.length === 1) {
        ws = workspaces[0];
    }
    // Token resolution: env > config > session_token
    const envToken = process.env.PHNEAKNGAR_TOKEN;
    const token = envToken || ws?.token || cfg.session_token;
    if (!token) {
        console.error(`Error: not registered. Run '${cmdPrefix()} register --token <token>' first.`);
        process.exit(1);
    }
    // Workspace ID resolution: ws from config > env > undefined (for partial)
    const workspaceId = ws?.id || envWorkspaceId || undefined;
    return { serverUrl, token, workspaceId };
}
