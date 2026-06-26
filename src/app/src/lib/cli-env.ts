import { DEFAULT_PORTS, WEB_URL, SELF_HOSTED_DIR } from "./constants.js";
import { readPids } from "./pid.js";

/**
 * Build env vars for spawning @phneakngar/cli subprocesses.
 *
 * Three scenarios — all resolve PHNEAKNGAR_PROJECT_ROOT via SELF_HOSTED_DIR:
 *   1. Production install:   ~/.phneakngar/self-hosted
 *   2. Dev mode (monorepo):  <PHNEAKNGAR_PROJECT_ROOT>/.phneakngar/self-hosted
 *   3. App mode (npx):       ~/.phneakngar/self-hosted  (same as 1)
 */
export function buildCliEnv(webPort?: number): Record<string, string> {
  const pids = readPids();
  const port = webPort ?? (pids.ports?.web ?? DEFAULT_PORTS.web);
  const wsDoPort = pids.ports?.wsDo ?? DEFAULT_PORTS.wsDo;
  return {
    ...(process.env as Record<string, string>),
    PHNEAKNGAR_SERVER_URL: WEB_URL(port),
    PHNEAKNGAR_PROJECT_ROOT: SELF_HOSTED_DIR,
    PHNEAKNGAR_CMD_PREFIX: "npx @phneakngar/app cli",
    PHNEAKNGAR_HEALTH_PORT: "19515",
    PHNEAKNGAR_WS_DO_PORT: String(wsDoPort),
  };
}
