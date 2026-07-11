import { Command } from "commander";
import { spawnSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { stopServices } from "../lib/services.js";
import { buildCliEnv } from "../lib/cli-env.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function cliEntry(): string {
  return join(__dirname, "cli", "index.js");
}

function stopChhlat(): boolean {
  const status = spawnSync("node", [cliEntry(), "chhlat", "status"], {
    stdio: ["pipe", "pipe", "pipe"],
    env: buildCliEnv(),
  });
  const running = (status.stdout?.toString() ?? "").includes("running (pid=");
  if (!running) return false;

  spawnSync("node", [cliEntry(), "chhlat", "stop"], {
    stdio: "inherit",
    env: buildCliEnv(),
  });
  return true;
}

export function stopCommand(): Command {
  return new Command("stop")
    .description("Stop all ភ្នាក់ងារ services")
    .action(() => {
      console.log("Stopping ភ្នាក់ងារ services and chhlat...");
      stopServices();
      stopChhlat();
      console.log("\nAll services stopped.");
    });
}
