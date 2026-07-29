import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateUpstreamConfig, hasUpstreamConfig } from "./config-generator.js";
import type { HeadroomRuntimeConfig } from "./config.js";

const baseConfig: HeadroomRuntimeConfig = {
  enabled: true,
  mode: "proxy",
  requireOptimization: false,
  outputShaper: false,
  memory: false,
  ccr: false,
  port: 8799,
  executable: "headroom",
};

/**
 * These cases exercise the supported custom-gateway feature (LiteLLM / OpenRouter / a
 * corporate proxy), which now requires the operator to approve the host locally instead of
 * accepting whatever host the control plane pushes.
 */
const ORIGINAL_UPSTREAM_HOSTS = process.env.PHNEAKNGAR_HEADROOM_UPSTREAM_HOSTS;

beforeEach(() => {
  process.env.PHNEAKNGAR_HEADROOM_UPSTREAM_HOSTS = "proxy.com";
});

afterEach(() => {
  if (ORIGINAL_UPSTREAM_HOSTS === undefined) {
    delete process.env.PHNEAKNGAR_HEADROOM_UPSTREAM_HOSTS;
  } else {
    process.env.PHNEAKNGAR_HEADROOM_UPSTREAM_HOSTS = ORIGINAL_UPSTREAM_HOSTS;
  }
});

describe("generateUpstreamConfig", () => {
  it("generates YAML with Claude endpoint", () => {
    const config: HeadroomRuntimeConfig = {
      ...baseConfig,
      upstream: {
        claude: "https://api.proxy.com",
      },
    };

    const yaml = generateUpstreamConfig(config);
    expect(yaml).toContain("anthropic:");
    expect(yaml).toContain("base_url: https://api.proxy.com");
  });

  it("generates YAML with OpenAI endpoint", () => {
    const config: HeadroomRuntimeConfig = {
      ...baseConfig,
      upstream: {
        openai: "https://api.proxy.com/v1",
      },
    };

    const yaml = generateUpstreamConfig(config);
    expect(yaml).toContain("openai:");
    expect(yaml).toContain("base_url: https://api.proxy.com/v1");
  });

  it("generates YAML with both endpoints", () => {
    const config: HeadroomRuntimeConfig = {
      ...baseConfig,
      upstream: {
        claude: "https://claude.proxy.com",
        openai: "https://openai.proxy.com/v1",
      },
    };

    const yaml = generateUpstreamConfig(config);
    expect(yaml).toContain("anthropic:");
    expect(yaml).toContain("openai:");
  });

  it("returns empty string when no upstream configured", () => {
    const config: HeadroomRuntimeConfig = baseConfig;

    expect(generateUpstreamConfig(config)).toBe("");
    expect(hasUpstreamConfig(config)).toBe(false);
  });

  it("hasUpstreamConfig returns true for config with upstream", () => {
    const config: HeadroomRuntimeConfig = {
      ...baseConfig,
      upstream: { claude: "https://test.com" },
    };
    expect(hasUpstreamConfig(config)).toBe(true);
  });

  it("generates complete valid YAML for Claude only", () => {
    const config: HeadroomRuntimeConfig = {
      ...baseConfig,
      upstream: {
        claude: "https://claude.proxy.com/v1",
      },
    };

    const yaml = generateUpstreamConfig(config);
    expect(yaml).toBe(`anthropic:
  base_url: https://claude.proxy.com/v1
`);
  });

  it("generates complete valid YAML for OpenAI only", () => {
    const config: HeadroomRuntimeConfig = {
      ...baseConfig,
      upstream: {
        openai: "https://openai.proxy.com/v1",
      },
    };

    const yaml = generateUpstreamConfig(config);
    expect(yaml).toBe(`openai:
  base_url: https://openai.proxy.com/v1
`);
  });

  it("generates complete valid YAML for both providers", () => {
    const config: HeadroomRuntimeConfig = {
      ...baseConfig,
      upstream: {
        claude: "https://claude.proxy.com",
        openai: "https://openai.proxy.com/v1",
      },
    };

    const yaml = generateUpstreamConfig(config);
    expect(yaml).toBe(`anthropic:
  base_url: https://claude.proxy.com

openai:
  base_url: https://openai.proxy.com/v1
`);
  });

  it("returns empty string for upstream with empty values", () => {
    const config: HeadroomRuntimeConfig = {
      ...baseConfig,
      upstream: {},
    };

    expect(generateUpstreamConfig(config)).toBe("");
    expect(hasUpstreamConfig(config)).toBe(false);
  });

  it("hasUpstreamConfig returns false for undefined upstream", () => {
    const config: HeadroomRuntimeConfig = {
      ...baseConfig,
      upstream: undefined,
    };

    expect(hasUpstreamConfig(config)).toBe(false);
  });

  it("hasUpstreamConfig returns false for empty upstream object", () => {
    const config: HeadroomRuntimeConfig = {
      ...baseConfig,
      upstream: {},
    };

    expect(hasUpstreamConfig(config)).toBe(false);
  });

  it("hasUpstreamConfig returns true for claude only", () => {
    const config: HeadroomRuntimeConfig = {
      ...baseConfig,
      upstream: { claude: "https://test.com" },
    };

    expect(hasUpstreamConfig(config)).toBe(true);
  });

  it("hasUpstreamConfig returns true for openai only", () => {
    const config: HeadroomRuntimeConfig = {
      ...baseConfig,
      upstream: { openai: "https://test.com" },
    };

    expect(hasUpstreamConfig(config)).toBe(true);
  });

  it("hasUpstreamConfig returns true for both providers", () => {
    const config: HeadroomRuntimeConfig = {
      ...baseConfig,
      upstream: { claude: "https://test.com", openai: "https://test.com" },
    };

    expect(hasUpstreamConfig(config)).toBe(true);
  });
});
