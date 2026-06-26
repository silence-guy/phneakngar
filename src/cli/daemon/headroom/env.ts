import type { HeadroomPaths, HeadroomRuntimeConfig } from "./config.js";

const LOOPBACK_HOST = "127.0.0.1";

export function headroomProxyUrl(config: Pick<HeadroomRuntimeConfig, "port">): string {
  return `http://${LOOPBACK_HOST}:${config.port}`;
}

export function buildHeadroomProcessEnv(
  config: HeadroomRuntimeConfig,
  paths: HeadroomPaths,
): Record<string, string> {
  const env: Record<string, string> = {
    HEADROOM_TELEMETRY: "off",
    HEADROOM_HOST: LOOPBACK_HOST,
    HEADROOM_PORT: String(config.port),
    HEADROOM_CONFIG_DIR: paths.configDir,
    HEADROOM_WORKSPACE_DIR: paths.workspaceDir,
    HEADROOM_SAVINGS_PATH: paths.savingsPath,
  };

  if (config.outputShaper) {
    env.HEADROOM_OUTPUT_SHAPER = "1";
  }
  if (!config.memory) {
    env.HEADROOM_MEMORY_INJECTION_MODE = "disabled";
  }

  return env;
}

export function buildProviderHeadroomEnv(
  provider: string,
  config: HeadroomRuntimeConfig,
  paths: HeadroomPaths,
): Record<string, string> {
  const proxyUrl = headroomProxyUrl(config);
  const env = buildHeadroomProcessEnv(config, paths);

  if (provider === "claude") {
    env.ANTHROPIC_BASE_URL = proxyUrl;
    env.ENABLE_TOOL_SEARCH = "true";
  } else if (provider === "codex") {
    env.OPENAI_BASE_URL = `${proxyUrl}/v1`;
  } else if (provider === "opencode") {
    env.OPENAI_BASE_URL = `${proxyUrl}/v1`;
    env.HEADROOM_PROXY_URL = proxyUrl;
  }

  env.PHNEAKNGAR_HEADROOM_ENABLED = "1";
  return env;
}
