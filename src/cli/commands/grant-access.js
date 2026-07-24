import { Command } from "commander";
import { checkFilesystemAccess, defaultOpen, } from "../chhlat/fs-access.js";
export async function runGrantAccess(deps = {}) {
    const check = deps.check ?? checkFilesystemAccess;
    const open = deps.open ?? defaultOpen;
    const result = await check();
    let opened = false;
    if (!result.ok && result.settingsUri) {
        open(result.settingsUri);
        opened = true;
    }
    const lines = [];
    lines.push("", "phneakngar grant-access", "");
    lines.push(`  Platform: ${result.platform}`);
    for (const dir of result.checked) {
        const tag = result.blocked.includes(dir) ? "BLOCKED" : "ok     ";
        lines.push(`  [${tag}] ${dir}`);
    }
    lines.push("");
    if (result.ok) {
        lines.push("  Result: full read access — agents can already read the whole machine.");
    }
    else {
        lines.push(`  Result: OS privacy gate blocks ${result.blocked.join(", ")}.`);
        lines.push(`  → ${result.hint}`);
        if (opened) {
            lines.push("  Opened the OS privacy settings pane — grant access there, then restart chhlat.");
        }
        else if (result.platform === "darwin") {
            lines.push("  Could not auto-open the settings pane; open it manually (see hint above).");
        }
    }
    lines.push("");
    return { report: lines.join("\n"), opened, result };
}
export function grantAccessCommand() {
    return new Command("grant-access")
        .description("Check whole-machine file-read access and open the OS privacy settings (macOS Full Disk Access)")
        .action(async () => {
        const { report } = await runGrantAccess();
        console.log(report);
    });
}
