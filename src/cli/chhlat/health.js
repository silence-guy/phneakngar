import { createServer } from "http";
import { spawn } from "child_process";
import { normalizeHeadroomRuntimeConfig } from "./headroom/config.js";
import { headroomProxyUrl } from "./headroom/env.js";
const DEFAULT_HEALTH_PORT = Number(process.env.PHNEAKNGAR_HEALTH_PORT) || 19514;
const EXECUTABLE_CHECK_TTL_MS = 30_000; // binary doesn't change at runtime
function executableName(executable) {
    const normalized = executable.replace(/\\/g, "/");
    return normalized.split("/").pop() || "headroom";
}
function canRunExecutable(executable, env) {
    return new Promise((resolve) => {
        const child = spawn(executable, ["--version"], { env, stdio: "ignore" });
        child.on("exit", (code) => resolve(code === 0));
        child.on("error", () => resolve(false));
    });
}
function headroomNextActions(configured, available) {
    if (configured && available)
        return [];
    if (configured)
        return ["install_headroom", "configure_headroom_path"];
    return available ? ["enable_headroom"] : ["enable_headroom", "install_headroom"];
}
let cachedAvailable = null;
let cachedAvailableAt = 0;
export function resetHealthCache() {
    cachedAvailable = null;
    cachedAvailableAt = 0;
}
export async function detectHeadroomHealth(env = process.env) {
    const config = normalizeHeadroomRuntimeConfig(undefined, env);
    const now = Date.now();
    if (cachedAvailable === null || now - cachedAvailableAt > EXECUTABLE_CHECK_TTL_MS) {
        cachedAvailable = await canRunExecutable(config.executable, env);
        cachedAvailableAt = now;
    }
    const configured = config.enabled;
    return {
        status: configured ? (cachedAvailable ? "available" : "missing") : "disabled",
        configured,
        available: cachedAvailable,
        mode: config.mode,
        port: config.port,
        executable: executableName(config.executable),
        proxy_url: headroomProxyUrl(config),
        next_actions: headroomNextActions(configured, cachedAvailable),
    };
}
export function createHealthServer(port = DEFAULT_HEALTH_PORT, options = {}) {
    let runtimeCount = 0;
    const detect = options.detectHeadroom ?? detectHeadroomHealth;
    const DETECT_TTL_MS = options.detectTtlMs ?? 5000;
    let override = null;
    let cached = null;
    let cachedAt = 0;
    async function currentHeadroom() {
        if (override)
            return override;
        const now = Date.now();
        if (!cached || now - cachedAt > DETECT_TTL_MS) {
            cached = await detect();
            cachedAt = now;
        }
        return cached;
    }
    const startTime = Date.now();
    const server = createServer(async (req, res) => {
        if (req.url === "/health") {
            const uptimeSec = Math.floor((Date.now() - startTime) / 1000);
            const headroom = await currentHeadroom();
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                status: "ok",
                uptime: `${uptimeSec}s`,
                runtimes: runtimeCount,
                headroom,
            }));
        }
        else {
            res.writeHead(404);
            res.end();
        }
    });
    server.listen(port, "127.0.0.1");
    return {
        server,
        setRuntimeCount(n) {
            runtimeCount = n;
        },
        setHeadroomStatus(next) {
            override = next;
        },
    };
}
