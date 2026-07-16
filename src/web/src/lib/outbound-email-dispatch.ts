import {
  queries,
  DEV_WEB_URL,
  parseEmailHandle,
  buildMimeMessage,
  extractThreadId,
  buildEmailMapKey,
  EMAIL_NOTIFY_SECRET_HEADER,
  OutboundEmailDeliveryStatus,
} from "@phneakngar/shared";
import { writeJSON, writeError } from "@/lib/middleware/helpers";
import { emailToResponse } from "@/lib/api/responses";
import { broadcastToUser } from "@/lib/broadcast";
import { invalidate, cacheKeys } from "@/lib/cache";
import { fetchEmailWorker } from "@/lib/email-worker";
import { NextResponse } from "next/server";

type Db = Parameters<typeof queries.email.getEmailById>[0];

export type OutboundEmailRow = {
  id: string;
  agentId: string;
  workspaceId: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  messageId: string;
  r2Key: string;
  htmlBody?: string | null;
  attachments?: string | null;
  inReplyTo?: string | null;
  references?: string | null;
  status?: string | null;
};

export type OutboundDispatchOpts = {
  db: Db;
  cfEnv: Env;
  emailDomain: string;
  workspaceId: string;
  agent: { id: string; ownerId?: string | null };
  email: OutboundEmailRow;
  customAccountId?: string;
  conversationId?: string;
  traceId?: string;
  sourceTaskId?: string;
};

