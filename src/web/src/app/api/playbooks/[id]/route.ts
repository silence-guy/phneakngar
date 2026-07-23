import { NextRequest } from "next/server";
import {
  UpdatePlaybookRequestSchema,
  queries,
  type PlaybookDefinition,
} from "@phneakngar/shared";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { parseBody, writeError, writeJSON } from "@/lib/middleware/helpers";
import { playbookToResponse } from "@/lib/api/responses";

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB);
  const id = ctx.params?.id;
  if (!id) return writeError("playbook id is required", 400);

  const row = await queries.playbook.getPlaybook(db, id, ws.workspaceId);
  if (!row) return writeError("playbook not found", 404);

  return writeJSON({ playbook: playbookToResponse(row) });
});

export const PATCH = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB);
  const id = ctx.params?.id;
  if (!id) return writeError("playbook id is required", 400);

  const [body, err] = await parseBody(req, UpdatePlaybookRequestSchema);
  if (err) return err;

  const existing = await queries.playbook.getPlaybook(db, id, ws.workspaceId);
  if (!existing) return writeError("playbook not found", 404);

  if (body.agent_id) {
    const agent = await queries.agent.getAgent(db, body.agent_id, ws.workspaceId, ctx.userId);
    if (!agent) return writeError("agent not found in workspace", 404);
  }

  const patch: {
    title?: string;
    description?: string;
    agentId?: string | null;
    definition?: PlaybookDefinition;
    version?: number;
  } = {};

  if (body.title !== undefined) patch.title = body.title;
  if (body.description !== undefined) patch.description = body.description;
  if (body.agent_id !== undefined) patch.agentId = body.agent_id;
  if (body.definition !== undefined) {
    patch.definition = body.definition;
    // Editing steps of a published playbook bumps the version; in-flight runs
    // keep their snapshot taken at start time.
    if (existing.status === "published") patch.version = existing.version + 1;
  }

  const updated = await queries.playbook.updatePlaybook(db, id, ws.workspaceId, patch);
  if (!updated) return writeError("playbook not found", 404);

  return writeJSON({ playbook: playbookToResponse(updated) });
});

export const DELETE = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB);
  const id = ctx.params?.id;
  if (!id) return writeError("playbook id is required", 400);

  const deleted = await queries.playbook.deletePlaybook(db, id, ws.workspaceId);
  if (!deleted) return writeError("playbook not found", 404);

  return new Response(null, { status: 204 });
});
