import { and, desc, eq } from "drizzle-orm";
import { agentIntegration } from "../schema";
import type { Database } from "../index";

export async function createIntegration(
  db: Database,
  data: {
    workspaceId: string;
    agentId: string;
    provider: string;
    status?: string;
    config?: unknown;
    secretRef?: string | null;
  }
) {
  const now = new Date().toISOString();
  const rows = await db
    .insert(agentIntegration)
    .values({
      workspaceId: data.workspaceId,
      agentId: data.agentId,
      provider: data.provider,
      status: data.status ?? "active",
      config: data.config ?? null,
      secretRef: data.secretRef ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return rows[0]!;
}

export async function listIntegrationsForAgent(
  db: Database,
  workspaceId: string,
  agentId: string
) {
  return db
    .select({
      id: agentIntegration.id,
      workspaceId: agentIntegration.workspaceId,
      agentId: agentIntegration.agentId,
      provider: agentIntegration.provider,
      status: agentIntegration.status,
      config: agentIntegration.config,
      // secretRef intentionally omitted from list projections at call sites
      secretRef: agentIntegration.secretRef,
      createdAt: agentIntegration.createdAt,
      updatedAt: agentIntegration.updatedAt,
    })
    .from(agentIntegration)
    .where(
      and(
        eq(agentIntegration.workspaceId, workspaceId),
        eq(agentIntegration.agentId, agentId)
      )
    )
    .orderBy(desc(agentIntegration.createdAt));
}

export async function getIntegration(
  db: Database,
  id: string,
  workspaceId: string,
  agentId?: string
) {
  const conditions = [
    eq(agentIntegration.id, id),
    eq(agentIntegration.workspaceId, workspaceId),
  ];
  if (agentId) conditions.push(eq(agentIntegration.agentId, agentId));
  const rows = await db
    .select()
    .from(agentIntegration)
    .where(and(...conditions));
  return rows[0] ?? null;
}

export async function deleteIntegration(
  db: Database,
  id: string,
  workspaceId: string,
  agentId: string
) {
  const rows = await db
    .delete(agentIntegration)
    .where(
      and(
        eq(agentIntegration.id, id),
        eq(agentIntegration.workspaceId, workspaceId),
        eq(agentIntegration.agentId, agentId)
      )
    )
    .returning();
  return rows[0] ?? null;
}

/** Public list shape: never expose secretRef. */
export function toPublicIntegration(row: {
  id: string;
  workspaceId: string;
  agentId: string;
  provider: string;
  status: string;
  config: unknown;
  secretRef?: string | null;
  createdAt: string;
  updatedAt: string;
}) {
  return {
    id: row.id,
    workspace_id: row.workspaceId,
    agent_id: row.agentId,
    provider: row.provider,
    status: row.status,
    config: row.config,
    has_secret: Boolean(row.secretRef),
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}
