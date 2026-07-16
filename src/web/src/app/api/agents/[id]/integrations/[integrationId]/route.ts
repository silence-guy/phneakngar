import { NextRequest } from "next/server";
import { queries } from "@phneakngar/shared";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { writeError, writeJSON } from "@/lib/middleware/helpers";

export const DELETE = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB);
  const agentId = ctx.params?.id;
  const integrationId = ctx.params?.integrationId;
  if (!agentId || !integrationId) return writeError("missing params", 400);

  const agent = await queries.agent.getAgent(db, agentId, ws.workspaceId, ctx.userId);
  if (!agent) return writeError("agent not found", 404);

  const deleted = await queries.agentIntegration.deleteIntegration(
    db,
    integrationId,
    ws.workspaceId,
    agentId
  );
  if (!deleted) return writeError("integration not found", 404);

  return writeJSON({ ok: true });
});
