import { NextRequest } from "next/server";
import { GatewayPeerAllowlistRequestSchema, queries } from "@phneakngar/shared";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember, withWorkspaceOwner } from "@/lib/middleware/workspace";
import { parseBody, writeError, writeJSON } from "@/lib/middleware/helpers";

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const bindingId = ctx.params?.id;
  if (!bindingId) return writeError("binding id is required", 400);

  const db = getDb(ctx.env.DB);
  const binding = await queries.gatewayBinding.getGatewayBinding(
    db,
    ws.workspaceId,
    bindingId,
  );
  if (!binding) return writeError("binding not found", 404);

  const rows = await queries.gatewayBinding.listPeerAllowlist(
    db,
    ws.workspaceId,
    bindingId,
  );
  return writeJSON({
    items: rows.map((r) => ({
      id: r.id,
      binding_id: r.bindingId,
      peer_id: r.peerId,
      status: r.status,
      created_at: r.createdAt,
    })),
  });
});

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceOwner(req, ctx);
  if (ws instanceof Response) return ws;

  const bindingId = ctx.params?.id;
  if (!bindingId) return writeError("binding id is required", 400);

  const db = getDb(ctx.env.DB);
  const binding = await queries.gatewayBinding.getGatewayBinding(
    db,
    ws.workspaceId,
    bindingId,
  );
  if (!binding) return writeError("binding not found", 404);

  const [body, err] = await parseBody(req, GatewayPeerAllowlistRequestSchema);
  if (err) return err;

  const row = await queries.gatewayBinding.addPeerAllowlist(db, {
    workspaceId: ws.workspaceId,
    bindingId,
    peerId: body.peer_id,
    status: body.status,
  });
  if (!row) return writeError("failed to add peer", 500);
  return writeJSON(
    {
      peer: {
        id: row.id,
        binding_id: row.bindingId,
        peer_id: row.peerId,
        status: row.status,
        created_at: row.createdAt,
      },
    },
    201,
  );
});

export const DELETE = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceOwner(req, ctx);
  if (ws instanceof Response) return ws;

  const bindingId = ctx.params?.id;
  if (!bindingId) return writeError("binding id is required", 400);

  const peerId = req.nextUrl.searchParams.get("peer_id");
  if (!peerId?.trim()) return writeError("peer_id query is required", 400);

  const db = getDb(ctx.env.DB);
  const binding = await queries.gatewayBinding.getGatewayBinding(
    db,
    ws.workspaceId,
    bindingId,
  );
  if (!binding) return writeError("binding not found", 404);

  const deleted = await queries.gatewayBinding.removePeerAllowlist(
    db,
    ws.workspaceId,
    bindingId,
    peerId.trim(),
  );
  if (!deleted) return writeError("peer not found", 404);
  return writeJSON({ ok: true, peer_id: deleted.peerId });
});
