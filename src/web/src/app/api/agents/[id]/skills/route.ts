import { NextRequest } from "next/server";
import { queries } from "@phneakngar/shared";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { writeJSON, writeError } from "@/lib/middleware/helpers";
import { getDb } from "@/lib/db";

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const db = getDb(ctx.env.DB);

  const agentId = ctx.params?.id;
  if (!agentId) return writeError("agent id required", 400);

  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const agent = await queries.agent.getAgent(db, agentId, ws.workspaceId, ctx.userId);
  if (!agent) return writeError("agent not found", 404);

  const KNOWN_RUNTIMES = ["claude", "codex", "opencode"] as const;

  let runtime: string = "claude";
  if (agent.runtimeId) {
    const rt = await queries.runtime.getAgentRuntime(db, agent.runtimeId);
    if (rt) runtime = rt.provider;
  }

  if (!KNOWN_RUNTIMES.includes(runtime as typeof KNOWN_RUNTIMES[number])) {
    console.warn(`[skills] Unknown runtime "${runtime}" for agent ${agentId}, defaulting to "claude"`);
    runtime = "claude";
  }

  const skills = await queries.agentSkill.getSkills(db, agentId, runtime, ws.workspaceId);

  return writeJSON({ skills });
});
