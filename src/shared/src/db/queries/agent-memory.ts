import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { agentMemory } from "../schema";
import type { Database } from "../index";

export async function createMemory(
  db: Database,
  data: {
    workspaceId: string;
    agentId?: string | null;
    kind: string;
    content: string;
    sourceTaskId?: string | null;
  }
) {
  const now = new Date().toISOString();
  const rows = await db
    .insert(agentMemory)
    .values({
      workspaceId: data.workspaceId,
      agentId: data.agentId ?? null,
      kind: data.kind,
      content: data.content,
      sourceTaskId: data.sourceTaskId ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return rows[0]!;
}

export async function listMemoryForAgent(
  db: Database,
  workspaceId: string,
  agentId: string,
  limit = 50
) {
  return db
    .select()
    .from(agentMemory)
    .where(
      and(
        eq(agentMemory.workspaceId, workspaceId),
        or(eq(agentMemory.agentId, agentId), isNull(agentMemory.agentId))
      )
    )
    .orderBy(desc(agentMemory.updatedAt))
    .limit(limit);
}

export async function listMemory(
  db: Database,
  workspaceId: string,
  opts?: { agentId?: string | null; kind?: string; limit?: number }
) {
  const conditions = [eq(agentMemory.workspaceId, workspaceId)];
  if (opts?.agentId !== undefined) {
    if (opts.agentId === null) conditions.push(isNull(agentMemory.agentId));
    else conditions.push(eq(agentMemory.agentId, opts.agentId));
  }
  if (opts?.kind) conditions.push(eq(agentMemory.kind, opts.kind));
  return db
    .select()
    .from(agentMemory)
    .where(and(...conditions))
    .orderBy(desc(agentMemory.updatedAt))
    .limit(opts?.limit ?? 100);
}

export async function deleteMemory(db: Database, id: string, workspaceId: string) {
  const rows = await db
    .delete(agentMemory)
    .where(and(eq(agentMemory.id, id), eq(agentMemory.workspaceId, workspaceId)))
    .returning();
  return rows[0] ?? null;
}

/** Workspace-scoped bulk delete used by memory compaction. */
export async function deleteMemoriesByIds(
  db: Database,
  workspaceId: string,
  ids: string[]
) {
  if (ids.length === 0) return [] as (typeof agentMemory.$inferSelect)[];
  return db
    .delete(agentMemory)
    .where(and(eq(agentMemory.workspaceId, workspaceId), inArray(agentMemory.id, ids)))
    .returning();
}

export async function updateMemory(
  db: Database,
  id: string,
  workspaceId: string,
  patch: { content?: string; kind?: string }
) {
  const rows = await db
    .update(agentMemory)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(and(eq(agentMemory.id, id), eq(agentMemory.workspaceId, workspaceId)))
    .returning();
  return rows[0] ?? null;
}
