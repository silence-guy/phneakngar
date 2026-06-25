import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { spawnSync } from "child_process";
import { normalizeHeadroomRuntimeConfig } from "./headroom/config.js";
import { headroomProxyUrl } from "./headroom/env.js";

const DEFAULT_HEALTH_PORT = Number(process.env.ALOOK_HEALTH_PORT) || 19514;

export type HeadroomHealthStatus = "disabled" | "available" | "missing";

export interface HeadroomHealth {
  status: HeadroomHealthStatus;
  configured: boolean;
  available: boolean;
  mode: "proxy";
  port: number;
  executable: string;
  proxy_url: string;
}

interface HealthServerOptions {
  detectHeadroom?: () => HeadroomHealth;
}

function executableName(executable: string): string {
  const normalized = executable.replace(/\\/g, "/");
  return normalized.split("/").pop() || "headroom";
}

function canRunExecutable(executable: string, env: NodeJS.ProcessEnv): boolean {
  const result = spawnSync(executable, ["--version"], {
    env,
    stdio: "ignore",
  });
  return !result.error && result.status === 0;
}

export function detectHeadroomHealth(env: NodeJS.ProcessEnv = process.env): HeadroomHealth {
  const config = normalizeHeadroomRuntimeConfig(undefined, env);
  const available = canRunExecutable(config.executable, env);

  return {
    status: config.enabled ? (available ? "available" : "missing") : "disabled",
    configured: config.enabled,
    available,
    mode: config.mode,
    port: config.port,
    executable: executableName(config.executable),
    proxy_url: headroomProxyUrl(config),
  };
}

export function createHealthServer(
  port: number = DEFAULT_HEALTH_PORT,
  options: HealthServerOptions = {},
) {
  let runtimeCount = 0;
  let headroom = options.detectHeadroom?.() ?? detectHeadroomHealth();
  const startTime = Date.now();

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.url === "/health") {
      const uptimeSec = Math.floor((Date.now() - startTime) / 1000);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          uptime: `${uptimeSec}s`,
          runtimes: runtimeCount,
          headroom,
        }),
      );
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(port, "127.0.0.1");

  return {
    server,
    setRuntimeCount(n: number) {
      runtimeCount = n;
    },
    setHeadroomStatus(next: HeadroomHealth) {
      headroom = next;
    },
  };
}
