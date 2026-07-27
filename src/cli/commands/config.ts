import { Command } from "commander";
import { loadCLIConfig, saveCLIConfig, configPath } from "../lib/config.js";
import type { CLIConfig } from "../lib/config.js";
import { printJSON } from "../lib/output.js";

/**
 * Mask a credential for display, keeping enough to identify which one it is.
 * `al_abcdefghijkl` -> `al_…ijkl`
 */
function maskSecret(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  const prefix = /^al_/.test(trimmed) ? "al_" : "";
  const tail = trimmed.slice(-4);
  return `${prefix}…${tail}`;
}

/**
 * Redact session and machine tokens from a config before printing.
 *
 * `config show` output routinely ends up pasted into chat logs, issues, and CI
 * transcripts. session_token and watched_workspaces[].token are live bearer
 * credentials, so they are masked unless the operator explicitly opts in.
 * Covers the per-profile copies too, not just the top-level ones.
 */
export function redactCLIConfig(cfg: CLIConfig): CLIConfig {
  const redactWorkspaces = <T extends { token: string }>(list: T[] | undefined) =>
    list?.map((w) => ({ ...w, token: maskSecret(w.token) }));

  const out: CLIConfig = { ...cfg };
  if (typeof out.session_token === "string") {
    out.session_token = maskSecret(out.session_token);
  }
  if (out.watched_workspaces) {
    out.watched_workspaces = redactWorkspaces(out.watched_workspaces);
  }
  if (out.profiles) {
    out.profiles = Object.fromEntries(
      Object.entries(out.profiles).map(([name, profile]) => [
        name,
        {
          ...profile,
          ...(typeof profile.session_token === "string"
            ? { session_token: maskSecret(profile.session_token) }
            : {}),
          ...(profile.watched_workspaces
            ? { watched_workspaces: redactWorkspaces(profile.watched_workspaces)! }
            : {}),
        },
      ]),
    );
  }
  return out;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function setServerUrl(serverUrl: string): string {
  if (!isValidHttpUrl(serverUrl)) {
    throw new Error(`invalid server URL: ${serverUrl}`);
  }
  const normalized = serverUrl.replace(/\/$/, "");
  const cfg = loadCLIConfig();
  cfg.server_url = normalized;
  saveCLIConfig(cfg);
  return normalized;
}

export function configCommand(): Command {
  const cmd = new Command("config").description("Manage CLI configuration");

  cmd
    .command("show")
    .description("Show current configuration (tokens masked)")
    .option("--reveal-secrets", "Print session and machine tokens in full")
    .action((opts: { revealSecrets?: boolean }) => {
      const cfg = loadCLIConfig();
      if (opts.revealSecrets) {
        console.error(
          "Warning: output contains live credentials. Do not paste it into logs, issues, or chats.",
        );
        printJSON(cfg);
        return;
      }
      printJSON(redactCLIConfig(cfg));
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
    .action((url: string) => {
      try {
        const saved = setServerUrl(url);
        console.log(`server_url set to ${saved}`);
        console.log(`Config: ${configPath()}`);
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
    });

  return cmd;
}
