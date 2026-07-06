import type { Task } from "../types.js";
import { normalizeHeadroomRuntimeConfig, resolveHeadroomPaths, type HeadroomStatus, type HeadroomRuntimeConfig, type HeadroomPaths } from "./config.js";
import { buildProviderHeadroomEnv } from "./env.js";
import { ensureHeadroomProxy, type HeadroomProxyResult } from "./supervisor.js";
import { hasUpstreamConfig, generateUpstreamConfig } from "./config-generator.js";

export interface HeadroomPreparation {
  status: HeadroomStatus;
  env: Record<string, string>;
  requireOptimization: boolean;
  diagnostic?: string;
}

const SUPPORTED_PROVIDERS = new Set(["claude", "codex", "opencode"]);

export interface PrepareHeadroomDeps {
  ensureProxy?: (config: HeadroomRuntimeConfig, paths: HeadroomPaths) => Promise<HeadroomProxyResult>;
  resolvePaths?: (root?: string) => HeadroomPaths;
}

export async function prepareHeadroomForTask(
  task: Task,
  provider: string,
  deps: PrepareHeadroomDeps = {},
): Promise<HeadroomPreparation> {
  const config = normalizeHeadroomRuntimeConfig(task.agent?.runtimeConfig);
  if (!config.enabled) {
    return { status: "disabled", env: {}, requireOptimization: false };
  }

  if (!SUPPORTED_PROVIDERS.has(provider)) {
    return {
      status: "failed",
      env: {},
      requireOptimization: config.requireOptimization,
      diagnostic: `Headroom is not configured for provider: ${provider}`,
    };
  }

  const paths = (deps.resolvePaths ?? resolveHeadroomPaths)();
  const proxy = await (deps.ensureProxy ?? ensureHeadroomProxy)(config, paths);
  if (proxy.status !== "ready") {
    return {
      status: "failed",
      env: {},
      requireOptimization: config.requireOptimization,
      diagnostic: proxy.reason ?? "Headroom proxy unavailable",
    };
  }

  const action = proxy.started ? "started" : "reused";
  return {
    status: "ready",
    env: buildProviderHeadroomEnv(provider, config, paths),
    requireOptimization: config.requireOptimization,
    diagnostic: `Headroom proxy ${action} on 127.0.0.1:${config.port}`,
  };
}

export type { HeadroomRuntimeConfig } from "./config.js";
export { normalizeHeadroomRuntimeConfig, resolveHeadroomPaths } from "./config.js";
export { buildProviderHeadroomEnv, buildHeadroomProcessEnv } from "./env.js";
export { ensureHeadroomProxy } from "./supervisor.js";
export { hasUpstreamConfig, generateUpstreamConfig } from "./config-generator.js";
