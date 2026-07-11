import { Command } from "commander";
import { spawnSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { buildCliEnv } from "../lib/cli-env.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function findCliEntry(): string {
  return join(__dirname, "cli", "index.js");
}

function runCli(args: string[]): void {
  const result = spawnSync("node", [findCliEntry(), ...args], {
    stdio: "inherit",
    env: buildCliEnv(),
  });
  process.exit(result.status ?? 1);
}

export function registerCommand(): Command {
  return new Command("register")
    .description("Register CLI with local ភ្នាក់ងារ server")
    .allowUnknownOption()
    .passThroughOptions()
    .argument("[args...]")
    .action((args) => {
      runCli(["register", ...args]);
    });
}

export function chhlatCommand(): Command {
  const chhlat = new Command("chhlat")
    .description("Manage the local ភ្នាក់ងារ chhlat (always-on agent)")
    .enablePositionalOptions();

  chhlat
    .command("start")
    .description("Start chhlat")
    .allowUnknownOption()
    .passThroughOptions()
    .argument("[args...]")
    .action((args) => {
      runCli(["chhlat", "start", ...args]);
    });

  chhlat
    .command("stop")
    .description("Stop chhlat")
    .action(() => {
      runCli(["chhlat", "stop"]);
    });

  chhlat
    .command("status")
    .description("Check chhlat status")
    .action(() => {
      runCli(["chhlat", "status"]);
    });

  return chhlat;
}

export function cliPassthroughCommand(): Command {
  return new Command("cli")
    .description("Run any @phneakngar/cli command against the local server")
    .allowUnknownOption()
    .passThroughOptions()
    .argument("[args...]")
    .action((args) => {
      runCli(args);
    });
}
