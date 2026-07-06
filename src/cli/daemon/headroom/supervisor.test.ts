import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { createServer, type Server } from "http";
import { afterEach, describe, expect, it, type SpyInstance } from "vitest";
import { ensureHeadroomProxy, canConnectToHeadroom } from "./supervisor.js";
import type { HeadroomPaths, HeadroomRuntimeConfig } from "./config.js";

function existsSync(path: string): boolean {
  try {
    require("fs").accessSync(path);
    return true;
  } catch {
    return false;
  }
}

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

// Use plain functions instead of vi.fn() for bun test compatibility
type CanConnectFn = (port: number) => Promise<boolean>;
type CanRunFn = (cmd: string, env: NodeJS.ProcessEnv) => Promise<boolean>;
type WaitFn = (ms: number) => Promise<void>;
type SpawnFn = (cmd: string, args: string[], opts: unknown) => { unref: () => void };

describe("ensureHeadroomProxy", () => {
  afterEach(() => {
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns disabled without probing when Headroom is off", async () => {
    const canConnect: CanConnectFn = async () => true;
    const result = await ensureHeadroomProxy({ ...config, enabled: false }, makePaths(), { canConnect });

    expect(result).toEqual({ status: "disabled" });
  });

  it("reuses an already-listening proxy", async () => {
    const canConnect: CanConnectFn = async () => true;
    const canRun: CanRunFn = async () => false;
    const result = await ensureHeadroomProxy(config, makePaths(), { canConnect, canRun });

    expect(result).toEqual({ status: "ready", started: false });
  });

  it("reports a missing Headroom executable", async () => {
    const canConnect: CanConnectFn = async () => false;
    const canRun: CanRunFn = async () => false;
    const result = await ensureHeadroomProxy(config, makePaths(), { canConnect, canRun });

    expect(result).toEqual({
      status: "failed",
      reason: "Headroom executable not found: headroom",
    });
  });

  it("starts the proxy and waits for readiness", async () => {
    const spawn: SpawnFn = () => ({ unref: () => {} });
    let connectCalls = 0;
    const canConnect: CanConnectFn = async () => {
      connectCalls++;
      // Return false for first 2 calls, then true
      return connectCalls >= 2;
    };
    const canRun: CanRunFn = async () => true;
    const wait: WaitFn = async () => {};

    const result = await ensureHeadroomProxy(config, makePaths(), { spawn, canConnect, canRun, wait });

    expect(result).toEqual({ status: "ready", started: true });
  });

  it("writes upstream.yaml when third-party providers are configured", async () => {
    const spawn: SpawnFn = () => ({ unref: () => {} });
    let connectCalls = 0;
    const canConnect: CanConnectFn = async () => {
      connectCalls++;
      return connectCalls >= 1; // True on first call (proxy already listening)
    };
    const canRun: CanRunFn = async () => true;
    const wait: WaitFn = async () => {};

    const configWithUpstream: HeadroomRuntimeConfig = {
      enabled: true,
      mode: "proxy",
      requireOptimization: false,
      outputShaper: false,
      memory: false,
      ccr: false,
      port: 8787,
      executable: "headroom",
      upstream: {
        claude: "https://custom.anthropic.com",
        openai: "https://custom.openai.com/v1",
      },
    };

    const paths = makePaths();
    await ensureHeadroomProxy(configWithUpstream, paths, { spawn, canConnect, canRun, wait });

    // Verify upstream.yaml was written
    const upstreamPath = `${paths.configDir}/upstream.yaml`;
    expect(existsSync(upstreamPath)).toBe(true);
    const content = require("fs").readFileSync(upstreamPath, "utf-8");
    expect(content).toContain("anthropic:");
    expect(content).toContain("base_url: https://custom.anthropic.com");
    expect(content).toContain("openai:");
    expect(content).toContain("base_url: https://custom.openai.com/v1");
  });

  it("does not write upstream.yaml when no upstream configured", async () => {
    const spawn: SpawnFn = () => ({ unref: () => {} });
    const canConnect: CanConnectFn = async () => false;
    const canRun: CanRunFn = async () => true;
    const wait: WaitFn = async () => {};

    const paths = makePaths();
    await ensureHeadroomProxy(config, paths, { spawn, canConnect, canRun, wait });

    // Verify upstream.yaml was NOT written
    const upstreamPath = `${paths.configDir}/upstream.yaml`;
    expect(existsSync(upstreamPath)).toBe(false);
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
