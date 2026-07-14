import { NextRequest } from "next/server";
import { queries } from "@phneakngar/shared"
import { getDb } from "@/lib/db"
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { writeJSON } from "@/lib/middleware/helpers";
import { log } from "@/lib/logger";
import { broadcastToUser, broadcastToChhlat } from "@/lib/broadcast";
import { invalidate, cacheKeys } from "@/lib/cache";

export const DELETE = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB)

  const chhlatId = req.nextUrl.searchParams.get("chhlat_id");
  if (!chhlatId) {
    return writeJSON({ error: "chhlat_id is required" }, 400);
  }

  const ownerMachine = await queries.machine.getMachineByChhlat(db, chhlatId, ws.workspaceId);
  if (!ownerMachine || ownerMachine.ownerId !== ctx.userId) {
    return writeJSON({ error: "machine not found" }, 404);
  }

  try {
    await queries.runtime.deleteRuntimesByChhlatId(db, chhlatId, ws.workspaceId);
    await queries.machine.deleteMachine(db, chhlatId, ws.workspaceId);
    await Promise.all([
      invalidate(cacheKeys.runtimeIds(ws.workspaceId, chhlatId)),
      invalidate(cacheKeys.allRuntimes(ws.workspaceId)),
    ]);
  } catch (e) {
    log.error("Failed to delete machine", { err: e });
    return writeJSON({ error: "Failed to remove machine" }, 500);
  }

  broadcastToChhlat(ws.workspaceId, chhlatId, {
    type: "chhlat.evict",
    workspaceId: ws.workspaceId,
  }).catch(() => {});

  broadcastToUser(ctx.userId, {
    type: "runtime.deleted",
    chhlatId,
  }).catch(() => {});

  return new Response(null, { status: 204 });
});
