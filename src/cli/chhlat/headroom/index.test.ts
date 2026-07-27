import { beforeEach, describe, expect, it } from "vitest";
import { prepareHeadroomForTask, hasUpstreamConfig, generateUpstreamConfig, normalizeHeadroomRuntimeConfig } from "./index.js";
import type { Task } from "../types.js";
import type { HeadroomProxyResult, HeadroomRuntimeConfig, HeadroomPaths } from "./index.js";

// Use a plain object ref so tests can control the mock without vi.mock/vi.fn
const mockProxyResult = { status: "ready" as const, started: false };

function makeTask(runtimeConfig?: Record<string, unknown>): Task {
  return {
    id: "t1",
    agentId: "a1",
    runtimeId: "rt1",
    conversationId: "c1",
    workspaceId: "ws1",
    prompt: "do the thing",
    status: "dispatched",
    priority: 0,
    type: "user_dm_message",
    contextKey: "c1",
    createdAt: "2026-01-01T00:00:00Z",
    traceId: null,
    parentTaskId: null,
    channel: null,
    agent: runtimeConfig ? { runtimeConfig } as Task["agent"] : undefined,
  };
}

// Dummy paths to avoid file system calls
const dummyPaths: HeadroomPaths = {
  configDir: "/tmp/headroom-config",
  workspaceDir: "/tmp/headroom-workspace",
  savingsPath: "/tmp/headroom-savings.json",
};

describe("prepareHeadroomForTask", () => {
  it("returns a no-op result without probing when Headroom is disabled", async () => {
    const ensureProxy = () => Promise.resolve({ status: "ready" } as HeadroomProxyResult);
    const result = await prepareHeadroomForTask(
      makeTask({ model: "sonnet" }),
      "claude",
      { ensureProxy, resolvePaths: () => dummyPaths },
    );

    expect(result).toEqual({
      status: "disabled",
      env: {},
      requireOptimization: false,
    });
  });

  it.each([
    ["claude", "ANTHROPIC_BASE_URL", "http://127.0.0.1:18787"],
    ["codex", "OPENAI_BASE_URL", "http://127.0.0.1:18787/v1"],
    ["opencode", "OPENAI_BASE_URL", "http://127.0.0.1:18787/v1"],
  ])("builds the ready proxy env overlay for %s", async (provider, envKey, expectedUrl) => {
    const result = await prepareHeadroomForTask(
      makeTask({
        headroom: {
          enabled: true,
          outputShaper: true,
          port: 18787,
        },
      }),
      provider,
      {
        ensureProxy: async () => ({ status: "ready", started: false }),
        resolvePaths: () => dummyPaths,
      },
    );

    expect(result.status).toBe("ready");
    expect(result.requireOptimization).toBe(false);
    expect(result.diagnostic).toBe("Headroom proxy reused on 127.0.0.1:18787");
    expect(result.env).toMatchObject({
      PHNEAKNGAR_HEADROOM_ENABLED: "1",
      HEADROOM_HOST: "127.0.0.1",
      HEADROOM_PORT: "18787",
      HEADROOM_TELEMETRY: "off",
      HEADROOM_OUTPUT_SHAPER: "1",
      [envKey]: expectedUrl,
    });
    expect(result.env).not.toHaveProperty("ANTHROPIC_API_KEY");
    expect(result.env).not.toHaveProperty("OPENAI_API_KEY");
  });

  it("adds the OpenCode proxy hint without requiring global config mutation", async () => {
    const result = await prepareHeadroomForTask(
      makeTask({ headroom: { enabled: true, port: 18787 } }),
      "opencode",
      {
        ensureProxy: async () => ({ status: "ready", started: true }),
        resolvePaths: () => dummyPaths,
      },
    );

    expect(result.env).toMatchObject({
      OPENAI_BASE_URL: "http://127.0.0.1:18787/v1",
      HEADROOM_PROXY_URL: "http://127.0.0.1:18787",
    });
    expect(result.diagnostic).toBe("Headroom proxy started on 127.0.0.1:18787");
  });

  it("fails before proxy startup for unsupported providers", async () => {
    const ensureProxy = () => Promise.resolve({ status: "ready" } as HeadroomProxyResult);
    const result = await prepareHeadroomForTask(
      makeTask({ headroom: { enabled: true, requireOptimization: true } }),
      "unknown-runtime",
      { ensureProxy, resolvePaths: () => dummyPaths },
    );

    expect(result).toEqual({
      status: "failed",
      env: {},
      requireOptimization: true,
      diagnostic: "Headroom is not configured for provider: unknown-runtime",
    });
  });

  it("does not enable Headroom for grok (xAI) in v1", async () => {
    let ensureProxyCalled = false;
    const result = await prepareHeadroomForTask(
      makeTask({ headroom: { enabled: true, requireOptimization: false } }),
      "grok",
      {
        ensureProxy: async () => {
          ensureProxyCalled = true;
          return { status: "ready", started: false };
        },
        resolvePaths: () => dummyPaths,
      },
    );

    expect(ensureProxyCalled).toBe(false);
    expect(result.status).toBe("failed");
    expect(result.env).toEqual({});
    expect(result.diagnostic).toMatch(/grok/i);
  });

  it("preserves the required-optimization flag when the proxy is unavailable", async () => {
    const ensureProxy = () =>
      Promise.resolve({
        status: "failed",
        reason: "Headroom executable not found: headroom",
      } as HeadroomProxyResult);

    const result = await prepareHeadroomForTask(
      makeTask({ headroom: { enabled: true, requireOptimization: true } }),
      "codex",
      { ensureProxy, resolvePaths: () => dummyPaths },
    );

    expect(result).toEqual({
      status: "failed",
      env: {},
      requireOptimization: true,
      diagnostic: "Headroom executable not found: headroom",
    });
  });
});

