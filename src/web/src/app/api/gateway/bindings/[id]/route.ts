import { NextRequest } from "next/server";
import {
  UpdateGatewayBindingRequestSchema,
  queries,
  sealGatewaySecret,
} from "@phneakngar/shared";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember, withWorkspaceOwner } from "@/lib/middleware/workspace";
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
  secretRef?: string | null;
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
    has_secret: Boolean(row.secretRef?.trim()),
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const id = ctx.params?.id;
  if (!id) return writeError("binding id is required", 400);

  const db = getDb(ctx.env.DB);
  const row = await queries.gatewayBinding.getGatewayBinding(db, ws.workspaceId, id);
  if (!row) return writeError("binding not found", 404);
  return writeJSON({ binding: bindingToResponse(row) });
});

export const PATCH = withAuth(async (req: NextRequest, ctx) => {
  // Owner-only: PATCH can rebind the agent, swap the vaulted bot token, or relax dm_policy
  // on a binding another member configured.
  const ws = await withWorkspaceOwner(req, ctx);
  if (ws instanceof Response) return ws;

  const id = ctx.params?.id;
  if (!id) return writeError("binding id is required", 400);

  const db = getDb(ctx.env.DB);
  const existing = await queries.gatewayBinding.getGatewayBinding(db, ws.workspaceId, id);
  if (!existing) return writeError("binding not found", 404);

  const [body, err] = await parseBody(req, UpdateGatewayBindingRequestSchema);
  if (err) return err;

  if (body.agent_id) {
    const agent = await queries.agent.getAgent(db, body.agent_id, ws.workspaceId, ctx.userId);
    if (!agent) return writeError("agent not found in workspace", 404);
  }
  if (body.user_id) {
    const member = await queries.member.getMemberByUserAndWorkspace(
      db,
      body.user_id,
      ws.workspaceId,
    );
    if (!member) return writeError("user not a workspace member", 404);
  }

  const encryptionKey = ctx.env.ENCRYPTION_KEY;
  if (body.secret_ref?.trim() && !encryptionKey) {
    return writeError("encryption not configured", 500);
  }

  const updated = await queries.gatewayBinding.updateGatewayBinding(db, ws.workspaceId, id, {
    status: body.status,
    dmPolicy: body.dm_policy,
    outboundMode: body.outbound_mode,
    agentId: body.agent_id,
    userId: body.user_id,
    ...(body.secret_ref !== undefined
      ? { secretRef: sealGatewaySecret(body.secret_ref, encryptionKey) }
      : {}),
  });
  if (!updated) return writeError("binding not found", 404);
  return writeJSON({ binding: bindingToResponse(updated) });
});

export const DELETE = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceOwner(req, ctx);
  if (ws instanceof Response) return ws;

  const id = ctx.params?.id;
  if (!id) return writeError("binding id is required", 400);

  const db = getDb(ctx.env.DB);
  const deleted = await queries.gatewayBinding.deleteGatewayBinding(db, ws.workspaceId, id);
  if (!deleted) return writeError("binding not found", 404);
  return writeJSON({ ok: true, id: deleted.id });
});
