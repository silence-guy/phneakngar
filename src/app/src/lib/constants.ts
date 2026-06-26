import { homedir } from "os";
import { join } from "path";

function resolveBaseDir(): string {
  if (process.env.PHNEAKNGAR_PROJECT_ROOT) {
    return join(process.env.PHNEAKNGAR_PROJECT_ROOT, ".phneakngar", "self-hosted");
  }
  return join(homedir(), ".phneakngar", "self-hosted");
}

export const SELF_HOSTED_DIR = resolveBaseDir();
export const PID_FILE = join(SELF_HOSTED_DIR, ".pids.json");

export const DEFAULT_PORTS = {
  web: 15210,
  emailWorker: 15211,
  wsDo: 15212,
} as const;

export const WEB_URL = (port: number) => `http://localhost:${port}`;
