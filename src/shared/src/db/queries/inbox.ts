import { eq, and, desc, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { inboxUnread, message } from "../schema";
import type { Database } from "../index";

const UNREAD_ELIGIBLE_TYPES = ["user_dm_message", "email_notification", "calendar_event"];

export function isUnreadEligible(
  task: { parentTaskId?: string | null; traceId?: string | null; type: string; context?: unknown },
): boolean {
  if (task.parentTaskId != null) return false;
  if (task.traceId == null) return false;
  if (!UNREAD_ELIGIBLE_TYPES.includes(task.type)) return false;
  if (task.type === "email_notification" && (task.context as any)?.isInternal === true) return false;
  return true;
}

/**
 * upsertUnreadEntry - SQL required
 *
 * Reason: Drizzle ORM's onConflictDoUpdate() does not support conditional WHERE clauses
 * on the excluded values (e.g., "WHERE excluded.completed_at >= inbox_unread.completed_at").
 * This conditional upsert is necessary to only update if the new entry is more recent.
 */
export async function upsertUnreadEntry(
  db: Database,
  entry: {
    conversationId: string;
    userId: string;
    workspaceId: string;
    agentId: string;
    taskId: string;
    taskType: string;
    taskStatus: string;
    taskPrompt: string | null;
    completedAt: string;
    latestMessageId: string | null;
  },
) {
  const id = nanoid();
  // SQL required: conditional upsert with WHERE on excluded values
  await db.run(sql`
    INSERT INTO inbox_unread (id, conversation_id, user_id, workspace_id, agent_id, task_id, task_type, task_status, task_prompt, completed_at, latest_message_id)
    VALUES (${id}, ${entry.conversationId}, ${entry.userId}, ${entry.workspaceId}, ${entry.agentId}, ${entry.taskId}, ${entry.taskType}, ${entry.taskStatus}, ${entry.taskPrompt}, ${entry.completedAt}, ${entry.latestMessageId})
    ON CONFLICT (conversation_id, user_id) DO UPDATE SET
      agent_id = excluded.agent_id,
      task_id = excluded.task_id,
      task_type = excluded.task_type,
      task_status = excluded.task_status,
      task_prompt = excluded.task_prompt,
      completed_at = excluded.completed_at,
      latest_message_id = excluded.latest_message_id
    WHERE excluded.completed_at >= inbox_unread.completed_at
  `);
}

/**
 * updateUnreadLatestMessage - ORM refactored
 *
 * Simple UPDATE with equality conditions - uses Drizzle ORM operators.
 */
export async function updateUnreadLatestMessage(
  db: Database,
  conversationId: string,
  userId: string,
  messageId: string,
) {
  await db
    .update(inboxUnread)
    .set({ latestMessageId: messageId })
    .where(and(eq(inboxUnread.conversationId, conversationId), eq(inboxUnread.userId, userId)));
}

/**
 * deleteUnreadEntry - ORM refactored
 *
 * Simple DELETE with equality conditions - uses Drizzle ORM operators.
 */
export async function deleteUnreadEntry(
  db: Database,
  conversationId: string,
  userId: string,
) {
  await db
    .delete(inboxUnread)
    .where(and(eq(inboxUnread.conversationId, conversationId), eq(inboxUnread.userId, userId)));
}

/**
 * deleteUnreadByConversation - ORM refactored
 *
 * Simple DELETE with equality condition - uses Drizzle ORM operators.
 */
export async function deleteUnreadByConversation(
  db: Database,
  conversationId: string,
) {
  await db
    .delete(inboxUnread)
    .where(eq(inboxUnread.conversationId, conversationId));
}

/**
 * deleteUnreadByChannel - SQL required
 *
 * Reason: The subquery requires joining with the conversation table to filter by channel.
 * While Drizzle supports subqueries, the correlated subquery pattern here is more
 * idiomatic in raw SQL and avoids complex ORM subquery construction.
 */
export async function deleteUnreadByChannel(
  db: Database,
  workspaceId: string,
  channelName: string,
) {
  // SQL required: correlated subquery for channel-based deletion
  await db.run(sql`
    DELETE FROM inbox_unread
    WHERE conversation_id IN (
      SELECT id FROM conversation
      WHERE workspace_id = ${workspaceId} AND channel = ${channelName}
    )
  `);
}

/**
 * deleteAllUnreadEntries - ORM refactored
 *
 * Simple DELETE with equality conditions - uses Drizzle ORM operators.
 */
export async function deleteAllUnreadEntries(
  db: Database,
  userId: string,
  workspaceId: string,
) {
  await db
    .delete(inboxUnread)
    .where(and(eq(inboxUnread.userId, userId), eq(inboxUnread.workspaceId, workspaceId)));
}

/**
 * findLatestAssistantMessageId - ORM refactored
 *
 * SELECT with conditions, ORDER BY, and LIMIT - uses Drizzle ORM operators.
 */
export async function findLatestAssistantMessageId(
  db: Database,
  conversationId: string,
): Promise<string | null> {
  const rows = await db
    .select({ id: message.id })
    .from(message)
    .where(and(
      eq(message.conversationId, conversationId),
      eq(message.role, "assistant"),
      eq(message.status, "active")
    ))
    .orderBy(desc(message.createdAt))
    .limit(1);
  return rows[0]?.id ?? null;
}

/**
 * listUnreadConversations - SQL required
 *
 * Reason: Complex multi-table JOIN (inbox_unread -> conversation -> message -> agent)
 * with column aliases and dynamic IN clause for types. The dynamic type filtering
 * with sql.join() is cleaner in raw SQL. ORM could handle this but would require
 * multiple query builders and more complex TypeScript code.
 */
export async function listUnreadConversations(
  db: Database,
  userId: string,
  workspaceId: string,
  opts?: { limit?: number; before?: string; types?: string[] }
) {
  const limit = opts?.limit ?? 30;
  const beforeClause = opts?.before
    ? sql`AND u.completed_at < ${opts.before}`
    : sql``;

  const types = opts?.types?.length ? opts.types : ["user_dm_message"];
  const typePlaceholders = sql.join(types.map(t => sql`${t}`), sql`, `);

  // SQL required: complex multi-table JOIN with column aliases
  const rows = await db.all<{
    id: string;
    agent_id: string;
    title: string;
    channel: string;
    latest_response: string;
    latest_response_at: string;
    root_prompt: string | null;
    agent_name: string | null;
    agent_avatar_url: string | null;
    root_task_status: string | null;
    root_task_type: string | null;
  }>(sql`
    SELECT u.conversation_id AS id,
           u.agent_id,
           c.title,
           c.channel,
           m.content AS latest_response,
           u.completed_at AS latest_response_at,
           u.task_prompt AS root_prompt,
           a.name AS agent_name,
           a.avatar_url AS agent_avatar_url,
           u.task_status AS root_task_status,
           u.task_type AS root_task_type
    FROM inbox_unread u
    INNER JOIN conversation c ON c.id = u.conversation_id
    LEFT JOIN message m ON m.id = u.latest_message_id
    LEFT JOIN agent a ON a.id = u.agent_id AND a.workspace_id = u.workspace_id
    WHERE u.user_id = ${userId}
      AND u.workspace_id = ${workspaceId}
      AND u.task_type IN (${typePlaceholders})
      ${beforeClause}
    ORDER BY u.completed_at DESC
    LIMIT ${limit + 1}
  `);

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);

  return { items, hasMore };
}

