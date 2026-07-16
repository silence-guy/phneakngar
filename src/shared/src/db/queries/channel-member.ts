import { and, eq } from "drizzle-orm";
import { channelMember } from "../schema";
import type { Database } from "../index";

export async function addChannelMember(
  db: Database,
  data: {
    workspaceId: string;
    channelId: string;
    memberType: "user" | "agent";
    memberId: string;
  }
) {
  const rows = await db
    .insert(channelMember)
    .values({
      workspaceId: data.workspaceId,
      channelId: data.channelId,
      memberType: data.memberType,
      memberId: data.memberId,
      createdAt: new Date().toISOString(),
    })
    .onConflictDoNothing()
    .returning();
  if (rows[0]) return rows[0];
  const existing = await db
    .select()
    .from(channelMember)
    .where(
      and(
        eq(channelMember.workspaceId, data.workspaceId),
        eq(channelMember.channelId, data.channelId),
        eq(channelMember.memberType, data.memberType),
        eq(channelMember.memberId, data.memberId)
      )
    );
  return existing[0] ?? null;
}

export async function listChannelMembers(
  db: Database,
  workspaceId: string,
  channelId: string
) {
  return db
    .select()
    .from(channelMember)
    .where(
      and(
        eq(channelMember.workspaceId, workspaceId),
        eq(channelMember.channelId, channelId)
      )
    );
}

export async function listMembershipsForMember(
  db: Database,
  workspaceId: string,
  memberType: "user" | "agent",
  memberId: string
) {
  return db
    .select()
    .from(channelMember)
    .where(
      and(
        eq(channelMember.workspaceId, workspaceId),
        eq(channelMember.memberType, memberType),
        eq(channelMember.memberId, memberId)
      )
    );
}

export async function removeChannelMember(
  db: Database,
  workspaceId: string,
  channelId: string,
  memberType: "user" | "agent",
  memberId: string
) {
  const rows = await db
    .delete(channelMember)
    .where(
      and(
        eq(channelMember.workspaceId, workspaceId),
        eq(channelMember.channelId, channelId),
        eq(channelMember.memberType, memberType),
        eq(channelMember.memberId, memberId)
      )
    )
    .returning();
  return rows[0] ?? null;
}
