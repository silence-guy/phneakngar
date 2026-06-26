import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { writeJSON, writeError } from "@/lib/middleware/helpers";
import { getWorkspaceHealth } from "@/lib/services/workspace-health";

export const GET = withAuth(async (req, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const id = ctx.params?.id;
  if (id && id !== ws.workspaceId) {
    return writeError("workspace not found", 404);
  }

  const db = getDb(ctx.env.DB);
  const health = await getWorkspaceHealth(db, ws.workspaceId);
  return writeJSON(health);
});
