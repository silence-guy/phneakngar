import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { createServer, type Server } from "http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureHeadroomProxy, canConnectToHeadroom } from "./supervisor.js";
import type { HeadroomPaths, HeadroomRuntimeConfig } from "./config.js";

const roots: string[] = [];

function makePaths(): HeadroomPaths {
  const root = mkdtempSync(join(tmpdir(), "phneakngar-headroom-"));
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

describe("canConnectToHeadroom (identity handshake)", () => {
  const servers: Server[] = [];

  function listen(handler: (req: unknown, res: any) => void): Promise<number> {
    return new Promise((resolve) => {
      const server = createServer(handler as never);
      servers.push(server);
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        resolve(typeof addr === "object" && addr ? addr.port : 0);
      });
    });
  }

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map((s) => new Promise<void>((r) => s.close(() => r()))),
    );
  });

  it("rejects a foreign listener with no Headroom signature (e.g. wrangler)", async () => {
    const port = await listen((_req, res) => {
      res.writeHead(200, { "content-type": "text/html", server: "workerd" });
      res.end("<html>wrangler</html>");
    });

    expect(await canConnectToHeadroom(port)).toBe(false);
  });

  it("accepts a listener that identifies as Headroom via header", async () => {
    const port = await listen((_req, res) => {
      res.writeHead(200, { "x-headroom-version": "1.0.0" });
      res.end("ok");
    });

    expect(await canConnectToHeadroom(port)).toBe(true);
  });

  it("accepts a listener with a headroom Server banner", async () => {
    const port = await listen((_req, res) => {
      res.writeHead(200, { server: "Headroom/1.0" });
      res.end("ok");
    });

    expect(await canConnectToHeadroom(port)).toBe(true);
  });

  it("returns false when nothing is listening", async () => {
    // Port 1 is privileged and not listening in test env → connection refused.
    expect(await canConnectToHeadroom(1)).toBe(false);
  });
});
