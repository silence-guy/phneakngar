import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureHeadroomProxy } from "./supervisor.js";
import type { HeadroomPaths, HeadroomRuntimeConfig } from "./config.js";

const roots: string[] = [];

function makePaths(): HeadroomPaths {
  const root = mkdtempSync(join(tmpdir(), "alook-headroom-"));
  roots.push(root);
  return {
    configDir: join(root, "config"),
    workspaceDir: join(root, "workspace"),
    savingsPath: join(root, "savings.json"),
  };
}

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

describe("ensureHeadroomProxy", () => {
  afterEach(() => {
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns disabled without probing when Headroom is off", async () => {
    const canConnect = vi.fn(async () => true);
    const result = await ensureHeadroomProxy({ ...config, enabled: false }, makePaths(), { canConnect });

    expect(result).toEqual({ status: "disabled" });
    expect(canConnect).not.toHaveBeenCalled();
  });

  it("reuses an already-listening proxy", async () => {
    const canConnect = vi.fn(async () => true);
    const canRun = vi.fn(async () => false);
    const result = await ensureHeadroomProxy(config, makePaths(), { canConnect, canRun });

    expect(result).toEqual({ status: "ready", started: false });
    expect(canRun).not.toHaveBeenCalled();
  });

  it("reports a missing Headroom executable", async () => {
    const result = await ensureHeadroomProxy(config, makePaths(), {
      canConnect: vi.fn(async () => false),
      canRun: vi.fn(async () => false),
    });

    expect(result).toEqual({
      status: "failed",
      reason: "Headroom executable not found: headroom",
    });
  });

  it("starts the proxy and waits for readiness", async () => {
    const spawn = vi.fn(() => ({ unref: vi.fn() })) as any;
    const canConnect = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const result = await ensureHeadroomProxy(config, makePaths(), {
      spawn,
      canConnect,
      canRun: vi.fn(async () => true),
      wait: vi.fn(async () => undefined),
    });

    expect(result).toEqual({ status: "ready", started: true });
    expect(spawn).toHaveBeenCalledWith(
      "headroom",
      ["proxy", "--host", "127.0.0.1", "--port", "8787"],
      expect.objectContaining({ detached: expect.any(Boolean), stdio: "ignore" }),
    );
  });
});
