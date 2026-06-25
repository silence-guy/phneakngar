import { mkdirSync } from "fs";
import { join } from "path";
import { configDir } from "../../lib/config.js";

export type HeadroomStatus = "disabled" | "ready" | "failed";
export type HeadroomMode = "proxy";

export interface HeadroomRuntimeConfig {
  enabled: boolean;
  mode: HeadroomMode;
  requireOptimization: boolean;
  outputShaper: boolean;
  memory: boolean;
  ccr: boolean;
  port: number;
  executable: string;
}

export interface HeadroomPaths {
  configDir: string;
  workspaceDir: string;
  savingsPath: string;
}

const DEFAULT_PORT = 8787;
const MIN_PORT = 1024;
const MAX_PORT = 65535;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function boolValue(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["1", "true", "yes", "on"].includes(value.toLowerCase());
  return false;
}

function parsePort(value: unknown): number | null {
  const parsed = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim()
      ? Number(value)
      : NaN;
  if (!Number.isInteger(parsed) || parsed < MIN_PORT || parsed > MAX_PORT) return null;
  return parsed;
}

export function normalizeHeadroomRuntimeConfig(
  runtimeConfig: unknown,
  env: NodeJS.ProcessEnv = process.env,
): HeadroomRuntimeConfig {
  const runtime = asRecord(runtimeConfig);
  const headroom = asRecord(runtime?.headroom);
  const envEnabled = boolValue(env.ALOOK_HEADROOM_ENABLED);
  const enabled = boolValue(headroom?.enabled) || envEnabled;
  const port =
    parsePort(env.ALOOK_HEADROOM_PORT) ??
    parsePort(headroom?.port) ??
    parsePort(env.HEADROOM_PORT) ??
    DEFAULT_PORT;

  return {
    enabled,
    mode: "proxy",
    requireOptimization: boolValue(headroom?.requireOptimization),
    outputShaper: boolValue(headroom?.outputShaper),
    memory: boolValue(headroom?.memory),
    ccr: boolValue(headroom?.ccr),
    port,
    executable: typeof env.ALOOK_HEADROOM_PATH === "string" && env.ALOOK_HEADROOM_PATH.trim()
      ? env.ALOOK_HEADROOM_PATH.trim()
      : "headroom",
  };
}

export function resolveHeadroomPaths(root: string = configDir()): HeadroomPaths {
  const base = join(root, "headroom");
  return {
    configDir: join(base, "config"),
    workspaceDir: join(base, "workspace"),
    savingsPath: join(base, "savings.json"),
  };
}

export function ensureHeadroomDirs(paths: HeadroomPaths): void {
  mkdirSync(paths.configDir, { recursive: true, mode: 0o700 });
  mkdirSync(paths.workspaceDir, { recursive: true, mode: 0o700 });
}
