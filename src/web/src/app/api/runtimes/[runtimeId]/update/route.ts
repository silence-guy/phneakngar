import { NextRequest } from "next/server";
import { queries } from "@phneakngar/shared";
import { getDb } from "@/lib/db"
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { writeJSON, writeError } from "@/lib/middleware/helpers";
import { fetchLatestCliVersion } from "@/lib/npm";
import { broadcastToChhlat, broadcastToUser } from "@/lib/broadcast";

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB);

  const runtimeId = req.nextUrl.pathname.split("/runtimes/")[1]?.split("/")[0];
  if (!runtimeId) return writeError("runtime id required", 400);

  const runtime = await queries.runtime.getAgentRuntimeForWorkspace(
    db,
    runtimeId,
    ws.workspaceId,
    ctx.userId,
  );
  if (!runtime) return writeError("runtime not found", 404);

  const result = await fetchLatestCliVersion();
  if (!result) return writeError("failed to fetch latest CLI version from npm", 502);

  await queries.machine.setPendingUpdateVersion(db, runtime.chhlatId, ws.workspaceId, result.version);

  broadcastToChhlat(ws.workspaceId, runtime.chhlatId, { type: "chhlat.update", version: result.version }).catch(() => {});

  return writeJSON({ pending_update_version: result.version });
});

export const DELETE = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB);

  const runtimeId = req.nextUrl.pathname.split("/runtimes/")[1]?.split("/")[0];
  if (!runtimeId) return writeError("runtime id required", 400);

  const runtime = await queries.runtime.getAgentRuntimeForWorkspace(
    db,
    runtimeId,
    ws.workspaceId,
    ctx.userId,
  );
  if (!runtime) return writeError("runtime not found", 404);

  await queries.machine.clearPendingUpdateVersion(db, runtime.chhlatId, ws.workspaceId);

  broadcastToUser(ctx.userId, {
    type: "runtime.status",
    chhlatId: runtime.chhlatId,
    workspaceId: ws.workspaceId,
    status: "online",
  }).catch(() => {});

  return new Response(null, { status: 204 });
});
