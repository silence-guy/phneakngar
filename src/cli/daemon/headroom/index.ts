import type { Task } from "../types.js";
import { normalizeHeadroomRuntimeConfig, resolveHeadroomPaths, type HeadroomStatus } from "./config.js";
import { buildProviderHeadroomEnv } from "./env.js";
import { ensureHeadroomProxy } from "./supervisor.js";

export interface HeadroomPreparation {
  status: HeadroomStatus;
  env: Record<string, string>;
  requireOptimization: boolean;
  diagnostic?: string;
}

const SUPPORTED_PROVIDERS = new Set(["claude", "codex", "opencode"]);

export async function prepareHeadroomForTask(
  task: Task,
  provider: string,
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

  const paths = resolveHeadroomPaths();
  const proxy = await ensureHeadroomProxy(config, paths);
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
