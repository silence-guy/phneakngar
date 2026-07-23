import { readFileSync } from "fs";
export function flagOrEnv(cmd, flagName, envKey, fallback) {
    const opts = cmd.opts();
    if (opts[flagName])
        return opts[flagName];
    if (process.env[envKey])
        return process.env[envKey];
    return fallback;
}
export function resolveAgentId(opts) {
    const id = opts.agent_id || process.env.PHNEAKNGAR_AGENT_ID;
    if (!id) {
        console.error("Error: --agent_id is required (or set PHNEAKNGAR_AGENT_ID env var)");
        process.exit(1);
    }
    return id;
}
export function collectRepeated(value, previous) {
    return previous.concat([value]);
}
export function readBody(opts) {
    if (opts.body && opts.bodyFile) {
        console.error("Error: --body and --body-file are mutually exclusive");
        process.exit(1);
    }
    if (opts.bodyFile)
        return readFileSync(opts.bodyFile, "utf-8");
    return opts.body ?? "";
}
