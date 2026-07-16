import { and, desc, eq } from "drizzle-orm";
import { ApprovalKind } from "../../constants";
import { approval } from "../schema";
import type { Database } from "../index";

export async function createApproval(
  db: Database,
  data: {
    workspaceId: string;
    agentId?: string | null;
    kind: string;
    title?: string;
    summary?: string;
    payload?: unknown;
    status?: string;
  }
) {
  const now = new Date().toISOString();
  const rows = await db
    .insert(approval)
    .values({
      workspaceId: data.workspaceId,
      agentId: data.agentId ?? null,
      kind: data.kind,
      title: data.title ?? "",
      summary: data.summary ?? "",
      payload: data.payload ?? null,
      status: data.status ?? "pending",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return rows[0]!;
}

export async function getApproval(db: Database, id: string, workspaceId: string) {
  const rows = await db
    .select()
    .from(approval)
    .where(and(eq(approval.id, id), eq(approval.workspaceId, workspaceId)));
  return rows[0] ?? null;
}

export async function listApprovals(
  db: Database,
  workspaceId: string,
  opts?: { status?: string; agentId?: string; kind?: string; limit?: number }
) {
  const conditions = [eq(approval.workspaceId, workspaceId)];
  if (opts?.status) conditions.push(eq(approval.status, opts.status));
  if (opts?.agentId) conditions.push(eq(approval.agentId, opts.agentId));
  if (opts?.kind) conditions.push(eq(approval.kind, opts.kind));
  return db
    .select()
    .from(approval)
    .where(and(...conditions))
    .orderBy(desc(approval.createdAt))
    .limit(opts?.limit ?? 100);
}

/**
 * App-level dedupe for skill install proposals: no unique DB constraint on
 * pending skill_install per source_trace_id. Scans recent pending rows.
 */
export async function findPendingSkillInstall(
  db: Database,
  workspaceId: string,
  sourceTraceId: string,
) {
  if (!sourceTraceId) return null;
  const rows = await listApprovals(db, workspaceId, {
    status: "pending",
    kind: ApprovalKind.SKILL_INSTALL,
    limit: 100,
  });
  for (const row of rows) {
    const payload = row.payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) continue;
    const source = (payload as Record<string, unknown>).source_trace_id;
    if (typeof source === "string" && source === sourceTraceId) {
      return row;
    }
  }
  return null;
}

export async function decideApproval(
  db: Database,
  id: string,
  workspaceId: string,
  decision: "approved" | "rejected",
  userId: string
) {
  const now = new Date().toISOString();
  const rows = await db
    .update(approval)
    .set({
      status: decision,
      decidedByUserId: userId,
      decidedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(approval.id, id),
        eq(approval.workspaceId, workspaceId),
        eq(approval.status, "pending")
      )
    )
    .returning();
  return rows[0] ?? null;
}
