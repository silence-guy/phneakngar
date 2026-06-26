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
      port: 8799,
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

    expect(config.port).toBe(8799);
  });

  it("force-enables via env even when per-agent config is off", () => {
    const config = normalizeHeadroomRuntimeConfig(
      { headroom: { enabled: false } },
      { PHNEAKNGAR_HEADROOM_ENABLED: "1" },
    );

    expect(config.enabled).toBe(true);
  });

  it("force-disables via env even when per-agent config is on (fleet kill switch)", () => {
    const config = normalizeHeadroomRuntimeConfig(
      { headroom: { enabled: true } },
      { PHNEAKNGAR_HEADROOM_ENABLED: "false" },
    );

    expect(config.enabled).toBe(false);
  });

  it("treats env 0/off/no as force-disable", () => {
    for (const value of ["0", "off", "no"]) {
      const config = normalizeHeadroomRuntimeConfig(
        { headroom: { enabled: true } },
        { PHNEAKNGAR_HEADROOM_ENABLED: value },
      );
      expect(config.enabled).toBe(false);
    }
  });

  it("defers to per-agent config when env is unset or empty", () => {
    expect(
      normalizeHeadroomRuntimeConfig({ headroom: { enabled: true } }, {}).enabled,
    ).toBe(true);
    expect(
      normalizeHeadroomRuntimeConfig({ headroom: { enabled: false } }, {}).enabled,
    ).toBe(false);
    expect(
      normalizeHeadroomRuntimeConfig(
        { headroom: { enabled: true } },
        { PHNEAKNGAR_HEADROOM_ENABLED: "" },
      ).enabled,
    ).toBe(true);
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
