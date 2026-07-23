import { Command } from "commander";
import { loadCLIConfig, saveCLIConfig, configPath } from "../lib/config.js";
import { printJSON } from "../lib/output.js";
function isValidHttpUrl(value) {
    try {
        const u = new URL(value);
        return u.protocol === "http:" || u.protocol === "https:";
    }
    catch {
        return false;
    }
}
export function setServerUrl(serverUrl) {
    if (!isValidHttpUrl(serverUrl)) {
        throw new Error(`invalid server URL: ${serverUrl}`);
    }
    const normalized = serverUrl.replace(/\/$/, "");
    const cfg = loadCLIConfig();
    cfg.server_url = normalized;
    saveCLIConfig(cfg);
    return normalized;
}
export function configCommand() {
    const cmd = new Command("config").description("Manage CLI configuration");
    cmd
        .command("show")
        .description("Show current configuration")
        .action(() => {
        const cfg = loadCLIConfig();
        printJSON(cfg);
    });
    cmd
        .command("path")
        .description("Show config file path")
        .action(() => {
        console.log(configPath());
    });
    cmd
        .command("set-server")
        .description("Set the control plane base URL in local config")
        .argument("<url>", "Server base URL (https://...)")
        .action((url) => {
        try {
            const saved = setServerUrl(url);
            console.log(`server_url set to ${saved}`);
            console.log(`Config: ${configPath()}`);
        }
        catch (err) {
            console.error(`Error: ${err instanceof Error ? err.message : err}`);
            process.exit(1);
        }
    });
    return cmd;
}
