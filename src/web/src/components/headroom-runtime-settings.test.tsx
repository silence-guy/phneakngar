import { describe, expect, it } from "vitest";
import {
  buildRuntimeConfigWithHeadroom,
  readHeadroomSettings,
} from "./headroom-runtime-settings";

describe("headroom runtime settings helpers", () => {
  it("reads persisted Headroom settings", () => {
    expect(readHeadroomSettings({
      model: "claude-sonnet",
      headroom: { enabled: true, requireOptimization: true, outputShaper: true },
    })).toEqual({
      enabled: true,
      requireOptimization: true,
      outputShaper: true,
    });
  });

  it("preserves existing runtime config keys when enabling Headroom", () => {
    expect(buildRuntimeConfigWithHeadroom(
      {
        model: "old-model",
        custom: "keep",
        headroom: { port: 18787, memory: true },
      },
      "new-model",
      { enabled: true, requireOptimization: false, outputShaper: true },
    )).toEqual({
      model: "new-model",
      custom: "keep",
      headroom: {
        port: 18787,
        memory: true,
        enabled: true,
        mode: "proxy",
        requireOptimization: false,
        outputShaper: true,
      },
    });
  });

  it("removes model and Headroom keys when they are disabled", () => {
    expect(buildRuntimeConfigWithHeadroom(
      { model: "old-model", custom: "keep", headroom: { enabled: true } },
      "",
      { enabled: false, requireOptimization: false, outputShaper: false },
    )).toEqual({ custom: "keep" });
  });
});
