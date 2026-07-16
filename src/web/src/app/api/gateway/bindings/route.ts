import { NextRequest } from "next/server";
import {
  CreateGatewayBindingRequestSchema,
  isUniqueConstraintError,
  queries,
} from "@phneakngar/shared";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { parseBody, writeError, writeJSON } from "@/lib/middleware/helpers";
import { outboundModeBadge } from "@/lib/services/gateway-live-outbound";

function bindingToResponse(row: {
  id: string;
  workspaceId: string;
  provider: string;
  externalTeamId: string;
  externalAccountId: string | null;
  agentId: string;
  userId: string;
  status: string;
  dmPolicy: string;
  outboundMode: string;
  createdAt: string;
  updatedAt: string;
}) {
  return {
    id: row.id,
    workspace_id: row.workspaceId,
    provider: row.provider,
    external_team_id: row.externalTeamId,
    external_account_id: row.externalAccountId,
    agent_id: row.agentId,
    user_id: row.userId,
    status: row.status,
    dm_policy: row.dmPolicy,
    outbound_mode: row.outboundMode,
    outbound_badge: outboundModeBadge(row.outboundMode),
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB);
  const rows = await queries.gatewayBinding.listGatewayBindings(db, ws.workspaceId);
  return writeJSON({ items: rows.map(bindingToResponse) });
});

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB);
  const [body, err] = await parseBody(req, CreateGatewayBindingRequestSchema);
  if (err) return err;

  const agent = await queries.agent.getAgent(db, body.agent_id, ws.workspaceId, ctx.userId);
  if (!agent) return writeError("agent not found in workspace", 404);

  const userId = body.user_id ?? ctx.userId;
  const member = await queries.member.getMemberByUserAndWorkspace(db, userId, ws.workspaceId);
  if (!member) return writeError("user not a workspace member", 404);

  try {
    const created = await queries.gatewayBinding.createGatewayBinding(db, {
      workspaceId: ws.workspaceId,
      provider: body.provider,
      externalTeamId: body.external_team_id,
      externalAccountId: body.external_account_id ?? null,
      agentId: body.agent_id,
      userId,
      status: body.status,
      dmPolicy: body.dm_policy,
      outboundMode: body.outbound_mode,
    });
    if (!created) return writeError("failed to create binding", 500);
    return writeJSON({ binding: bindingToResponse(created) }, 201);
  } catch (e) {
    if (isUniqueConstraintError(e)) {
      return writeError("binding already exists for provider/team", 409);
    }
    throw e;
  }
});
