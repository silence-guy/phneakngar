import { spawn as nodeSpawn, type ChildProcess } from "child_process";
import { createConnection } from "net";
import type { HeadroomPaths, HeadroomRuntimeConfig, HeadroomStatus } from "./config.js";
import { ensureHeadroomDirs } from "./config.js";
import { buildHeadroomProcessEnv } from "./env.js";

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

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function canConnectToHeadroom(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    const done = (ok: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(500);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
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
