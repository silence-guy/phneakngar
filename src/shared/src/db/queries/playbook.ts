import { and, desc, eq } from "drizzle-orm";
import { playbook } from "../schema";
import type { Database } from "../index";
import type { PlaybookDefinition } from "../../lib/playbook";

export async function createPlaybook(
  db: Database,
  data: {
    workspaceId: string;
    agentId?: string | null;
    title: string;
    description?: string;
    definition: PlaybookDefinition;
    status?: string;
    createdByUserId?: string | null;
  }
) {
  const now = new Date().toISOString();
  const rows = await db
    .insert(playbook)
    .values({
      workspaceId: data.workspaceId,
      agentId: data.agentId ?? null,
      title: data.title,
      description: data.description ?? "",
      definition: data.definition,
      version: 1,
      status: data.status ?? "draft",
      createdByUserId: data.createdByUserId ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return rows[0]!;
}

export async function getPlaybook(db: Database, id: string, workspaceId: string) {
  const rows = await db
    .select()
    .from(playbook)
    .where(and(eq(playbook.id, id), eq(playbook.workspaceId, workspaceId)));
  return rows[0] ?? null;
}

export async function listPlaybooks(
  db: Database,
  workspaceId: string,
  opts?: { agentId?: string; status?: string }
) {
  const conditions = [eq(playbook.workspaceId, workspaceId)];
  if (opts?.agentId) conditions.push(eq(playbook.agentId, opts.agentId));
  if (opts?.status) conditions.push(eq(playbook.status, opts.status));
  return db
    .select()
    .from(playbook)
    .where(and(...conditions))
    .orderBy(desc(playbook.updatedAt));
}

export async function updatePlaybook(
  db: Database,
  id: string,
  workspaceId: string,
  patch: {
    title?: string;
    description?: string;
    agentId?: string | null;
    definition?: PlaybookDefinition;
    status?: string;
    version?: number;
  }
) {
  const rows = await db
    .update(playbook)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(and(eq(playbook.id, id), eq(playbook.workspaceId, workspaceId)))
    .returning();
  return rows[0] ?? null;
}

export async function deletePlaybook(db: Database, id: string, workspaceId: string) {
  const rows = await db
    .delete(playbook)
    .where(and(eq(playbook.id, id), eq(playbook.workspaceId, workspaceId)))
    .returning();
  return rows[0] ?? null;
}
