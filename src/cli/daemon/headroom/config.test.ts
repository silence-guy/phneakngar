import { describe, expect, it } from "vitest";
import { normalizeHeadroomRuntimeConfig, resolveHeadroomPaths } from "./config.js";

describe("normalizeHeadroomRuntimeConfig", () => {
  it("defaults Headroom off", () => {
    expect(normalizeHeadroomRuntimeConfig(undefined, {})).toMatchObject({
      enabled: false,
      mode: "proxy",
      requireOptimization: false,
      outputShaper: false,
      memory: false,
      ccr: false,
      port: 8787,
      executable: "headroom",
    });
  });

  it("reads safe per-agent Headroom options", () => {
    const config = normalizeHeadroomRuntimeConfig(
      {
        model: "claude-sonnet",
        headroom: {
          enabled: true,
          requireOptimization: true,
          outputShaper: true,
          memory: true,
          ccr: true,
          port: 18787,
        },
      },
      { PHNEAKNGAR_HEADROOM_PATH: "/opt/headroom/bin/headroom" },
    );

    expect(config).toMatchObject({
      enabled: true,
      requireOptimization: true,
      outputShaper: true,
      memory: true,
      ccr: true,
      port: 18787,
      executable: "/opt/headroom/bin/headroom",
    });
  });

  it("lets ភ្នាក់ងារ env override the proxy port", () => {
    const config = normalizeHeadroomRuntimeConfig(
      { headroom: { enabled: true, port: 18787 } },
      { PHNEAKNGAR_HEADROOM_PORT: "18888" },
    );

    expect(config.port).toBe(18888);
  });

  it("rejects unsafe ports and falls back to the default", () => {
    const config = normalizeHeadroomRuntimeConfig(
      { headroom: { enabled: true, port: 80 } },
      {},
    );

    expect(config.port).toBe(8787);
  });
});

describe("resolveHeadroomPaths", () => {
  it("keeps Headroom state under the ភ្នាក់ងារ local root", () => {
    expect(resolveHeadroomPaths("/tmp/phneakngar-root")).toEqual({
      configDir: "/tmp/phneakngar-root/headroom/config",
      workspaceDir: "/tmp/phneakngar-root/headroom/workspace",
      savingsPath: "/tmp/phneakngar-root/headroom/savings.json",
    });
  });
});
