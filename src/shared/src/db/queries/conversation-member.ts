import { and, eq } from "drizzle-orm";
import { conversationMember } from "../schema";
import type { Database } from "../index";

/** Unique membership key — must match schema `conversation_member_unique`. */
const conversationMemberUniqueTarget = [
  conversationMember.conversationId,
  conversationMember.memberType,
  conversationMember.memberId,
] as const;

function membershipWhere(
  workspaceId: string,
  conversationId: string,
  memberType: "user" | "agent",
  memberId: string,
) {
  return and(
    eq(conversationMember.workspaceId, workspaceId),
    eq(conversationMember.conversationId, conversationId),
    eq(conversationMember.memberType, memberType),
    eq(conversationMember.memberId, memberId),
  );
}

async function getConversationMember(
  db: Database,
  workspaceId: string,
  conversationId: string,
  memberType: "user" | "agent",
  memberId: string,
) {
  const existing = await db
    .select()
    .from(conversationMember)
    .where(membershipWhere(workspaceId, conversationId, memberType, memberId));
  return existing[0] ?? null;
}

/**
 * Soft-idempotent insert: on unique (conversationId, memberType, memberId)
 * conflict, re-select the existing row scoped to workspaceId.
 */
export async function addConversationMember(
  db: Database,
  data: {
    workspaceId: string;
    conversationId: string;
    memberType: "user" | "agent";
    memberId: string;
  },
) {
  const rows = await db
    .insert(conversationMember)
    .values({
      workspaceId: data.workspaceId,
      conversationId: data.conversationId,
      memberType: data.memberType,
      memberId: data.memberId,
      createdAt: new Date().toISOString(),
    })
    .onConflictDoNothing({ target: [...conversationMemberUniqueTarget] })
    .returning();
  if (rows[0]) return rows[0];
  // Conflict path: only return the row if it also matches workspaceId
  // (never leak / re-home a membership across workspaces).
  return getConversationMember(
    db,
    data.workspaceId,
    data.conversationId,
    data.memberType,
    data.memberId,
  );
}

export async function listConversationMembers(
  db: Database,
  workspaceId: string,
  conversationId: string,
) {
  return db
    .select()
    .from(conversationMember)
    .where(
      and(
        eq(conversationMember.workspaceId, workspaceId),
        eq(conversationMember.conversationId, conversationId),
      ),
    );
}

export async function listConversationsForMember(
  db: Database,
  workspaceId: string,
  memberType: "user" | "agent",
  memberId: string,
) {
  return db
    .select()
    .from(conversationMember)
    .where(
      and(
        eq(conversationMember.workspaceId, workspaceId),
        eq(conversationMember.memberType, memberType),
        eq(conversationMember.memberId, memberId),
      ),
    );
}

/** Alias matching channel-member naming. */
export const listConversationMembershipsForMember = listConversationsForMember;

export async function removeConversationMember(
  db: Database,
  workspaceId: string,
  conversationId: string,
  memberType: "user" | "agent",
  memberId: string,
) {
  const rows = await db
    .delete(conversationMember)
    .where(membershipWhere(workspaceId, conversationId, memberType, memberId))
    .returning();
  return rows[0] ?? null;
}

/**
 * Lazily seed primary conversation.agentId + conversation.userId as members.
 * Soft-idempotent via addConversationMember. Returns the full member list.
 */
export async function ensurePrimaryConversationMembers(
  db: Database,
  workspaceId: string,
  conversation: {
    id: string;
    agentId?: string | null;
    userId?: string | null;
  },
) {
  const agentId = (conversation.agentId ?? "").trim();
  const userId = (conversation.userId ?? "").trim();
  if (agentId) {
    await addConversationMember(db, {
      workspaceId,
      conversationId: conversation.id,
      memberType: "agent",
      memberId: agentId,
    });
  }
  if (userId) {
    await addConversationMember(db, {
      workspaceId,
      conversationId: conversation.id,
      memberType: "user",
      memberId: userId,
    });
  }
  return listConversationMembers(db, workspaceId, conversation.id);
}
