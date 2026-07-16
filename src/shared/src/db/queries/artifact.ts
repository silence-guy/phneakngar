import { eq, desc, and } from "drizzle-orm";
import { artifact, conversation } from "../schema";
import type { Database } from "../index";
import type { Artifact } from "../../types";
import { ArtifactSource } from "../../constants";

export async function createArtifact(
  db: Database,
  data: {
    id?: string;
    conversationId: string;
    agentId: string;
    workspaceId: string;
    taskId?: string | null;
    filename: string;
    contentType: string;
    size: number;
    r2Key: string;
    thumbnailR2Key?: string;
    source?: string;
  }
) {
  const rows = await db.insert(artifact).values({
    ...(data.id ? { id: data.id } : {}),
    conversationId: data.conversationId,
    agentId: data.agentId,
    workspaceId: data.workspaceId,
    taskId: data.taskId ?? null,
    filename: data.filename,
    contentType: data.contentType,
    size: data.size,
    r2Key: data.r2Key,
    thumbnailR2Key: data.thumbnailR2Key,
    source: data.source ?? ArtifactSource.AGENT,
  }).returning();
  return rows[0]!;
}

/**
 * Idempotent insert for retryable delivery paths. On PK conflict, returns the
 * existing workspace-scoped row (never another workspace's artifact).
 */
export async function createArtifactIfAbsent(
  db: Database,
  data: {
    id: string;
    conversationId: string;
    agentId: string;
    workspaceId: string;
    taskId?: string | null;
    filename: string;
    contentType: string;
    size: number;
    r2Key: string;
    thumbnailR2Key?: string;
    source?: string;
  },
): Promise<{ artifact: typeof artifact.$inferSelect; created: boolean }> {
  const rows = await db
    .insert(artifact)
    .values({
      id: data.id,
      conversationId: data.conversationId,
      agentId: data.agentId,
      workspaceId: data.workspaceId,
      taskId: data.taskId ?? null,
      filename: data.filename,
      contentType: data.contentType,
      size: data.size,
      r2Key: data.r2Key,
      thumbnailR2Key: data.thumbnailR2Key,
      source: data.source ?? ArtifactSource.AGENT,
    })
    .onConflictDoNothing({ target: artifact.id })
    .returning();
  if (rows[0]) return { artifact: rows[0], created: true };

  const existing = await getArtifact(db, data.id, data.workspaceId);
  if (!existing) {
    throw new Error("artifact idempotency conflict could not be resolved");
  }
  return { artifact: existing, created: false };
}

export async function listArtifactsByConversation(
  db: Database,
  conversationId: string,
  workspaceId: string,
  opts?: { source?: string; limit?: number },
) {
  const conditions = [
    eq(artifact.conversationId, conversationId),
    eq(artifact.workspaceId, workspaceId),
  ];
  if (opts?.source) {
    conditions.push(eq(artifact.source, opts.source));
  }
  let query = db
    .select()
    .from(artifact)
    .where(and(...conditions))
    .orderBy(desc(artifact.createdAt));
  if (opts?.limit != null) {
    query = query.limit(opts.limit) as typeof query;
  }
  return query;
}

/** List artifacts produced by a task; always workspace-scoped first. */
export async function listArtifactsByTask(
  db: Database,
  workspaceId: string,
  taskId: string,
  opts?: { source?: string; limit?: number },
) {
  const conditions = [
    eq(artifact.workspaceId, workspaceId),
    eq(artifact.taskId, taskId),
  ];
  if (opts?.source) {
    conditions.push(eq(artifact.source, opts.source));
  }
  let query = db
    .select()
    .from(artifact)
    .where(and(...conditions))
    .orderBy(desc(artifact.createdAt));
  if (opts?.limit != null) {
    query = query.limit(opts.limit) as typeof query;
  }
  return query;
}

export async function getArtifact(db: Database, id: string, workspaceId: string) {
  const rows = await db
    .select()
    .from(artifact)
    .where(and(eq(artifact.id, id), eq(artifact.workspaceId, workspaceId)));
  return rows[0] ?? null;
}

export async function getArtifactForOwner(
  db: Database,
  id: string,
  workspaceId: string,
  userId: string,
) {
  const rows = await db
    .select({ artifact })
    .from(artifact)
    .innerJoin(
      conversation,
      and(
        eq(conversation.id, artifact.conversationId),
        eq(conversation.workspaceId, artifact.workspaceId),
      ),
    )
    .where(
      and(
        eq(artifact.id, id),
        eq(artifact.workspaceId, workspaceId),
        eq(conversation.workspaceId, workspaceId),
        eq(conversation.userId, userId),
      ),
    );
  return rows[0]?.artifact ?? null;
}

export function artifactToResponse(row: typeof artifact.$inferSelect): Artifact {
  return {
    id: row.id,
    conversation_id: row.conversationId,
    agent_id: row.agentId,
    task_id: row.taskId ?? null,
    filename: row.filename,
    content_type: row.contentType,
    size: row.size,
    source: row.source,
    has_thumbnail: row.thumbnailR2Key != null,
    created_at: row.createdAt,
  };
}
