import { Command } from "commander";
import { existsSync, mkdirSync } from "fs";
import {
  configDir,
  configPath,
  loadCLIConfig,
  saveCLIConfig,
} from "../lib/config.js";
import { cmdPrefix, getServerUrl } from "../lib/env.js";
import { detectRuntimes } from "../lib/runtimes.js";

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function initConfig(options: { server?: string; force?: boolean }): {
  configPath: string;
  serverUrl: string;
  created: boolean;
  updated: boolean;
} {
  const dir = configDir();
  mkdirSync(dir, { recursive: true, mode: 0o700 });

  const path = configPath();
  const existed = existsSync(path);
  const cfg = loadCLIConfig();
  let updated = false;

  if (options.server) {
    if (!isValidHttpUrl(options.server)) {
      throw new Error(`invalid server URL: ${options.server}`);
    }
    const normalized = options.server.replace(/\/$/, "");
    // Only set when unset, or when --force is used.
    if (options.force || !cfg.server_url) {
      if (cfg.server_url !== normalized) {
        cfg.server_url = normalized;
        updated = true;
      }
    }
  } else if (!cfg.server_url) {
    cfg.server_url = getServerUrl();
    updated = true;
  }

  if (!existed || updated) {
    saveCLIConfig(cfg);
  }

  return {
    configPath: path,
    serverUrl: cfg.server_url || getServerUrl(),
    created: !existed,
    updated: !existed || updated,
  };
}

export function initCommand(): Command {
  return new Command("init")
    .description("Initialize local CLI config directory and optional server URL")
    .option(
      "--server <url>",
      "Control plane base URL (default: https://phneakngar-web.thatsilenceguy.workers.dev)",
    )
    .option("--force", "Overwrite server_url even if already set")
    .action((opts, command) => {
      // Parent also accepts --server; accept either placement:
      //   phneakngar init --server <url>
      //   phneakngar --server <url> init
      const parentServer: string | undefined = command.parent?.opts()?.server;
      const server: string | undefined = opts.server || parentServer;
      try {
        const result = initConfig({
          server,
          force: !!opts.force,
        });

        console.log("\nphneakngar init\n");
        console.log(`  Config:  ${result.configPath}`);
        console.log(`  Server:  ${result.serverUrl}`);
        console.log(
          `  Status:  ${result.created ? "created" : result.updated ? "updated" : "unchanged"}`,
        );

        const runtimes = detectRuntimes();
        if (runtimes.length === 0) {
          console.log("\n  AI runtimes: none found on PATH");
          console.log("  Install one of: claude, codex, opencode, grok");
        } else {
          console.log(
            `\n  AI runtimes: ${runtimes.map((r) => r.type).join(", ")}`,
          );
        }

        console.log("\nNext steps:\n");
        console.log(`  1. Sign in at the dashboard (browser OTP)`);
        console.log(`  2. ${cmdPrefix()} login`);
        console.log(`     (or: ${cmdPrefix()} register --token al_xxxxxxxx)`);
        console.log(`  3. ${cmdPrefix()} doctor`);
        console.log(`  4. ${cmdPrefix()} daemon start`);
        console.log(`  5. ${cmdPrefix()} daemon status\n`);
        console.log("  Tip: run commands one at a time (do not paste shell comments).\n");
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
    });
}
