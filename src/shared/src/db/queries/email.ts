import { eq, desc, and, inArray } from "drizzle-orm";
import { emails } from "../schema";
import type { Database } from "../index";
import type { EmailDirection } from "../../types";
import {
  OutboundEmailDeliveryStatus,
  buildOutboundDeliveryKey,
  type OutboundEmailDeliveryStatusType,
} from "../../constants";

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

export type OutboundClaimOutcome =
  | "claimed"
  | "replay"
  | "in_progress"
  | "pending_approval"
  | "ambiguous"
  | "failed_terminal";

export type OutboundClaimResult = {
  outcome: OutboundClaimOutcome;
  email: typeof emails.$inferSelect;
};

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

/**
 * Durably claim an outbound send identity before any external provider side effect.
 * Concurrent callers share workspace-scoped uniqueness on delivery_key.
 * Failed claims may be reclaimed with the same message/R2 identities; ambiguous never resends.
 * Pass status=pending_approval to gate high-stakes sends behind human approval.
 */
export async function claimOutboundEmailDelivery(
  db: Database,
  data: {
    agentId: string;
    workspaceId: string;
    idempotencyKey: string;
    fromEmail: string;
    toEmail: string;
    subject: string;
    messageId: string;
    r2Key: string;
    htmlBody?: string;
    attachments?: string;
    inReplyTo?: string;
    references?: string;
    /** Initial claim status. Defaults to pending (immediate send path). */
    status?: OutboundEmailDeliveryStatusType | string;
  },
): Promise<OutboundClaimResult> {
  const deliveryKey = buildOutboundDeliveryKey(data.agentId, data.idempotencyKey);
  const initialStatus = data.status ?? OutboundEmailDeliveryStatus.PENDING;
  const { email, created } = await createEmailIfAbsent(db, {
    agentId: data.agentId,
    workspaceId: data.workspaceId,
    fromEmail: data.fromEmail,
    toEmail: data.toEmail,
    subject: data.subject,
    r2Key: data.r2Key,
    isWhitelisted: false,
    forwarded: false,
    direction: "outbound",
    messageId: data.messageId,
    deliveryKey,
    inReplyTo: data.inReplyTo ?? "",
    references: data.references ?? "",
    htmlBody: data.htmlBody ?? "",
    attachments: data.attachments ?? "[]",
    status: initialStatus,
  });

  if (created) {
    // Fresh insert always wins the claim — including pending_approval drafts.
    return { outcome: "claimed", email };
  }

  // Delivery key embeds agentId; still refuse cross-agent inspection of an existing claim.
  if (email.agentId !== data.agentId) {
    return { outcome: "failed_terminal", email };
  }

  return classifyOutboundClaim(db, email);
}

async function classifyOutboundClaim(
  db: Database,
  email: typeof emails.$inferSelect,
): Promise<OutboundClaimResult> {
  if (email.status === OutboundEmailDeliveryStatus.SENT) {
    return { outcome: "replay", email };
  }
  if (email.status === OutboundEmailDeliveryStatus.AMBIGUOUS) {
    return { outcome: "ambiguous", email };
  }
  if (email.status === OutboundEmailDeliveryStatus.PENDING_APPROVAL) {
    return { outcome: "pending_approval", email };
  }
  if (email.status === OutboundEmailDeliveryStatus.REJECTED) {
    return { outcome: "failed_terminal", email };
  }
  if (email.status === OutboundEmailDeliveryStatus.FAILED) {
    const reclaimed = await transitionOutboundEmailStatus(
      db,
      email.id,
      email.workspaceId,
      [OutboundEmailDeliveryStatus.FAILED],
      OutboundEmailDeliveryStatus.PENDING,
    );
    if (reclaimed) {
      return { outcome: "claimed", email: reclaimed };
    }
    const again = await getEmailById(db, email.id, email.workspaceId);
    if (!again) throw new Error("outbound email claim disappeared after conflict");
    if (again.status === OutboundEmailDeliveryStatus.SENT) {
      return { outcome: "replay", email: again };
    }
    if (again.status === OutboundEmailDeliveryStatus.AMBIGUOUS) {
      return { outcome: "ambiguous", email: again };
    }
    if (again.status === OutboundEmailDeliveryStatus.PENDING_APPROVAL) {
      return { outcome: "pending_approval", email: again };
    }
    if (again.status === OutboundEmailDeliveryStatus.REJECTED) {
      return { outcome: "failed_terminal", email: again };
    }
    if (
      again.status === OutboundEmailDeliveryStatus.PENDING ||
      again.status === OutboundEmailDeliveryStatus.SENDING
    ) {
      return { outcome: "in_progress", email: again };
    }
    return { outcome: "failed_terminal", email: again };
  }
  if (
    email.status === OutboundEmailDeliveryStatus.PENDING ||
    email.status === OutboundEmailDeliveryStatus.SENDING
  ) {
    return { outcome: "in_progress", email };
  }
  // Unexpected historical status — treat as non-resend terminal.
  return { outcome: "failed_terminal", email };
}

