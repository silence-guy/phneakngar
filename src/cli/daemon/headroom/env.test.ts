import { describe, expect, it } from "vitest";
import { buildProviderHeadroomEnv, buildHeadroomProcessEnv, headroomProxyUrl } from "./env.js";
import type { HeadroomPaths, HeadroomRuntimeConfig } from "./config.js";

const config: HeadroomRuntimeConfig = {
  enabled: true,
  mode: "proxy",
  requireOptimization: false,
  outputShaper: false,
  memory: false,
  ccr: false,
  port: 8787,
  executable: "headroom",
};

const paths: HeadroomPaths = {
  configDir: "/tmp/phneakngar/headroom/config",
  workspaceDir: "/tmp/phneakngar/headroom/workspace",
  savingsPath: "/tmp/phneakngar/headroom/savings.json",
};

describe("headroom env", () => {
  it("builds local-only process env with telemetry off", () => {
    expect(buildHeadroomProcessEnv(config, paths)).toMatchObject({
      HEADROOM_TELEMETRY: "off",
      HEADROOM_HOST: "127.0.0.1",
      HEADROOM_PORT: "8787",
      HEADROOM_CONFIG_DIR: paths.configDir,
      HEADROOM_WORKSPACE_DIR: paths.workspaceDir,
      HEADROOM_SAVINGS_PATH: paths.savingsPath,
      HEADROOM_MEMORY_INJECTION_MODE: "disabled",
    });
  });

  it("routes Claude through the Anthropic-compatible proxy", () => {
    expect(buildProviderHeadroomEnv("claude", config, paths)).toMatchObject({
      ANTHROPIC_BASE_URL: "http://127.0.0.1:8787",
      ENABLE_TOOL_SEARCH: "true",
      PHNEAKNGAR_HEADROOM_ENABLED: "1",
    });
  });

  it("routes Codex through the OpenAI-compatible proxy path", () => {
    expect(buildProviderHeadroomEnv("codex", config, paths)).toMatchObject({
      OPENAI_BASE_URL: "http://127.0.0.1:8787/v1",
      PHNEAKNGAR_HEADROOM_ENABLED: "1",
    });
  });

  it("sets OpenCode proxy hints without mutating global config", () => {
    expect(buildProviderHeadroomEnv("opencode", config, paths)).toMatchObject({
      OPENAI_BASE_URL: "http://127.0.0.1:8787/v1",
      HEADROOM_PROXY_URL: "http://127.0.0.1:8787",
      PHNEAKNGAR_HEADROOM_ENABLED: "1",
    });
  });

  it("returns the loopback proxy URL", () => {
    expect(headroomProxyUrl(config)).toBe("http://127.0.0.1:8787");
  });
});
