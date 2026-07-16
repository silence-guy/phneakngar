import { NextRequest } from "next/server";
import { ChannelMemberRequestSchema, queries } from "@phneakngar/shared";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { parseBody, writeError, writeJSON } from "@/lib/middleware/helpers";
import { channelMemberToResponse } from "@/lib/api/responses";

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB);
  const id = ctx.params?.id;
  if (!id) return writeError("channel id is required", 400);

  const channel = await queries.channel.getChannelById(db, id, ws.workspaceId);
  if (!channel) return writeError("channel not found", 404);

  const members = await queries.channelMember.listChannelMembers(
    db,
    ws.workspaceId,
    id,
  );
  return writeJSON({ items: members.map(channelMemberToResponse) });
});

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB);
  const id = ctx.params?.id;
  if (!id) return writeError("channel id is required", 400);

  const channel = await queries.channel.getChannelById(db, id, ws.workspaceId);
  if (!channel) return writeError("channel not found", 404);

  const [body, err] = await parseBody(req, ChannelMemberRequestSchema);
  if (err) return err;

  if (body.member_type === "agent") {
    const agent = await queries.agent.getAgent(db, body.member_id, ws.workspaceId);
    if (!agent) return writeError("agent not found in workspace", 404);
  } else {
    const member = await queries.member.getMemberByUserAndWorkspace(
      db,
      body.member_id,
      ws.workspaceId,
    );
    if (!member) return writeError("user is not a workspace member", 404);
  }

  const row = await queries.channelMember.addChannelMember(db, {
    workspaceId: ws.workspaceId,
    channelId: id,
    memberType: body.member_type,
    memberId: body.member_id,
  });
  if (!row) return writeError("failed to add channel member", 500);

  return writeJSON({ member: channelMemberToResponse(row) }, 201);
});

export const DELETE = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB);
  const id = ctx.params?.id;
  if (!id) return writeError("channel id is required", 400);

  const memberType = req.nextUrl.searchParams.get("member_type");
  const memberId = req.nextUrl.searchParams.get("member_id");
  if (memberType !== "user" && memberType !== "agent") {
    return writeError("member_type must be 'user' or 'agent'", 400);
  }
  if (!memberId) return writeError("member_id is required", 400);

  const channel = await queries.channel.getChannelById(db, id, ws.workspaceId);
  if (!channel) return writeError("channel not found", 404);

  const removed = await queries.channelMember.removeChannelMember(
    db,
    ws.workspaceId,
    id,
    memberType,
    memberId,
  );
  if (!removed) return writeError("channel member not found", 404);

  return writeJSON({ ok: true, member: channelMemberToResponse(removed) });
});
