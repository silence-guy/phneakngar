import { eq, and, gt, isNull, notExists, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { workspaceInvite, workspace, user, member } from "../schema";
import type { Database } from "../index";

export const WORKSPACE_MEMBER_CAPACITY = 4;

export async function createInvite(
  db: Database,
  data: { workspaceId: string; createdBy: string; expiresAt: string }
) {
  const rows = await db
    .insert(workspaceInvite)
    .values({
      workspaceId: data.workspaceId,
      createdBy: data.createdBy,
      expiresAt: data.expiresAt,
    })
    .returning();
  return rows[0]!;
}

export async function getInviteByToken(db: Database, token: string) {
  const rows = await db
    .select({
      id: workspaceInvite.id,
      workspaceId: workspaceInvite.workspaceId,
      token: workspaceInvite.token,
      createdBy: workspaceInvite.createdBy,
      usedBy: workspaceInvite.usedBy,
      usedAt: workspaceInvite.usedAt,
      expiresAt: workspaceInvite.expiresAt,
      createdAt: workspaceInvite.createdAt,
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
      creatorName: user.name,
      creatorEmail: user.email,
    })
    .from(workspaceInvite)
    .innerJoin(workspace, eq(workspaceInvite.workspaceId, workspace.id))
    .innerJoin(user, eq(workspaceInvite.createdBy, user.id))
    .where(eq(workspaceInvite.token, token));
  return rows[0] ?? null;
}

export async function getInviteByTokenForUser(
  db: Database,
  token: string,
  userId: string,
) {
  const rows = await db
    .select({
      id: workspaceInvite.id,
      workspaceId: workspaceInvite.workspaceId,
      token: workspaceInvite.token,
      createdBy: workspaceInvite.createdBy,
      usedBy: workspaceInvite.usedBy,
      usedAt: workspaceInvite.usedAt,
      expiresAt: workspaceInvite.expiresAt,
      createdAt: workspaceInvite.createdAt,
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
      creatorName: user.name,
      creatorEmail: user.email,
      memberId: member.id,
    })
    .from(workspaceInvite)
    .innerJoin(workspace, eq(workspaceInvite.workspaceId, workspace.id))
    .innerJoin(user, eq(workspaceInvite.createdBy, user.id))
    .leftJoin(
      member,
      and(
        eq(member.workspaceId, workspaceInvite.workspaceId),
        eq(member.userId, userId),
      ),
    )
    .where(eq(workspaceInvite.token, token));
  return rows[0] ?? null;
}

export async function listActiveInvites(db: Database, workspaceId: string) {
  return db
    .select()
    .from(workspaceInvite)
    .where(
      and(
        eq(workspaceInvite.workspaceId, workspaceId),
        isNull(workspaceInvite.usedBy),
        gt(workspaceInvite.expiresAt, new Date().toISOString())
      )
    );
}

export async function redeemInvite(db: Database, token: string, userId: string) {
  const now = new Date().toISOString();
  const rows = await db
    .update(workspaceInvite)
    .set({ usedBy: userId, usedAt: now })
    .where(
      and(
        eq(workspaceInvite.token, token),
        isNull(workspaceInvite.usedBy),
        gt(workspaceInvite.expiresAt, now)
      )
    )
    .returning();
  return rows[0] ?? null;
}

export type RedeemInviteForUserResult =
  | { status: "success"; workspaceId: string; workspaceSlug: string }
  | { status: "not_found" }
  | { status: "expired" }
  | { status: "used" }
  | { status: "already_member" }
  | { status: "capacity_full" }
  | { status: "inconsistent" };

export async function redeemInviteForUser(
  db: Database,
  token: string,
  userId: string,
): Promise<RedeemInviteForUserResult> {
  const now = new Date().toISOString();
  const memberId = nanoid();
  const existingMembership = db
    .select({ id: member.id })
    .from(member)
    .where(
      and(
        eq(member.workspaceId, workspaceInvite.workspaceId),
        eq(member.userId, userId),
      ),
    );
  const workspaceAtCapacity = db
    .select({ id: member.id })
    .from(member)
    .where(eq(member.workspaceId, workspaceInvite.workspaceId))
    .limit(1)
    .offset(WORKSPACE_MEMBER_CAPACITY - 1);

  const claim = db
    .update(workspaceInvite)
    .set({ usedBy: userId, usedAt: now })
    .where(
      and(
        eq(workspaceInvite.token, token),
        isNull(workspaceInvite.usedBy),
        gt(workspaceInvite.expiresAt, now),
        notExists(existingMembership),
        notExists(workspaceAtCapacity),
      ),
    );

  const insertMembership = db
    .insert(member)
    .select((qb) => qb
      .select({
        id: sql<string>`${memberId}`.as("id"),
        workspaceId: workspaceInvite.workspaceId,
        userId: sql<string>`${userId}`.as("user_id"),
        role: sql<string>`'member'`.as("role"),
        globalInstruction: sql<string>`''`.as("global_instruction"),
        preferredLocale: sql<string>`'km'`.as("preferred_locale"),
        createdAt: sql<string>`${now}`.as("created_at"),
      })
      .from(workspaceInvite)
      .where(
        and(
          eq(workspaceInvite.token, token),
          eq(workspaceInvite.usedBy, userId),
          notExists(workspaceAtCapacity),
        ),
      ))
    .onConflictDoNothing({ target: [member.workspaceId, member.userId] });

  const finalState = db
    .select({
      workspaceId: workspaceInvite.workspaceId,
      workspaceSlug: workspace.slug,
      usedBy: workspaceInvite.usedBy,
      expiresAt: workspaceInvite.expiresAt,
      memberId: member.id,
    })
    .from(workspaceInvite)
    .innerJoin(workspace, eq(workspace.id, workspaceInvite.workspaceId))
    .leftJoin(
      member,
      and(
        eq(member.workspaceId, workspaceInvite.workspaceId),
        eq(member.userId, userId),
      ),
    )
    .where(eq(workspaceInvite.token, token));

  const capacityRowsQuery = db
    .select({ id: member.id })
    .from(member)
    .innerJoin(workspaceInvite, eq(member.workspaceId, workspaceInvite.workspaceId))
    .where(eq(workspaceInvite.token, token))
    .limit(1)
    .offset(WORKSPACE_MEMBER_CAPACITY - 1);

  const [, , finalRows, capacityRows] = await db.batch([
    claim,
    insertMembership,
    finalState,
    capacityRowsQuery,
  ]);
  const final = finalRows[0];
  if (!final) return { status: "not_found" };
  if (final.usedBy === userId && final.memberId) {
    return {
      status: "success",
      workspaceId: final.workspaceId,
      workspaceSlug: final.workspaceSlug,
    };
  }
  if (final.usedBy && final.usedBy !== userId) return { status: "used" };
  if (final.usedBy === userId && capacityRows[0]) return { status: "capacity_full" };
  if (final.usedBy === userId) return { status: "inconsistent" };
  if (final.expiresAt <= now) return { status: "expired" };
  if (final.memberId) return { status: "already_member" };
  if (capacityRows[0]) return { status: "capacity_full" };
  return { status: "inconsistent" };
}

export async function deleteInvite(db: Database, inviteId: string, workspaceId: string) {
  const rows = await db
    .delete(workspaceInvite)
    .where(
      and(
        eq(workspaceInvite.id, inviteId),
        eq(workspaceInvite.workspaceId, workspaceId)
      )
    )
    .returning();
  return rows[0] ?? null;
}
