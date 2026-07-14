import { NextRequest } from "next/server";
import { queries } from "@phneakngar/shared";
import { getDb } from "@/lib/db"
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { writeJSON, writeError } from "@/lib/middleware/helpers";

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const id = ctx.params?.id as string;
  const db = getDb(ctx.env.DB);

  const row = await queries.artifact.getArtifactForOwner(db, id, ws.workspaceId, ctx.userId);
  if (!row) {
    return writeError("not found", 404);
  }

  return writeJSON(queries.artifact.artifactToResponse(row));
});
