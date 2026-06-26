import { resolveMode, cliCommand, getBaseUrl } from "@phneakngar/shared";

export function getServerUrl(): string {
  return getBaseUrl({ serverUrl: process.env.PHNEAKNGAR_SERVER_URL });
}

export function isDev(): boolean {
  return resolveMode({
    serverUrl: process.env.PHNEAKNGAR_SERVER_URL,
    cmdPrefix: process.env.PHNEAKNGAR_CMD_PREFIX,
  }) === "dev";
}

export function cmdPrefix(): string {
  return process.env.PHNEAKNGAR_CMD_PREFIX || cliCommand(resolveMode({
    serverUrl: process.env.PHNEAKNGAR_SERVER_URL,
    cmdPrefix: process.env.PHNEAKNGAR_CMD_PREFIX,
  }));
}