describe("upstream config exports", () => {
  it("exports hasUpstreamConfig and generateUpstreamConfig", () => {
    expect(typeof hasUpstreamConfig).toBe("function");
    expect(typeof generateUpstreamConfig).toBe("function");
  });

  it("hasUpstreamConfig returns false for config without upstream", () => {
    const config = normalizeHeadroomRuntimeConfig({ headroom: { enabled: true } });
    expect(hasUpstreamConfig(config)).toBe(false);
  });

  it("hasUpstreamConfig returns true for config with upstream", () => {
    const config = normalizeHeadroomRuntimeConfig({
      headroom: { enabled: true, upstream: { claude: "https://test.com" } },
    });
    expect(hasUpstreamConfig(config)).toBe(true);
  });

  const ORIGINAL_HOSTS = process.env.PHNEAKNGAR_HEADROOM_UPSTREAM_HOSTS;
  beforeEach(() => {
    // test.com stands in for an operator-approved third-party gateway.
    process.env.PHNEAKNGAR_HEADROOM_UPSTREAM_HOSTS = "test.com";
  });
  afterEach(() => {
    if (ORIGINAL_HOSTS === undefined) delete process.env.PHNEAKNGAR_HEADROOM_UPSTREAM_HOSTS;
    else process.env.PHNEAKNGAR_HEADROOM_UPSTREAM_HOSTS = ORIGINAL_HOSTS;
  });

  it("generateUpstreamConfig generates valid YAML for Claude", () => {
    const config = normalizeHeadroomRuntimeConfig({
      headroom: { enabled: true, upstream: { claude: "https://test.com" } },
    });
    const yaml = generateUpstreamConfig(config);
    expect(yaml).toContain("anthropic:");
    expect(yaml).toContain("base_url: https://test.com");
  });

  it("generateUpstreamConfig generates valid YAML for OpenAI", () => {
    const config = normalizeHeadroomRuntimeConfig({
      headroom: { enabled: true, upstream: { openai: "https://test.com/v1" } },
    });
    const yaml = generateUpstreamConfig(config);
    expect(yaml).toContain("openai:");
    expect(yaml).toContain("base_url: https://test.com/v1");
  });
});
