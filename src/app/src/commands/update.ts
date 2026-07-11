import { Command } from "commander";
import { spawnSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { startServices, stopServices, isRunning } from "../lib/services.js";
import { installBundled } from "../lib/install.js";
import { ensureSecrets } from "../lib/secrets.js";
import { patchWranglerConfigs } from "../lib/wrangler-config.js";
import { runMigrations } from "../lib/migrate.js";
import { buildCliEnv } from "../lib/cli-env.js";
import { DEFAULT_PORTS } from "../lib/constants.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function cliEntry(): string {
  return join(__dirname, "cli", "index.js");
}

function runChhlat(args: string[], quiet = false): { ok: boolean; output: string } {
  const result = spawnSync("node", [cliEntry(), "chhlat", ...args], {
    stdio: quiet ? ["pipe", "pipe", "pipe"] : "inherit",
    env: buildCliEnv(),
  });
  const output = quiet ? (result.stdout?.toString() ?? "") : "";
  return { ok: result.status === 0, output };
}

function isChhlatRunning(): boolean {
  const { output } = runChhlat(["status"], true);
  return output.includes("running (pid=");
}

export function updateCommand(): Command {
  return new Command("update")
    .description("Update ភ្នាក់ងារ to the latest version")
    .action(() => {
      console.log("Updating ភ្នាក់ងារ...\n");

      // Stop chhlat if running (so it doesn't hold the health port)
      const chhlatWasRunning = isChhlatRunning();
      if (chhlatWasRunning) {
        console.log("Stopping chhlat...");
        runChhlat(["stop"]);
      }

      const servicesWereRunning = isRunning();
      if (servicesWereRunning) {
        console.log("Stopping running services...");
        stopServices();
      }

      console.log("Installing latest version...");
      installBundled();

      ensureSecrets(DEFAULT_PORTS.web);
      patchWranglerConfigs(DEFAULT_PORTS);

      console.log("Running migrations...");
      runMigrations();

      // Restart services that were running before the update
      if (servicesWereRunning) {
        console.log("Restarting services...");
        startServices(DEFAULT_PORTS);
      }

      if (chhlatWasRunning) {
        console.log("Restarting chhlat...");
        runChhlat(["start"]);
      }

      console.log("\n✓ Update complete.");
      if (!servicesWereRunning) {
        console.log("Run 'npx @phneakngar/app start' to start services.");
      }
    });
}
