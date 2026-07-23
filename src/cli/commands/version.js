import { Command } from "commander";
import { getCurrentVersion } from "../lib/version.js";
export function versionCommand() {
    const cmd = new Command("version")
        .description("Show CLI version")
        .action(() => {
        console.log(`phneakngar version ${getCurrentVersion()}`);
    });
    return cmd;
}
