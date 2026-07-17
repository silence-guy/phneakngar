import { and, desc, eq, isNotNull } from "drizzle-orm";
import { activityEvent } from "../schema";
import type { Database } from "../index";

export type CreateActivityEventInput = {
  workspaceId: string;
  kind: string;
  summary: string;
  actorType?: string | null;
  actorId?: string | null;
  subjectType?: string | null;
  subjectId?: string | null;
  payloadJson?: string | null;
  /** When set, insert is soft-idempotent within workspace. */
  dedupeKey?: string | null;
};

/**
 * Insert activity event. Workspace-scoped first.
 * When dedupeKey is set, conflict returns existing row (idempotent).
 */
export async function createActivityEvent(
  db: Database,
  data: CreateActivityEventInput,
): Promise<{ created: boolean; row: typeof activityEvent.$inferSelect | null }> {
  const now = new Date().toISOString();
  const values = {
    workspaceId: data.workspaceId,
    kind: data.kind,
    summary: data.summary,
    actorType: data.actorType ?? null,
    actorId: data.actorId ?? null,
    subjectType: data.subjectType ?? null,
    subjectId: data.subjectId ?? null,
    payloadJson: data.payloadJson ?? null,
    dedupeKey: data.dedupeKey ?? null,
    createdAt: now,
  };

  if (data.dedupeKey) {
    const rows = await db
      .insert(activityEvent)
      .values(values)
      .onConflictDoNothing()
      .returning();
    if (rows[0]) return { created: true, row: rows[0] };

    const existing = await db
      .select()
      .from(activityEvent)
      .where(
        and(
          eq(activityEvent.workspaceId, data.workspaceId),
          eq(activityEvent.dedupeKey, data.dedupeKey),
        ),
      );
    return { created: false, row: existing[0] ?? null };
  }

  const rows = await db.insert(activityEvent).values(values).returning();
  return { created: true, row: rows[0] ?? null };
}

/** List recent activity for a workspace (newest first). */
export async function listActivityEvents(
  db: Database,
  workspaceId: string,
  opts: { limit?: number } = {},
) {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  return db
    .select()
    .from(activityEvent)
    .where(eq(activityEvent.workspaceId, workspaceId))
    .orderBy(desc(activityEvent.createdAt))
    .limit(limit);
}

/** True when a dedupe key already exists in the workspace (egress idempotency). */
export async function hasActivityDedupe(
  db: Database,
  workspaceId: string,
  dedupeKey: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: activityEvent.id })
    .from(activityEvent)
    .where(
      and(
        eq(activityEvent.workspaceId, workspaceId),
        eq(activityEvent.dedupeKey, dedupeKey),
        isNotNull(activityEvent.dedupeKey),
      ),
    )
    .limit(1);
  return Boolean(rows[0]);
}
