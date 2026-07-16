import { NextRequest } from "next/server";
import { CreateAutomationRequestSchema, queries } from "@phneakngar/shared";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { parseBody, writeError, writeJSON } from "@/lib/middleware/helpers";
import { automationToResponse } from "@/lib/api/responses";

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB);
  const agentId = req.nextUrl.searchParams.get("agent_id") ?? undefined;
  const enabledParam = req.nextUrl.searchParams.get("enabled");
  let enabled: boolean | undefined;
  if (enabledParam === "true") enabled = true;
  else if (enabledParam === "false") enabled = false;

  const rows = await queries.automation.listAutomations(db, ws.workspaceId, {
    agentId,
    enabled,
  });

  return writeJSON({ items: rows.map(automationToResponse) });
});

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB);
  const [body, err] = await parseBody(req, CreateAutomationRequestSchema);
  if (err) return err;

  const agent = await queries.agent.getAgent(db, body.agent_id, ws.workspaceId, ctx.userId);
  if (!agent) return writeError("agent not found in workspace", 404);

  if (body.delivery_channel_id) {
    const channel = await queries.channel.getChannelById(
      db,
      body.delivery_channel_id,
      ws.workspaceId,
    );
    if (!channel) return writeError("delivery channel not found in workspace", 404);
  }

  const nextRunDate = new Date(body.next_run_at);
  if (Number.isNaN(nextRunDate.getTime())) {
    return writeError("next_run_at must be a valid ISO datetime", 400);
  }

  const row = await queries.automation.createAutomation(db, {
    workspaceId: ws.workspaceId,
    agentId: body.agent_id,
    title: body.title,
    sopMarkdown: body.sop_markdown,
    schedule: body.schedule,
    nextRunAt: nextRunDate.toISOString(),
    deliveryMode: body.delivery_mode,
    deliveryChannelId: body.delivery_channel_id ?? null,
    skillName: body.skill_name ?? null,
    enabled: body.enabled,
  });

  return writeJSON({ automation: automationToResponse(row) }, 201);
});
