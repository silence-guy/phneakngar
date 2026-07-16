import { eq, and } from "drizzle-orm";
import type { Database } from "../index";
import { conversationMap } from "../schema";
import { nanoid } from "nanoid";

export async function findByKey(
  db: Database,
  key: string,
  workspaceId: string,
): Promise<string | null> {
  const rows = await db
    .select({ conversationId: conversationMap.conversationId })
    .from(conversationMap)
    .where(
      and(
        eq(conversationMap.key, key),
        eq(conversationMap.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  return rows[0]?.conversationId ?? null;
}

/**
 * Insert mapping or resolve to the winner under concurrent create retries.
 * Unique(key, workspace_id) + onConflictDoNothing makes the insert idempotent;
 * always re-read so callers converge on one conversation id.
 */
export async function createMapping(
  db: Database,
  opts: { key: string; workspaceId: string; conversationId: string },
): Promise<string> {
  await db
    .insert(conversationMap)
    .values({
      id: nanoid(),
      key: opts.key,
      workspaceId: opts.workspaceId,
      conversationId: opts.conversationId,
      createdAt: new Date().toISOString(),
    })
    .onConflictDoNothing();

  const effectiveConversationId = await findByKey(db, opts.key, opts.workspaceId);
  if (!effectiveConversationId) {
    throw new Error("conversation mapping conflict could not be resolved");
  }
  return effectiveConversationId;
}

/**
 * Get-or-create under concurrent/retry: prefer an existing mapping, otherwise
 * create. Concurrent creates still converge via createMapping's re-read.
 *
 * `created` is true only when this call's conversationId became the stored one
 * (or already was, after a no-prior-hit insert win). After a race loss, returns
 * the winner with created=false.
 */
export async function getOrCreateMapping(
  db: Database,
  opts: { key: string; workspaceId: string; conversationId: string },
): Promise<{ conversationId: string; created: boolean }> {
  const existing = await findByKey(db, opts.key, opts.workspaceId);
  if (existing) {
    return { conversationId: existing, created: false };
  }

  const conversationId = await createMapping(db, opts);
  return {
    conversationId,
    created: conversationId === opts.conversationId,
  };
}