/** Conditional status transition for outbound claim state machine. */
export async function transitionOutboundEmailStatus(
  db: Database,
  id: string,
  workspaceId: string,
  fromStatuses: readonly OutboundEmailDeliveryStatusType[] | readonly string[],
  toStatus: OutboundEmailDeliveryStatusType | string,
): Promise<typeof emails.$inferSelect | null> {
  const rows = await db
    .update(emails)
    .set({ status: toStatus })
    .where(
      and(
        eq(emails.id, id),
        eq(emails.workspaceId, workspaceId),
        inArray(emails.status, [...fromStatuses]),
      ),
    )
    .returning();
  return rows[0] ?? null;
}

export async function markOutboundEmailSending(
  db: Database,
  id: string,
  workspaceId: string,
): Promise<typeof emails.$inferSelect | null> {
  return transitionOutboundEmailStatus(
    db,
    id,
    workspaceId,
    [OutboundEmailDeliveryStatus.PENDING],
    OutboundEmailDeliveryStatus.SENDING,
  );
}

/** Release a human-approved outbound claim into the normal pending→sending path. */
export async function releaseOutboundEmailFromApproval(
  db: Database,
  id: string,
  workspaceId: string,
): Promise<typeof emails.$inferSelect | null> {
  return transitionOutboundEmailStatus(
    db,
    id,
    workspaceId,
    [OutboundEmailDeliveryStatus.PENDING_APPROVAL],
    OutboundEmailDeliveryStatus.PENDING,
  );
}

/** Reject a high-stakes outbound claim; terminal for this delivery key. */
export async function markOutboundEmailRejected(
  db: Database,
  id: string,
  workspaceId: string,
): Promise<typeof emails.$inferSelect | null> {
  return transitionOutboundEmailStatus(
    db,
    id,
    workspaceId,
    [OutboundEmailDeliveryStatus.PENDING_APPROVAL],
    OutboundEmailDeliveryStatus.REJECTED,
  );
}

export async function markOutboundEmailSent(
  db: Database,
  id: string,
  workspaceId: string,
): Promise<typeof emails.$inferSelect | null> {
  return transitionOutboundEmailStatus(
    db,
    id,
    workspaceId,
    [
      OutboundEmailDeliveryStatus.PENDING,
      OutboundEmailDeliveryStatus.SENDING,
    ],
    OutboundEmailDeliveryStatus.SENT,
  );
}

export async function markOutboundEmailFailed(
  db: Database,
  id: string,
  workspaceId: string,
): Promise<typeof emails.$inferSelect | null> {
  return transitionOutboundEmailStatus(
    db,
    id,
    workspaceId,
    [
      OutboundEmailDeliveryStatus.PENDING,
      OutboundEmailDeliveryStatus.SENDING,
    ],
    OutboundEmailDeliveryStatus.FAILED,
  );
}

/**
 * Mark ambiguous only from sending (external attempt started). Pending without
 * a provider call should use failed, not ambiguous.
 */
export async function markOutboundEmailAmbiguous(
  db: Database,
  id: string,
  workspaceId: string,
): Promise<typeof emails.$inferSelect | null> {
  return transitionOutboundEmailStatus(
    db,
    id,
    workspaceId,
    [OutboundEmailDeliveryStatus.SENDING],
    OutboundEmailDeliveryStatus.AMBIGUOUS,
  );
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
