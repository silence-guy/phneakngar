import { normalizeHeadroomRuntimeConfig, resolveHeadroomPaths } from "./config.js";
import { buildProviderHeadroomEnv } from "./env.js";
import { ensureHeadroomProxy } from "./supervisor.js";
const SUPPORTED_PROVIDERS = new Set(["claude", "codex", "opencode"]);
export async function prepareHeadroomForTask(task, provider, deps = {}) {
    const config = normalizeHeadroomRuntimeConfig(task.agent?.runtimeConfig);
    if (!config.enabled) {
        return { status: "disabled", env: {}, requireOptimization: false };
    }
    if (!SUPPORTED_PROVIDERS.has(provider)) {
        return {
            status: "failed",
            env: {},
            requireOptimization: config.requireOptimization,
            diagnostic: `Headroom is not configured for provider: ${provider}`,
        };
    }
    const paths = (deps.resolvePaths ?? resolveHeadroomPaths)();
    const proxy = await (deps.ensureProxy ?? ensureHeadroomProxy)(config, paths);
    if (proxy.status !== "ready") {
        return {
            status: "failed",
            env: {},
            requireOptimization: config.requireOptimization,
            diagnostic: proxy.reason ?? "Headroom proxy unavailable",
        };
    }
    const action = proxy.started ? "started" : "reused";
    return {
        status: "ready",
        env: buildProviderHeadroomEnv(provider, config, paths),
        requireOptimization: config.requireOptimization,
        diagnostic: `Headroom proxy ${action} on 127.0.0.1:${config.port}`,
    };
}
export { normalizeHeadroomRuntimeConfig, resolveHeadroomPaths } from "./config.js";
export { buildProviderHeadroomEnv, buildHeadroomProcessEnv } from "./env.js";
export { ensureHeadroomProxy } from "./supervisor.js";
export { hasUpstreamConfig, generateUpstreamConfig } from "./config-generator.js";
