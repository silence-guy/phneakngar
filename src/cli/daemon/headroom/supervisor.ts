import { mkdirSync, writeFileSync } from "fs";
import { spawn as nodeSpawn, type ChildProcess } from "child_process";
import { request as httpRequest } from "http";
import type { HeadroomPaths, HeadroomRuntimeConfig, HeadroomStatus } from "./config.js";
import { ensureHeadroomDirs } from "./config.js";
import { buildHeadroomProcessEnv } from "./env.js";
import { generateUpstreamConfig, hasUpstreamConfig } from "./config-generator.js";

export interface HeadroomProxyResult {
  status: HeadroomStatus;
  reason?: string;
  started?: boolean;
}

interface SupervisorDeps {
  spawn?: typeof nodeSpawn;
  canConnect?: (port: number) => Promise<boolean>;
  canRun?: (command: string, env: NodeJS.ProcessEnv) => Promise<boolean>;
  wait?: (ms: number) => Promise<void>;
}

const STARTUP_POLLS = 12;
const STARTUP_DELAY_MS = 250;
const PROBE_TIMEOUT_MS = 500;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Verify that the listener on 127.0.0.1:<port> is actually Headroom, not some
 * unrelated process that happens to hold the port (e.g. `wrangler dev`). A bare
 * TCP connect is NOT enough: pointing ANTHROPIC_BASE_URL/OPENAI_BASE_URL at a
 * foreign server would leak provider credentials and silently break requests.
 *
 * Headroom answers its readiness probe with an `x-headroom`/`x-headroom-*`
 * response header (or a `server: headroom...` banner). We require one of those
 * signatures before trusting the proxy.
 */
export function canConnectToHeadroom(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };

    const req = httpRequest(
      { host: "127.0.0.1", port, path: "/", method: "GET", timeout: PROBE_TIMEOUT_MS },
      (res) => {
        const headerNames = Object.keys(res.headers).map((h) => h.toLowerCase());
        const server = String(res.headers["server"] ?? "").toLowerCase();
        const isHeadroom =
          headerNames.some((h) => h === "x-headroom" || h.startsWith("x-headroom-")) ||
          server.includes("headroom");
        // Drain and discard the body so the socket can close promptly.
        res.resume();
        done(isHeadroom);
      },
    );
    req.setTimeout(PROBE_TIMEOUT_MS, () => {
      req.destroy();
      done(false);
    });
    req.once("error", () => done(false));
    req.end();
  });
}

export function canRunHeadroom(
  command: string,
  env: NodeJS.ProcessEnv = process.env,
  spawn: typeof nodeSpawn = nodeSpawn,
): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };

    let proc: ChildProcess;
    try {
      proc = spawn(command, ["--version"], {
        env,
        stdio: "ignore",
        shell: process.platform === "win32",
        windowsHide: true,
      });
    } catch {
      finish(false);
      return;
    }

    proc.once("error", () => finish(false));
    proc.once("exit", (code) => finish(code === 0));
  });
}

export async function ensureHeadroomProxy(
  config: HeadroomRuntimeConfig,
  paths: HeadroomPaths,
  deps: SupervisorDeps = {},
): Promise<HeadroomProxyResult> {
  if (!config.enabled) return { status: "disabled" };

  const canConnect = deps.canConnect ?? canConnectToHeadroom;
  const canRun = deps.canRun ?? canRunHeadroom;
  const waitFor = deps.wait ?? wait;
  const spawn = deps.spawn ?? nodeSpawn;

  ensureHeadroomDirs(paths);

  // Write upstream config if third-party providers are configured
  writeUpstreamConfig(config, paths);

  if (await canConnect(config.port)) {
    return { status: "ready", started: false };
  }

  const processEnv = { ...process.env, ...buildHeadroomProcessEnv(config, paths) };
  if (!(await canRun(config.executable, processEnv))) {
    return { status: "failed", reason: `Headroom executable not found: ${config.executable}` };
  }

  try {
    const proc = spawn(config.executable, ["proxy", "--host", "127.0.0.1", "--port", String(config.port)], {
      env: processEnv,
      stdio: "ignore",
      detached: process.platform !== "win32",
      shell: process.platform === "win32",
      windowsHide: true,
    });
    proc.unref();
  } catch (error) {
    return { status: "failed", reason: `Failed to start Headroom proxy: ${error}` };
  }

  for (let i = 0; i < STARTUP_POLLS; i++) {
    await waitFor(STARTUP_DELAY_MS);
    if (await canConnect(config.port)) {
      return { status: "ready", started: true };
    }
  }

  return { status: "failed", reason: `Headroom proxy did not become ready on 127.0.0.1:${config.port}` };
}

/**
 * Write Headroom upstream configuration to configDir/upstream.yaml
 * if any upstream providers are configured.
 */
function writeUpstreamConfig(
  config: HeadroomRuntimeConfig,
  paths: HeadroomPaths,
): void {
  if (!hasUpstreamConfig(config)) {
    return;
  }

  mkdirSync(paths.configDir, { recursive: true, mode: 0o700 });
  const yaml = generateUpstreamConfig(config);
  const configPath = `${paths.configDir}/upstream.yaml`;
  writeFileSync(configPath, yaml, { mode: 0o600 });
}
