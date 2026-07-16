import { eq, and, isNull, or } from "drizzle-orm";
import { agentSkill } from "../schema";
import type { Database } from "../index";

interface SkillRow {
  name: string;
  description: string;
}

export async function syncGlobalSkills(
  db: Database,
  workspaceId: string,
  runtime: string,
  skills: SkillRow[],
  chhlatId?: string,
) {
  const now = new Date().toISOString();
  const rows = skills.map((s) => ({
    workspaceId,
    agentId: null,
    chhlatId: chhlatId ?? null,
    runtime,
    name: s.name,
    description: s.description,
    syncedAt: now,
  }));

  const deleteCondition = chhlatId
    ? and(eq(agentSkill.workspaceId, workspaceId), eq(agentSkill.runtime, runtime), isNull(agentSkill.agentId), eq(agentSkill.chhlatId, chhlatId))
    : and(eq(agentSkill.workspaceId, workspaceId), eq(agentSkill.runtime, runtime), isNull(agentSkill.agentId), isNull(agentSkill.chhlatId));

  const BATCH_SIZE = 10;
  const statements: any[] = [
    db.delete(agentSkill).where(deleteCondition),
  ];
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    statements.push(db.insert(agentSkill).values(rows.slice(i, i + BATCH_SIZE)));
  }
  await db.batch(statements as [any, ...any[]]);
}

export async function syncAgentSkills(
  db: Database,
  agentId: string,
  runtime: string,
  workspaceId: string,
  skills: SkillRow[],
) {
  const now = new Date().toISOString();
  const rows = skills.map((s) => ({
    workspaceId,
    agentId,
    runtime,
    name: s.name,
    description: s.description,
    syncedAt: now,
  }));

  const BATCH_SIZE = 10;
  const statements: any[] = [
    db.delete(agentSkill).where(
      and(
        eq(agentSkill.workspaceId, workspaceId),
        eq(agentSkill.agentId, agentId),
        eq(agentSkill.runtime, runtime),
      )
    ),
  ];
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    statements.push(db.insert(agentSkill).values(rows.slice(i, i + BATCH_SIZE)));
  }
  await db.batch(statements as [any, ...any[]]);
}

export async function getSkills(
  db: Database,
  agentId: string,
  runtime: string,
  workspaceId: string,
) {
  const rows = await db
    .select({
      name: agentSkill.name,
      description: agentSkill.description,
      isGlobal: isNull(agentSkill.agentId),
    })
    .from(agentSkill)
    .where(
      and(
        eq(agentSkill.workspaceId, workspaceId),
        eq(agentSkill.runtime, runtime),
        or(isNull(agentSkill.agentId), eq(agentSkill.agentId, agentId))
      )
    );

  // Deduplicate global skills by name (multiple chhlats may sync the same skill)
  const seen = new Set<string>();
  const deduped: typeof rows = [];
  for (const row of rows) {
    const key = row.isGlobal ? `global:${row.name}` : `agent:${row.name}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(row);
    }
  }
  return deduped;
}

/**
 * Install (or refresh) a single agent-scoped skill in the D1 catalog.
 *
 * Prefer this over `syncAgentSkills` for human-approved proposals: replace-all
 * sync would wipe other catalog rows. SQLite UNIQUE treats NULLs as distinct,
 * so agent-scoped rows with `chhlatId = null` use select→update/insert rather
 * than `onConflictDoUpdate`.
 */
export async function installAgentSkill(
  db: Database,
  data: {
    workspaceId: string;
    agentId: string;
    runtime: string;
    name: string;
    description: string;
  },
) {
  const now = new Date().toISOString();
  const existing = await db
    .select()
    .from(agentSkill)
    .where(
      and(
        eq(agentSkill.workspaceId, data.workspaceId),
        eq(agentSkill.agentId, data.agentId),
        eq(agentSkill.runtime, data.runtime),
        eq(agentSkill.name, data.name),
        isNull(agentSkill.chhlatId),
      ),
    )
    .limit(1);

  if (existing[0]) {
    const rows = await db
      .update(agentSkill)
      .set({
        description: data.description,
        syncedAt: now,
      })
      .where(
        and(
          eq(agentSkill.id, existing[0].id),
          eq(agentSkill.workspaceId, data.workspaceId),
        ),
      )
      .returning();
    return rows[0]!;
  }

  const rows = await db
    .insert(agentSkill)
    .values({
      workspaceId: data.workspaceId,
      agentId: data.agentId,
      chhlatId: null,
      runtime: data.runtime,
      name: data.name,
      description: data.description,
      syncedAt: now,
    })
    .returning();
  return rows[0]!;
}
