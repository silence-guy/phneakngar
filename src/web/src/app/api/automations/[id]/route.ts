import { NextRequest } from "next/server";
import { UpdateAutomationRequestSchema, queries } from "@phneakngar/shared";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { parseBody, writeError, writeJSON } from "@/lib/middleware/helpers";
import { automationToResponse } from "@/lib/api/responses";

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB);
  const id = ctx.params?.id;
  if (!id) return writeError("automation id is required", 400);

  const row = await queries.automation.getAutomation(db, id, ws.workspaceId);
  if (!row) return writeError("automation not found", 404);

  return writeJSON({ automation: automationToResponse(row) });
});

export const PATCH = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB);
  const id = ctx.params?.id;
  if (!id) return writeError("automation id is required", 400);

  const [body, err] = await parseBody(req, UpdateAutomationRequestSchema);
  if (err) return err;

  const existing = await queries.automation.getAutomation(db, id, ws.workspaceId);
  if (!existing) return writeError("automation not found", 404);

  if (body.delivery_channel_id) {
    const channel = await queries.channel.getChannelById(
      db,
      body.delivery_channel_id,
      ws.workspaceId,
    );
    if (!channel) return writeError("delivery channel not found in workspace", 404);
  }

  const patch: {
    title?: string;
    sopMarkdown?: string;
    schedule?: string;
    nextRunAt?: string;
    deliveryMode?: string;
    deliveryChannelId?: string | null;
    skillName?: string | null;
    enabled?: boolean;
  } = {};

  if (body.title !== undefined) patch.title = body.title;
  if (body.sop_markdown !== undefined) patch.sopMarkdown = body.sop_markdown;
  if (body.schedule !== undefined) patch.schedule = body.schedule;
  if (body.next_run_at !== undefined) {
    const nextRunDate = new Date(body.next_run_at);
    if (Number.isNaN(nextRunDate.getTime())) {
      return writeError("next_run_at must be a valid ISO datetime", 400);
    }
    patch.nextRunAt = nextRunDate.toISOString();
  }
  if (body.delivery_mode !== undefined) patch.deliveryMode = body.delivery_mode;
  if (body.delivery_channel_id !== undefined) patch.deliveryChannelId = body.delivery_channel_id;
  if (body.skill_name !== undefined) patch.skillName = body.skill_name;
  if (body.enabled !== undefined) patch.enabled = body.enabled;

  const updated = await queries.automation.updateAutomation(db, id, ws.workspaceId, patch);
  if (!updated) return writeError("automation not found", 404);

  return writeJSON({ automation: automationToResponse(updated) });
});

export const DELETE = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB);
  const id = ctx.params?.id;
  if (!id) return writeError("automation id is required", 400);

  const deleted = await queries.automation.deleteAutomation(db, id, ws.workspaceId);
  if (!deleted) return writeError("automation not found", 404);

  return new Response(null, { status: 204 });
});
