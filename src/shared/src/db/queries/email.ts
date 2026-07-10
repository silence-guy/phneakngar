import { eq, desc, and } from "drizzle-orm";
import { emails } from "../schema";
import type { Database } from "../index";
import type { EmailDirection } from "../../types";

export interface EmailPagination {
  limit: number;
  offset: number;
}

export interface CreateEmailData {
  agentId: string;
  workspaceId: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  r2Key: string;
  isWhitelisted: boolean;
  forwarded: boolean;
  direction: EmailDirection;
  messageId?: string;
  deliveryKey?: string;
  inReplyTo?: string;
  references?: string;
  htmlBody?: string;
  attachments?: string;
  status?: string;
}

export async function createEmail(
  db: Database,
  data: CreateEmailData
) {
  const rows = await db.insert(emails).values(data).returning();
  return rows[0]!;
}

export async function createEmailIfAbsent(
  db: Database,
  data: CreateEmailData & { deliveryKey: string },
): Promise<{ email: typeof emails.$inferSelect; created: boolean }> {
  const rows = await db
    .insert(emails)
    .values(data)
    .onConflictDoNothing({ target: [emails.workspaceId, emails.deliveryKey] })
    .returning();
  if (rows[0]) return { email: rows[0], created: true };

  const existing = await getEmailByDeliveryKey(db, data.deliveryKey, data.workspaceId);
  if (!existing) throw new Error("email delivery idempotency conflict could not be resolved");
  return { email: existing, created: false };
}

export async function getEmailById(db: Database, id: string, workspaceId: string) {
  const rows = await db.select().from(emails).where(and(eq(emails.id, id), eq(emails.workspaceId, workspaceId)));
  return rows[0] ?? null;
}

export async function getEmailsByAgent(db: Database, agentId: string, workspaceId: string, status?: string, pagination?: EmailPagination) {
  const conditions = [eq(emails.agentId, agentId), eq(emails.workspaceId, workspaceId)];
  if (status) conditions.push(eq(emails.status, status));
  const q = db
    .select()
    .from(emails)
    .where(and(...conditions))
    .orderBy(desc(emails.createdAt));
  if (pagination) return q.limit(pagination.limit).offset(pagination.offset);
  return q;
}

export async function getInboxEmails(db: Database, agentId: string, agentEmail: string, workspaceId: string, status?: string, pagination?: EmailPagination) {
  const conditions = [eq(emails.agentId, agentId), eq(emails.toEmail, agentEmail), eq(emails.workspaceId, workspaceId), eq(emails.direction, "inbound")];
  if (status) conditions.push(eq(emails.status, status));
  const q = db.select().from(emails)
    .where(and(...conditions))
    .orderBy(desc(emails.createdAt));
  if (pagination) return q.limit(pagination.limit).offset(pagination.offset);
  return q;
}

export async function getSentEmails(db: Database, agentId: string, agentEmail: string, workspaceId: string, status?: string, pagination?: EmailPagination) {
  const conditions = [eq(emails.agentId, agentId), eq(emails.fromEmail, agentEmail), eq(emails.workspaceId, workspaceId), eq(emails.direction, "outbound")];
  if (status) conditions.push(eq(emails.status, status));
  const q = db.select().from(emails)
    .where(and(...conditions))
    .orderBy(desc(emails.createdAt));
  if (pagination) return q.limit(pagination.limit).offset(pagination.offset);
  return q;
}

export async function getTrustedEmails(db: Database, agentId: string, agentEmail: string, workspaceId: string, status?: string, pagination?: EmailPagination) {
  const conditions = [eq(emails.agentId, agentId), eq(emails.toEmail, agentEmail), eq(emails.workspaceId, workspaceId), eq(emails.isWhitelisted, true), eq(emails.direction, "inbound")];
  if (status) conditions.push(eq(emails.status, status));
  const q = db.select().from(emails)
    .where(and(...conditions))
    .orderBy(desc(emails.createdAt));
  if (pagination) return q.limit(pagination.limit).offset(pagination.offset);
  return q;
}

export async function getRejectedEmails(db: Database, agentId: string, agentEmail: string, workspaceId: string, status?: string, pagination?: EmailPagination) {
  const conditions = [eq(emails.agentId, agentId), eq(emails.toEmail, agentEmail), eq(emails.workspaceId, workspaceId), eq(emails.isWhitelisted, false), eq(emails.direction, "inbound")];
  if (status) conditions.push(eq(emails.status, status));
  const q = db.select().from(emails)
    .where(and(...conditions))
    .orderBy(desc(emails.createdAt));
  if (pagination) return q.limit(pagination.limit).offset(pagination.offset);
  return q;
}

export async function getEmailByDeliveryKey(db: Database, deliveryKey: string, workspaceId: string) {
  const rows = await db
    .select()
    .from(emails)
    .where(and(eq(emails.deliveryKey, deliveryKey), eq(emails.workspaceId, workspaceId)));
  return rows[0] ?? null;
}

export async function getEmailByMessageId(db: Database, messageId: string, workspaceId: string) {
  if (!messageId) return null;
  const rows = await db.select().from(emails).where(and(eq(emails.messageId, messageId), eq(emails.workspaceId, workspaceId)));
  return rows[0] ?? null;
}

export async function updateEmailStatus(db: Database, id: string, workspaceId: string, status: string) {
  const rows = await db.update(emails).set({ status }).where(and(eq(emails.id, id), eq(emails.workspaceId, workspaceId))).returning();
  return rows[0] ?? null;
}

export async function updateEmailWhitelisted(db: Database, id: string, workspaceId: string, isWhitelisted: boolean) {
  const rows = await db.update(emails).set({ isWhitelisted }).where(and(eq(emails.id, id), eq(emails.workspaceId, workspaceId))).returning();
  return rows[0] ?? null;
}

export async function deleteEmail(db: Database, id: string, workspaceId: string) {
  return db.delete(emails).where(and(eq(emails.id, id), eq(emails.workspaceId, workspaceId)));
}
