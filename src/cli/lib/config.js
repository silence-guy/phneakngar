import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
export function configDir() {
    return process.env.PHNEAKNGAR_PROJECT_ROOT || join(homedir(), ".phneakngar");
}
export function configPath() {
    return join(configDir(), "config.json");
}
export function loadCLIConfig() {
    try {
        return JSON.parse(readFileSync(configPath(), "utf-8"));
    }
    catch {
        return {};
    }
}
export function loadCLIConfigForProfile(profile) {
    const cfg = loadCLIConfig();
    const profileName = profile || cfg.default_profile;
    if (profileName && cfg.profiles?.[profileName]) {
        return cfg.profiles[profileName];
    }
    const result = {
        server_url: cfg.server_url || "",
        session_token: cfg.session_token,
        watched_workspaces: cfg.watched_workspaces || [],
    };
    // Default status for old entries without it
    for (const ws of result.watched_workspaces) {
        if (!ws.status)
            ws.status = ws.id ? "active" : "deleted";
    }
    return result;
}
export function saveCLIConfig(cfg) {
    mkdirSync(configDir(), { recursive: true, mode: 0o700 });
    writeFileSync(configPath(), JSON.stringify(cfg, null, 2), { mode: 0o600 });
}
export function saveCLIConfigForProfile(profile, profileConfig) {
    const cfg = loadCLIConfig();
    if (profile) {
        if (!cfg.profiles)
            cfg.profiles = {};
        cfg.profiles[profile] = profileConfig;
    }
    else {
        cfg.server_url = profileConfig.server_url;
        cfg.session_token = profileConfig.session_token;
        cfg.watched_workspaces = profileConfig.watched_workspaces;
        // Remove legacy machine_token if present
        delete cfg.machine_token;
    }
    saveCLIConfig(cfg);
}
