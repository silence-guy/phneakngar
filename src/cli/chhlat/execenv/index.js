import { mkdirSync } from "fs";
import { join } from "path";
import { writeInstructionFileIfChanged } from "./context.js";
export function prepare(config, task) {
    const workDir = join(config.workspacesRoot, task.workspaceId, task.agentId, "workdir");
    mkdirSync(workDir, { recursive: true });
    const timelineDir = join(workDir, ".context_timeline");
    mkdirSync(timelineDir, { recursive: true });
    writeInstructionFileIfChanged(workDir, task);
    const env = {
        PHNEAKNGAR_WORKSPACE_ID: task.workspaceId,
        PHNEAKNGAR_AGENT_ID: task.agentId,
        PHNEAKNGAR_TASK_ID: task.id,
        PHNEAKNGAR_CONVERSATION_ID: task.conversationId,
        PHNEAKNGAR_TRACE_ID: task.traceId ?? "",
        PHNEAKNGAR_CHANNEL: task.channel ?? "default",
        PHNEAKNGAR_HEALTH_PORT: process.env.PHNEAKNGAR_HEALTH_PORT || "19514",
        ...(config.token ? { PHNEAKNGAR_TOKEN: config.token } : {}),
    };
    return { workDir, timelineDir, env };
}
