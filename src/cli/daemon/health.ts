import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { spawnSync } from "child_process";
import { normalizeHeadroomRuntimeConfig } from "./headroom/config.js";
import { headroomProxyUrl } from "./headroom/env.js";

const DEFAULT_HEALTH_PORT = Number(process.env.PHNEAKNGAR_HEALTH_PORT) || 19514;

export type HeadroomHealthStatus = "disabled" | "available" | "missing";
export type HeadroomNextAction = "enable_headroom" | "install_headroom" | "configure_headroom_path";

export interface HeadroomHealth {
  status: HeadroomHealthStatus;
  configured: boolean;
  available: boolean;
  mode: "proxy";
  port: number;
  executable: string;
  proxy_url: string;
  next_actions: HeadroomNextAction[];
}

interface HealthServerOptions {
  detectHeadroom?: () => HeadroomHealth;
  /** Detection cache TTL in ms (default 5000). Set to 0 to detect every request. */
  detectTtlMs?: number;
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

function headroomNextActions(configured: boolean, available: boolean): HeadroomNextAction[] {
  if (configured && available) return [];
  if (configured) return ["install_headroom", "configure_headroom_path"];
  return available ? ["enable_headroom"] : ["enable_headroom", "install_headroom"];
}

export function detectHeadroomHealth(env: NodeJS.ProcessEnv = process.env): HeadroomHealth {
  const config = normalizeHeadroomRuntimeConfig(undefined, env);
  const available = canRunExecutable(config.executable, env);

  const configured = config.enabled;

  return {
    status: configured ? (available ? "available" : "missing") : "disabled",
    configured,
    available,
    mode: config.mode,
    port: config.port,
    executable: executableName(config.executable),
    proxy_url: headroomProxyUrl(config),
    next_actions: headroomNextActions(configured, available),
  };
}

export function createHealthServer(
  port: number = DEFAULT_HEALTH_PORT,
  options: HealthServerOptions = {},
) {
  let runtimeCount = 0;
  const detect = options.detectHeadroom ?? detectHeadroomHealth;
  // Re-detect on each request (TTL-cached) so /health reflects live state — e.g.
  // a Headroom executable installed after the daemon started. A frozen startup
  // snapshot would report "missing" forever (or stay "available" after removal).
  // An explicit setHeadroomStatus override always wins.
  const DETECT_TTL_MS = options.detectTtlMs ?? 5000;
  let override: HeadroomHealth | null = null;
  let cached: HeadroomHealth | null = null;
  let cachedAt = 0;

  function currentHeadroom(): HeadroomHealth {
    if (override) return override;
    const now = Date.now();
    if (!cached || now - cachedAt > DETECT_TTL_MS) {
      cached = detect();
      cachedAt = now;
    }
    return cached;
  }

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
          headroom: currentHeadroom(),
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
      override = next;
    },
  };
}
