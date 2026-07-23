import { Command } from "commander";
import { APIClient } from "../lib/client.js";
import { cmdPrefix, getServerUrl } from "../lib/env.js";
import { activateAndSave } from "../lib/activate.js";
export function registerCommand() {
    const cmd = new Command("register")
        .description("Register CLI with your ភ្នាក់ងារ account")
        .requiredOption("--token <token>", "API token (starts with al_)")
        .option("--server <url>", "Server URL")
        .option("--profile <name>", "Profile name")
        .action(async (opts, command) => {
        const token = opts.token;
        const profile = opts.profile || command.parent?.opts().profile;
        const serverUrl = opts.server ||
            command.parent?.opts().server ||
            getServerUrl();
        if (!token) {
            console.error(`Error: --token is required\nUsage: ${cmdPrefix()} register --token <token>`);
            process.exit(1);
            return;
        }
        if (!token.startsWith("al_")) {
            console.error("Error: invalid token format: must start with 'al_'");
            process.exit(1);
            return;
        }
        // Activate first: pending machine tokens (al_*) are rejected by /api/me
        // until activate promotes them. activateAndSave persists config only after
        // a successful activate (same pattern as login.ts).
        const result = await activateAndSave({ token, serverUrl, profile });
        // Optional display-only identity fetch after activate (non-fatal).
        let email = "";
        try {
            const client = new APIClient(serverUrl, token);
            const me = await client.getJSON("/api/me");
            email = me.email;
        }
        catch {
            // Non-fatal — proceed without email for display (mirror login.ts)
        }
        if (email) {
            console.log(`\nRegistered as ${email}`);
        }
        console.log(`Workspace: ${result.workspaceName} (${result.workspaceId})`);
        console.log(`Runtimes: ${result.runtimeProviders.join(", ")}`);
    });
    return cmd;
}