function writeDeliveryError(
  message: string,
  status: number,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

async function broadcastEmailSentEvent(
  db: Db,
  conversationId: string,
  ownerId: string,
  agentId: string,
  to: string,
  subject: string,
  emailId: string,
  from: string,
  targetConversationId?: string,
  targetAgentId?: string,
) {
  const eventContent = `Email sent to ${to}: ${subject}`;
  const metadataObj = {
    emailId,
    subject,
    from,
    to,
    direction: "outbound" as const,
    ...(targetConversationId ? { targetConversationId, targetAgentId } : {}),
  };
  const metadata = JSON.stringify(metadataObj);
  const eventMsg = await queries.message.createMessage(db, {
    conversationId,
    role: "event",
    content: eventContent,
    metadata,
  });
  broadcastToUser(ownerId, {
    type: "conversation.message",
    conversationId,
    message: {
      id: eventMsg.id,
      conversation_id: eventMsg.conversationId,
      role: eventMsg.role as "event",
      content: eventMsg.content,
      task_id: eventMsg.taskId,
      attachment_ids: null,
      metadata: metadataObj,
      created_at: eventMsg.createdAt,
    },
  }).catch(() => {});
  broadcastToUser(ownerId, { type: "email.sent", agentId }).catch(() => {});
}

async function finalizeSuccessfulSend(
  db: Db,
  claim: { id: string; messageId: string; r2Key: string },
  workspaceId: string,
  agent: { id: string; ownerId?: string | null },
  body: {
    agentId: string;
    to: string;
    subject: string;
    inReplyTo?: string;
    references?: string;
  },
  fromAddress: string,
  validatedConversationId: string | undefined,
  outboundTargetConvId?: string,
  outboundTargetAgentId?: string,
) {
  const sent = await queries.email.markOutboundEmailSent(db, claim.id, workspaceId);
  const email = sent ?? (await queries.email.getEmailById(db, claim.id, workspaceId));
  if (!email) {
    return writeError("outbound email claim missing after send", 500);
  }

  invalidate(cacheKeys.overviewEmailStats(workspaceId)).catch(() => {});

  if (validatedConversationId && email.messageId) {
    const threadId = extractThreadId(body.references, body.inReplyTo, email.messageId);
    if (threadId) {
      await queries.conversationMap.createMapping(db, {
        key: buildEmailMapKey(body.agentId, threadId),
        workspaceId,
        conversationId: validatedConversationId,
      });
    }
    if (agent.ownerId) {
      await broadcastEmailSentEvent(
        db,
        validatedConversationId,
        agent.ownerId,
        body.agentId,
        body.to,
        body.subject,
        email.id,
        fromAddress,
        outboundTargetConvId,
        outboundTargetAgentId,
      );
    }
  }

  return writeJSON(emailToResponse(email));
}

type AttachmentMeta = { key: string; filename: string; contentType: string; size?: number };

function parseAttachments(raw: string | null | undefined): AttachmentMeta[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as AttachmentMeta[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Dispatch an already-claimed outbound email (status must already be `sending`).
 * Used by /api/email/send and by approval decide → approved.
 */
export async function dispatchClaimedOutboundEmail(
  opts: OutboundDispatchOpts,
): Promise<NextResponse> {
  const {
    db,
    cfEnv,
    emailDomain,
    workspaceId,
    agent,
    email,
    customAccountId,
    conversationId: validatedConversationId,
    traceId,
    sourceTaskId,
  } = opts;

  const claimMessageId = email.messageId;
  const claimR2Key = email.r2Key;
  const fromAddress = email.fromEmail;
  const htmlBody = email.htmlBody || "";
  const attachments = parseAttachments(email.attachments);
  const body = {
    agentId: email.agentId,
    to: email.toEmail,
    subject: email.subject,
    inReplyTo: email.inReplyTo || undefined,
    references: email.references || undefined,
  };

  // Local delivery shortcut: both addresses use this deployment's configured domain.
  const senderHandle = parseEmailHandle(fromAddress, emailDomain);
  const recipientHandle = parseEmailHandle(body.to, emailDomain);
  if (senderHandle && recipientHandle) {
    const recipientAgent = await queries.agent.getAgentByHandle(db, recipientHandle);
    if (recipientAgent && recipientAgent.workspaceId === workspaceId) {
      let localProviderAttempted = false;
      try {
        const fetchedAttachments = (
          await Promise.all(
            attachments.map(async (att) => {
              const obj = await cfEnv.EMAIL_BUCKET.get(att.key);
              if (!obj) return null;
              const raw = await obj.arrayBuffer();
              const bytes = new Uint8Array(raw);
              let binary = "";
              for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]!);
              const base64 = btoa(binary);
              return { filename: att.filename, contentType: att.contentType, base64 };
            }),
          )
        ).filter((a): a is { filename: string; contentType: string; base64: string } => a !== null);

        const rawMime = buildMimeMessage({
          from: fromAddress,
          to: body.to,
          subject: body.subject,
          messageId: claimMessageId,
          inReplyTo: body.inReplyTo,
          references: body.references,
          body: htmlBody,
          bodyType: "text/html",
          attachments: fetchedAttachments,
        });

        await cfEnv.EMAIL_BUCKET.put(claimR2Key, rawMime, {
          httpMetadata: { contentType: "message/rfc822" },
        });

        const isWhitelisted = await queries.whitelist.isWhitelisted(
          db,
          recipientAgent.id,
          recipientAgent.workspaceId,
          fromAddress,
          emailDomain,
        );

        const isSelfSend = body.agentId === recipientAgent.id;
        const notifyPayload = JSON.stringify({
          agentId: recipientAgent.id,
          workspaceId: recipientAgent.workspaceId,
          r2Key: claimR2Key,
          from: fromAddress,
          to: body.to,
          subject: body.subject,
          isWhitelisted,
          forwarded: false,
          messageId: claimMessageId,
          deliveryKey: `internal:${recipientAgent.id}:${claimMessageId}`,
          inReplyTo: body.inReplyTo ?? "",
          references: body.references ?? "",
          isInternal: true,
          ...(traceId ? { traceId } : {}),
          ...(sourceTaskId ? { sourceTaskId } : {}),
          ...(!isSelfSend && validatedConversationId
            ? { senderConversationId: validatedConversationId, senderAgentId: body.agentId }
            : {}),
        });
        const notifyInit = {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            [EMAIL_NOTIFY_SECRET_HEADER]: cfEnv.EMAIL_NOTIFY_SECRET,
          },
          body: notifyPayload,
        };

        localProviderAttempted = true;
        let notifyRes: Response;
        try {
          notifyRes = await cfEnv.WORKER_SELF_REFERENCE!.fetch(
            "http://internal/api/email/notify",
            notifyInit,
          );
        } catch {
          try {
            notifyRes = await fetch(`${DEV_WEB_URL}/api/email/notify`, notifyInit);
          } catch {
            await queries.email.markOutboundEmailAmbiguous(db, email.id, workspaceId);
            return writeDeliveryError(
              "local delivery outcome is ambiguous; not safe to resend with the same idempotency key",
              502,
              {
                status: OutboundEmailDeliveryStatus.AMBIGUOUS,
                messageId: claimMessageId,
                r2Key: claimR2Key,
              },
            );
          }
        }
        if (!notifyRes.ok) {
          await queries.email.markOutboundEmailAmbiguous(db, email.id, workspaceId);
          const errBody = await notifyRes.text();
          return writeDeliveryError(`local delivery ambiguous: ${errBody}`, 502, {
            status: OutboundEmailDeliveryStatus.AMBIGUOUS,
            messageId: claimMessageId,
            r2Key: claimR2Key,
          });
        }

        const notifyData = (await notifyRes.json()) as { ok: boolean; conversationId?: string };
        const outboundTargetConvId = !isSelfSend ? notifyData.conversationId : undefined;
        const outboundTargetAgentId =
          !isSelfSend && outboundTargetConvId ? recipientAgent.id : undefined;

        return await finalizeSuccessfulSend(
          db,
          { id: email.id, messageId: claimMessageId, r2Key: claimR2Key },
          workspaceId,
          agent,
          body,
          fromAddress,
          validatedConversationId,
          outboundTargetConvId,
          outboundTargetAgentId,
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (localProviderAttempted) {
          await queries.email.markOutboundEmailAmbiguous(db, email.id, workspaceId);
          return writeDeliveryError(`local delivery outcome is ambiguous: ${msg}`, 502, {
            status: OutboundEmailDeliveryStatus.AMBIGUOUS,
            messageId: claimMessageId,
            r2Key: claimR2Key,
          });
        }
        await queries.email.markOutboundEmailFailed(db, email.id, workspaceId);
        return writeDeliveryError(`local delivery failed: ${msg}`, 500, {
          status: OutboundEmailDeliveryStatus.FAILED,
          messageId: claimMessageId,
          r2Key: claimR2Key,
        });
      }
    }
  }

  const emailPayload = JSON.stringify({
    agentId: body.agentId,
    workspaceId,
    to: body.to,
    subject: body.subject,
    htmlBody,
    inReplyTo: body.inReplyTo || "",
    references: body.references || "",
    customAccountId: customAccountId || undefined,
    messageId: claimMessageId,
    r2Key: claimR2Key,
    /** Worker-side gate: only send when claim is already `sending`. */
    emailId: email.id,
    attachmentKeys:
      attachments.length > 0
        ? attachments.map((a) => ({
            key: a.key,
            filename: a.filename,
            contentType: a.contentType,
          }))
        : undefined,
  });

  let emailRes: Response;
  try {
    emailRes = await fetchEmailWorker(cfEnv, "/send/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: emailPayload,
    });
  } catch {
    await queries.email.markOutboundEmailAmbiguous(db, email.id, workspaceId);
    return writeDeliveryError(
      "email worker request failed with unknown outcome; not safe to resend with the same idempotency key",
      502,
      {
        status: OutboundEmailDeliveryStatus.AMBIGUOUS,
        messageId: claimMessageId,
        r2Key: claimR2Key,
      },
    );
  }

  if (!emailRes.ok) {
    const errBody = await emailRes.text();
    let parsed: { phase?: string; error?: string } = {};
    try {
      parsed = JSON.parse(errBody) as { phase?: string; error?: string };
    } catch {
      // non-JSON worker error
    }
    if (
      parsed.phase === "pre_send" ||
      emailRes.status === 400 ||
      emailRes.status === 404 ||
      emailRes.status === 413
    ) {
      await queries.email.markOutboundEmailFailed(db, email.id, workspaceId);
      return writeDeliveryError(`email worker error: ${parsed.error ?? errBody}`, emailRes.status, {
        status: OutboundEmailDeliveryStatus.FAILED,
        messageId: claimMessageId,
        r2Key: claimR2Key,
      });
    }
    await queries.email.markOutboundEmailAmbiguous(db, email.id, workspaceId);
    return writeDeliveryError(`email worker ambiguous outcome: ${parsed.error ?? errBody}`, 502, {
      status: OutboundEmailDeliveryStatus.AMBIGUOUS,
      messageId: claimMessageId,
      r2Key: claimR2Key,
    });
  }

  const emailResult = (await emailRes.json()) as {
    ok: boolean;
    r2Key: string;
    messageId?: string;
  };
  const finalMessageId = emailResult.messageId || claimMessageId;
  const finalR2Key = emailResult.r2Key || claimR2Key;
  if (finalMessageId !== claimMessageId || finalR2Key !== claimR2Key) {
    await queries.email.markOutboundEmailAmbiguous(db, email.id, workspaceId);
    return writeDeliveryError(
      "email worker returned identities that do not match the durable claim",
      502,
      {
        status: OutboundEmailDeliveryStatus.AMBIGUOUS,
        messageId: claimMessageId,
        r2Key: claimR2Key,
      },
    );
  }

  return finalizeSuccessfulSend(
    db,
    { id: email.id, messageId: claimMessageId, r2Key: claimR2Key },
    workspaceId,
    agent,
    body,
    fromAddress,
    validatedConversationId,
  );
}

/** Transition pending → sending then dispatch. Used after approval release. */
export async function sendReleasedOutboundEmail(
  opts: OutboundDispatchOpts,
): Promise<NextResponse> {
  const { db, workspaceId, email } = opts;
  const sending = await queries.email.markOutboundEmailSending(db, email.id, workspaceId);
  if (!sending) {
    const current = await queries.email.getEmailById(db, email.id, workspaceId);
    if (current?.status === OutboundEmailDeliveryStatus.SENT) {
      return writeJSON(emailToResponse(current));
    }
    return writeDeliveryError(
      "outbound email delivery already in progress for this claim",
      409,
      {
        status: current?.status ?? OutboundEmailDeliveryStatus.SENDING,
        email: current ? emailToResponse(current) : undefined,
      },
    );
  }
  return dispatchClaimedOutboundEmail({ ...opts, email: sending });
}