/**
 * getUnreadCount - SQL required
 *
 * Reason: COUNT with JOIN and dynamic IN clause. The sql.join() pattern for
 * building dynamic type filters is cleaner in raw SQL.
 */
export async function getUnreadCount(
  db: Database,
  userId: string,
  workspaceId: string,
  types?: string[],
) {
  const validTypes = types?.length ? types : ["user_dm_message"];
  const typePlaceholders = sql.join(validTypes.map(t => sql`${t}`), sql`, `);

  // SQL required: COUNT with JOIN and dynamic type IN clause
  const rows = await db.all<{ count: number }>(sql`
    SELECT COUNT(*) AS count
    FROM inbox_unread u
    INNER JOIN conversation c ON c.id = u.conversation_id
    WHERE u.user_id = ${userId}
      AND u.workspace_id = ${workspaceId}
      AND u.task_type IN (${typePlaceholders})
  `);

  return rows[0]?.count ?? 0;
}

/**
 * markConversationRead - SQL required
 *
 * Reason: UPSERT with ON CONFLICT - Drizzle's onConflictDoUpdate() doesn't support
 * the WHERE clause variant needed here. Also, we need to set last_read_at to the
 * current timestamp on conflict.
 */
export async function markConversationRead(
  db: Database,
  userId: string,
  conversationId: string,
) {
  const now = new Date().toISOString();
  // SQL required: UPSERT with ON CONFLICT
  await db.run(sql`
    INSERT INTO conversation_read_state (id, conversation_id, user_id, last_read_at, created_at)
    VALUES (${nanoid()}, ${conversationId}, ${userId}, ${now}, ${now})
    ON CONFLICT (conversation_id, user_id)
    DO UPDATE SET last_read_at = ${now}
  `);
  await deleteUnreadEntry(db, conversationId, userId);
}

/**
 * markAllConversationsRead - SQL required
 *
 * Reason: INSERT with SELECT subquery - bulk insert derived from a SELECT statement.
 * This is a SQLite-specific pattern that cannot be expressed cleanly in Drizzle ORM
 * without multiple queries or raw SQL.
 */
export async function markAllConversationsRead(
  db: Database,
  userId: string,
  workspaceId: string,
) {
  const now = new Date().toISOString();
  // SQL required: INSERT with SELECT subquery for bulk upsert
  await db.run(sql`
    INSERT INTO conversation_read_state (id, conversation_id, user_id, last_read_at, created_at)
    SELECT lower(hex(randomblob(11))), c.id, ${userId}, ${now}, ${now}
    FROM conversation c
    WHERE c.user_id = ${userId}
      AND c.workspace_id = ${workspaceId}
    ON CONFLICT (conversation_id, user_id)
    DO UPDATE SET last_read_at = ${now}
  `);
  await deleteAllUnreadEntries(db, userId, workspaceId);
}
