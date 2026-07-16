import { and, asc, eq, lte } from "drizzle-orm";
import { automation } from "../schema";
import type { Database } from "../index";

export async function createAutomation(
  db: Database,
  data: {
    workspaceId: string;
    agentId: string;
    title: string;
    sopMarkdown?: string;
    schedule: string;
    nextRunAt: string;
    deliveryMode?: string;
    deliveryChannelId?: string | null;
    skillName?: string | null;
    enabled?: boolean;
  }
) {
  const now = new Date().toISOString();
  const rows = await db
    .insert(automation)
    .values({
      workspaceId: data.workspaceId,
      agentId: data.agentId,
      title: data.title,
      sopMarkdown: data.sopMarkdown ?? "",
      schedule: data.schedule,
      nextRunAt: data.nextRunAt,
      deliveryMode: data.deliveryMode ?? "channel",
      deliveryChannelId: data.deliveryChannelId ?? null,
      skillName: data.skillName ?? null,
      enabled: data.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return rows[0]!;
}

export async function getAutomation(db: Database, id: string, workspaceId: string) {
  const rows = await db
    .select()
    .from(automation)
    .where(and(eq(automation.id, id), eq(automation.workspaceId, workspaceId)));
  return rows[0] ?? null;
}

export async function listAutomations(
  db: Database,
  workspaceId: string,
  opts?: { agentId?: string; enabled?: boolean }
) {
  const conditions = [eq(automation.workspaceId, workspaceId)];
  if (opts?.agentId) conditions.push(eq(automation.agentId, opts.agentId));
  if (opts?.enabled !== undefined) conditions.push(eq(automation.enabled, opts.enabled));
  return db
    .select()
    .from(automation)
    .where(and(...conditions))
    .orderBy(asc(automation.nextRunAt));
}

/** Due automations for a workspace (stateless scheduler input). */
export async function listDueAutomations(
  db: Database,
  workspaceId: string,
  nowIso: string,
  limit = 50
) {
  return db
    .select()
    .from(automation)
    .where(
      and(
        eq(automation.workspaceId, workspaceId),
        eq(automation.enabled, true),
        lte(automation.nextRunAt, nowIso)
      )
    )
    .orderBy(asc(automation.nextRunAt))
    .limit(limit);
}

export async function updateAutomation(
  db: Database,
  id: string,
  workspaceId: string,
  patch: {
    title?: string;
    sopMarkdown?: string;
    schedule?: string;
    nextRunAt?: string;
    deliveryMode?: string;
    deliveryChannelId?: string | null;
    skillName?: string | null;
    enabled?: boolean;
    lastRunAt?: string | null;
    lastTaskId?: string | null;
  }
) {
  const rows = await db
    .update(automation)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(and(eq(automation.id, id), eq(automation.workspaceId, workspaceId)))
    .returning();
  return rows[0] ?? null;
}

export async function deleteAutomation(db: Database, id: string, workspaceId: string) {
  const rows = await db
    .delete(automation)
    .where(and(eq(automation.id, id), eq(automation.workspaceId, workspaceId)))
    .returning();
  return rows[0] ?? null;
}

/**
 * Mark run complete only if nextRunAt still matches observed value (idempotent claim).
 */
export async function claimAutomationRun(
  db: Database,
  id: string,
  workspaceId: string,
  observedNextRunAt: string,
  nextRunAt: string,
  lastTaskId: string
) {
  const now = new Date().toISOString();
  const rows = await db
    .update(automation)
    .set({
      lastRunAt: now,
      lastTaskId,
      nextRunAt,
      updatedAt: now,
    })
    .where(
      and(
        eq(automation.id, id),
        eq(automation.workspaceId, workspaceId),
        eq(automation.nextRunAt, observedNextRunAt),
        eq(automation.enabled, true)
      )
    )
    .returning();
  return rows[0] ?? null;
}

/**
 * Compensating revert after a successful claim when post-claim dispatch fails.
 * Only restores when nextRunAt still equals the advanced value from the claim.
 */
export async function revertAutomationRunClaim(
  db: Database,
  id: string,
  workspaceId: string,
  claimedNextRunAt: string,
  previous: {
    nextRunAt: string;
    lastRunAt: string | null;
    lastTaskId: string | null;
  }
) {
  const now = new Date().toISOString();
  const rows = await db
    .update(automation)
    .set({
      nextRunAt: previous.nextRunAt,
      lastRunAt: previous.lastRunAt,
      lastTaskId: previous.lastTaskId,
      updatedAt: now,
    })
    .where(
      and(
        eq(automation.id, id),
        eq(automation.workspaceId, workspaceId),
        eq(automation.nextRunAt, claimedNextRunAt)
      )
    )
    .returning();
  return rows[0] ?? null;
}
