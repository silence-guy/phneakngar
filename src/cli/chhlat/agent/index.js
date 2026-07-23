import { ClaudeBackend } from "./claude.js";
import { CodexBackend } from "./codex.js";
import { OpenCodeBackend } from "./opencode.js";
import { GrokBackend } from "./grok.js";
import { execSync } from "child_process";
export function descriptorFromDriver(backend) {
    return {
        lifecycle: backend.lifecycle ?? { kind: "per_turn" },
        busyDeliveryMode: backend.busyDeliveryMode ?? "none",
        supportsStdinNotification: backend.supportsStdinNotification ?? false,
    };
}
export function createBackend(provider, cliPath) {
    switch (provider) {
        case "claude":
            return new ClaudeBackend(cliPath);
        case "codex":
            return new CodexBackend(cliPath);
        case "opencode":
            return new OpenCodeBackend(cliPath);
        case "grok":
            return new GrokBackend(cliPath);
        default:
            throw new Error(`Unknown provider: ${provider}`);
    }
}
export async function detectVersion(cliPath) {
    try {
        return execSync(`${cliPath} --version`, { encoding: "utf-8" }).trim();
    }
    catch {
        return "unknown";
    }
}
