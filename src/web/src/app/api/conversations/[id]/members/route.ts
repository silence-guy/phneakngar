import { NextRequest } from "next/server";
import { ConversationMemberRequestSchema, queries } from "@phneakngar/shared";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { parseBody, writeError, writeJSON } from "@/lib/middleware/helpers";
import { conversationMemberToResponse } from "@/lib/api/responses";

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB);
  const id = ctx.params?.id;
  if (!id) return writeError("conversation id is required", 400);

  const conv = await queries.conversation.getConversation(db, id, ws.workspaceId);
  if (!conv) return writeError("conversation not found", 404);

  // Lazy-seed primary agent/user so 1:1 DMs list members without a backfill.
  // Soft-idempotent; extra multi-party members remain listed as stored.
  const members = await queries.conversationMember.ensurePrimaryConversationMembers(
    db,
    ws.workspaceId,
    conv,
  );
  return writeJSON({ items: members.map(conversationMemberToResponse) });
});

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB);
  const id = ctx.params?.id;
  if (!id) return writeError("conversation id is required", 400);

  const conv = await queries.conversation.getConversation(db, id, ws.workspaceId);
  if (!conv) return writeError("conversation not found", 404);

  const [body, err] = await parseBody(req, ConversationMemberRequestSchema);
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

  const row = await queries.conversationMember.addConversationMember(db, {
    workspaceId: ws.workspaceId,
    conversationId: id,
    memberType: body.member_type,
    memberId: body.member_id,
  });
  if (!row) return writeError("failed to add conversation member", 500);

  return writeJSON({ member: conversationMemberToResponse(row) }, 201);
});

export const DELETE = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB);
  const id = ctx.params?.id;
  if (!id) return writeError("conversation id is required", 400);

  const memberType = req.nextUrl.searchParams.get("member_type");
  const memberId = req.nextUrl.searchParams.get("member_id");
  if (memberType !== "user" && memberType !== "agent") {
    return writeError("member_type must be 'user' or 'agent'", 400);
  }
  if (!memberId) return writeError("member_id is required", 400);

  const conv = await queries.conversation.getConversation(db, id, ws.workspaceId);
  if (!conv) return writeError("conversation not found", 404);

  const removed = await queries.conversationMember.removeConversationMember(
    db,
    ws.workspaceId,
    id,
    memberType,
    memberId,
  );
  if (!removed) return writeError("conversation member not found", 404);

  return writeJSON({ ok: true, member: conversationMemberToResponse(removed) });
});
