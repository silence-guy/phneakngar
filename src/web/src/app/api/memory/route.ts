import { NextRequest } from "next/server";
import { CreateMemoryRequestSchema, queries } from "@phneakngar/shared";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { parseBody, writeError, writeJSON } from "@/lib/middleware/helpers";
import { memoryToResponse } from "@/lib/api/responses";

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB);
  const agentId = req.nextUrl.searchParams.get("agent_id");
  const kind = req.nextUrl.searchParams.get("kind") ?? undefined;
  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 100, 1), 200) : 100;

  const rows = await queries.agentMemory.listMemory(db, ws.workspaceId, {
    agentId: agentId || undefined,
    kind,
    limit,
  });

  return writeJSON({ items: rows.map(memoryToResponse) });
});

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB);
  const [body, err] = await parseBody(req, CreateMemoryRequestSchema);
  if (err) return err;

  if (body.agent_id) {
    const agent = await queries.agent.getAgent(db, body.agent_id, ws.workspaceId, ctx.userId);
    if (!agent) return writeError("agent not found in workspace", 404);
  }

  const row = await queries.agentMemory.createMemory(db, {
    workspaceId: ws.workspaceId,
    agentId: body.agent_id ?? null,
    kind: body.kind,
    content: body.content,
    sourceTaskId: body.source_task_id ?? null,
  });

  return writeJSON({ memory: memoryToResponse(row) }, 201);
});
