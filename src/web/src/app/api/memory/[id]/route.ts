import { NextRequest } from "next/server";
import { UpdateMemoryRequestSchema, queries } from "@phneakngar/shared";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { parseBody, writeError, writeJSON } from "@/lib/middleware/helpers";
import { memoryToResponse } from "@/lib/api/responses";

export const PATCH = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB);
  const id = ctx.params?.id;
  if (!id) return writeError("memory id is required", 400);

  const [body, err] = await parseBody(req, UpdateMemoryRequestSchema);
  if (err) return err;

  const updated = await queries.agentMemory.updateMemory(db, id, ws.workspaceId, {
    content: body.content,
    kind: body.kind,
  });
  if (!updated) return writeError("memory not found", 404);

  return writeJSON({ memory: memoryToResponse(updated) });
});

export const DELETE = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB);
  const id = ctx.params?.id;
  if (!id) return writeError("memory id is required", 400);

  const deleted = await queries.agentMemory.deleteMemory(db, id, ws.workspaceId);
  if (!deleted) return writeError("memory not found", 404);

  return new Response(null, { status: 204 });
});
