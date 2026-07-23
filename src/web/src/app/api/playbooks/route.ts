import { NextRequest } from "next/server";
import { CreatePlaybookRequestSchema, queries } from "@phneakngar/shared";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { parseBody, writeError, writeJSON } from "@/lib/middleware/helpers";
import { playbookToResponse } from "@/lib/api/responses";

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB);
  const agentId = req.nextUrl.searchParams.get("agent_id") ?? undefined;
  const status = req.nextUrl.searchParams.get("status") ?? undefined;

  const rows = await queries.playbook.listPlaybooks(db, ws.workspaceId, { agentId, status });
  return writeJSON({ items: rows.map(playbookToResponse) });
});

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB);
  const [body, err] = await parseBody(req, CreatePlaybookRequestSchema);
  if (err) return err;

  if (body.agent_id) {
    const agent = await queries.agent.getAgent(db, body.agent_id, ws.workspaceId, ctx.userId);
    if (!agent) return writeError("agent not found in workspace", 404);
  }

  const row = await queries.playbook.createPlaybook(db, {
    workspaceId: ws.workspaceId,
    agentId: body.agent_id ?? null,
    title: body.title,
    description: body.description,
    definition: body.definition,
    createdByUserId: ctx.userId,
  });

  return writeJSON({ playbook: playbookToResponse(row) }, 201);
});
