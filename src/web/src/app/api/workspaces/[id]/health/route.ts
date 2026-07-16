import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { writeJSON, writeError } from "@/lib/middleware/helpers";
import { getWorkspaceHealth } from "@/lib/services/workspace-health";
import { cached, cacheKeys } from "@/lib/cache";

export const GET = withAuth(async (req, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const id = ctx.params?.id;
  if (id && id !== ws.workspaceId) {
    return writeError("workspace not found", 404);
  }

  const db = getDb(ctx.env.DB);
  const cacheKey = cacheKeys.workspaceHealth(ws.workspaceId);
  const health = await cached(cacheKey, 30, async () => {
    return getWorkspaceHealth(db, ws.workspaceId, {
      gatewayEnv: {
        GATEWAY_TEAM_MAP: ctx.env.GATEWAY_TEAM_MAP,
        GATEWAY_WEBHOOK_SECRET: ctx.env.GATEWAY_WEBHOOK_SECRET,
      },
    });
  });
  return writeJSON(health);
});
