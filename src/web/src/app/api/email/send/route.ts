import { NextRequest } from "next/server";
import {
  queries,
  DEV_WEB_URL,
  SendEmailRequestSchema,
  parseEmailHandle,
  toPhneakngarAddress,
  buildMimeMessage,
  extractThreadId,
  buildEmailMapKey,
  isEmailDraftAttachmentKeyForScope,
  EMAIL_NOTIFY_SECRET_HEADER,
  IDEMPOTENCY_KEY_HEADER,
  OutboundEmailDeliveryStatus,
} from "@phneakngar/shared";
import { nanoid } from "nanoid";
import { getDb } from "@/lib/db"
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { writeJSON, writeError, parseBody } from "@/lib/middleware/helpers";
import { emailToResponse } from "@/lib/api/responses";
import { broadcastToUser } from "@/lib/broadcast";
import { cached, invalidate, cacheKeys } from "@/lib/cache";
import { fetchEmailWorker } from "@/lib/email-worker";
import { resolveServerEmailDomain } from "@/lib/email-domain";
import { NextResponse } from "next/server";

function writeDeliveryError(
  message: string,
  status: number,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

async function broadcastEmailSentEvent(
  db: Parameters<typeof queries.message.createMessage>[0],
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
    emailId, subject, from, to, direction: "outbound" as const,
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

function resolveIdempotencyKey(req: NextRequest, bodyKey?: string): string {
  const headerKey = req.headers.get(IDEMPOTENCY_KEY_HEADER)?.trim();
  if (headerKey) return headerKey.slice(0, 128);
  if (bodyKey?.trim()) return bodyKey.trim().slice(0, 128);
  return nanoid();
}

function resolveMessageDomain(fromAddress: string, emailDomain: string): string {
  const at = fromAddress.lastIndexOf("@");
  if (at > 0 && at < fromAddress.length - 1) {
    return fromAddress.slice(at + 1).replace(/>$/, "");
  }
  return emailDomain;
}

async function finalizeSuccessfulSend(
  db: ReturnType<typeof getDb>,
  claim: {
    id: string;
    messageId: string;
    r2Key: string;
  },
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
  const email = sent ?? await queries.email.getEmailById(db, claim.id, workspaceId);
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

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const cfEnv = ctx.env;
  const emailDomain = resolveServerEmailDomain(cfEnv);
  const db = getDb(cfEnv.DB);

  const [body, valErr] = await parseBody(req, SendEmailRequestSchema);
  if (valErr) return valErr;

  const agent = await queries.agent.getAgent(db, body.agentId, ws.workspaceId, ctx.userId);
  if (!agent) return writeError("agent not found in workspace", 404);

  let customAccountId = body.customAccountId;
  let fromAddress: string;

  if (body.from && !customAccountId) {
    const phneakngarAddr = agent.emailHandle ? toPhneakngarAddress(agent.emailHandle, emailDomain) : null;
    if (body.from === phneakngarAddr) {
      fromAddress = phneakngarAddr;
    } else {
      const allAccounts = await cached(cacheKeys.allEmailAccounts(ws.workspaceId), 600, () => queries.emailAccount.getAllEmailAccountsForWorkspace(db, ws.workspaceId));
      const match = allAccounts.find((a) => a.agentId === body.agentId && a.emailAddress === body.from);
      if (!match) {
        return writeError(`email address '${body.from}' is not configured for this agent`, 400);
      }
      customAccountId = match.id;
      fromAddress = match.emailAddress;
    }
  } else if (customAccountId) {
    const account = await queries.emailAccount.getEmailAccountScoped(db, customAccountId, body.agentId, ws.workspaceId);
    if (!account) {
      return writeError("custom email account not found", 404);
    }
    fromAddress = account.emailAddress;
  } else {
    if (!agent.emailHandle) {
      return writeError("agent has no email handle configured", 400);
    }
    fromAddress = toPhneakngarAddress(agent.emailHandle, emailDomain);
  }

  let validatedConversationId: string | undefined;
  if (body.conversationId) {
    const conv = await queries.conversation.getConversationForAgent(
      db,
      body.conversationId,
      ws.workspaceId,
      ctx.userId,
      body.agentId,
    );
    if (conv) validatedConversationId = body.conversationId;
  }

  const attachments = body.attachments ?? [];
  for (const attachment of attachments) {
    if (!isEmailDraftAttachmentKeyForScope(attachment.key, ws.workspaceId, ctx.userId)) {
      return writeError("invalid attachment key", 400);
    }
  }

  const idempotencyKey = resolveIdempotencyKey(req, body.idempotencyKey);
  const messageDomain = resolveMessageDomain(fromAddress, emailDomain);
  const messageId = `<${nanoid()}@${messageDomain}>`;
  const r2Id = nanoid();
  const r2Key = `emails/${r2Id}/raw`;
  const htmlBody = body.htmlBody || "";
  const attachmentsJson = JSON.stringify(attachments);

  const claim = await queries.email.claimOutboundEmailDelivery(db, {
    agentId: body.agentId,
    workspaceId: ws.workspaceId,
    idempotencyKey,
    fromEmail: fromAddress,
    toEmail: body.to,
    subject: body.subject,
    messageId,
    r2Key,
    htmlBody,
    attachments: attachmentsJson,
    inReplyTo: body.inReplyTo ?? "",
    references: body.references ?? "",
  });

  if (claim.outcome === "replay") {
    return writeJSON(emailToResponse(claim.email));
  }
  if (claim.outcome === "ambiguous") {
    return writeDeliveryError(
      "outbound email delivery is ambiguous for this idempotency key; not resending",
      409,
      {
        status: OutboundEmailDeliveryStatus.AMBIGUOUS,
        email: emailToResponse(claim.email),
      },
    );
  }
  if (claim.outcome === "in_progress") {
    return writeDeliveryError(
      "outbound email delivery already in progress for this idempotency key",
      409,
      {
        status: claim.email.status,
        email: emailToResponse(claim.email),
      },
    );
  }
  if (claim.outcome === "failed_terminal") {
    return writeDeliveryError(
      "outbound email delivery cannot be retried for this idempotency key",
      409,
      {
        status: claim.email.status,
        email: emailToResponse(claim.email),
      },
    );
  }

  // Winner: use durable identities from the claim row (not freshly generated on reclaim).
  const claimMessageId = claim.email.messageId;
  const claimR2Key = claim.email.r2Key;

  const sending = await queries.email.markOutboundEmailSending(db, claim.email.id, ws.workspaceId);
  if (!sending) {
    // Lost the sending race to a concurrent winner.
    const current = await queries.email.getEmailById(db, claim.email.id, ws.workspaceId);
    if (current?.status === OutboundEmailDeliveryStatus.SENT) {
      return writeJSON(emailToResponse(current));
    }
    return writeDeliveryError(
      "outbound email delivery already in progress for this idempotency key",
      409,
      {
        status: current?.status ?? OutboundEmailDeliveryStatus.SENDING,
        email: current ? emailToResponse(current) : undefined,
      },
    );
  }

  // Local delivery shortcut: both addresses use this deployment's configured domain.
  const senderHandle = parseEmailHandle(fromAddress, emailDomain);
  const recipientHandle = parseEmailHandle(body.to, emailDomain);
  if (senderHandle && recipientHandle) {
    const recipientAgent = await queries.agent.getAgentByHandle(db, recipientHandle);
    if (recipientAgent && recipientAgent.workspaceId === ws.workspaceId) {
      // Only mark failed (retryable) for errors before the local provider is invoked.
      // Once notify is attempted, never reclaim as failed — that would allow a resend.
      let localProviderAttempted = false;
      try {
        const fetchedAttachments = (await Promise.all(
          attachments.map(async (att) => {
            const obj = await cfEnv.EMAIL_BUCKET.get(att.key);
            if (!obj) return null;
            const raw = await obj.arrayBuffer();
            const bytes = new Uint8Array(raw);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]!);
            const base64 = btoa(binary);
            return { filename: att.filename, contentType: att.contentType, base64 };
          })
        )).filter((a): a is { filename: string; contentType: string; base64: string } => a !== null);

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

        const isWhitelisted = await queries.whitelist.isWhitelisted(db, recipientAgent.id, recipientAgent.workspaceId, fromAddress, emailDomain);

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
          ...(body.traceId ? { traceId: body.traceId } : {}),
          ...(body.sourceTaskId ? { sourceTaskId: body.sourceTaskId } : {}),
          ...(!isSelfSend && validatedConversationId ? { senderConversationId: validatedConversationId, senderAgentId: body.agentId } : {}),
        });
        const notifyInit = {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            [EMAIL_NOTIFY_SECRET_HEADER]: cfEnv.EMAIL_NOTIFY_SECRET,
          },
          body: notifyPayload,
        };

        // Provider attempt begins at notify — failures after this are ambiguous.
        localProviderAttempted = true;
        let notifyRes: Response;
        try {
          notifyRes = await cfEnv.WORKER_SELF_REFERENCE!.fetch("http://internal/api/email/notify", notifyInit);
        } catch {
          try {
            notifyRes = await fetch(`${DEV_WEB_URL}/api/email/notify`, notifyInit);
          } catch {
            await queries.email.markOutboundEmailAmbiguous(db, claim.email.id, ws.workspaceId);
            return writeDeliveryError(
              "local delivery outcome is ambiguous; not safe to resend with the same idempotency key",
              502,
              { status: OutboundEmailDeliveryStatus.AMBIGUOUS, messageId: claimMessageId, r2Key: claimR2Key },
            );
          }
        }
        if (!notifyRes.ok) {
          // Notify is the local provider; non-2xx after the attempt is ambiguous.
          await queries.email.markOutboundEmailAmbiguous(db, claim.email.id, ws.workspaceId);
          const errBody = await notifyRes.text();
          return writeDeliveryError(
            `local delivery ambiguous: ${errBody}`,
            502,
            { status: OutboundEmailDeliveryStatus.AMBIGUOUS, messageId: claimMessageId, r2Key: claimR2Key },
          );
        }

        const notifyData = await notifyRes.json() as { ok: boolean; conversationId?: string };
        const outboundTargetConvId = !isSelfSend ? notifyData.conversationId : undefined;
        const outboundTargetAgentId = !isSelfSend && outboundTargetConvId ? recipientAgent.id : undefined;

        // Must await so post-notify failures are caught (bare return escapes try/catch).
        return await finalizeSuccessfulSend(
          db,
          { id: claim.email.id, messageId: claimMessageId, r2Key: claimR2Key },
          ws.workspaceId,
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
          // Conditional update only applies while still sending; never rewrites sent.
          await queries.email.markOutboundEmailAmbiguous(db, claim.email.id, ws.workspaceId);
          return writeDeliveryError(
            `local delivery outcome is ambiguous: ${msg}`,
            502,
            {
              status: OutboundEmailDeliveryStatus.AMBIGUOUS,
              messageId: claimMessageId,
              r2Key: claimR2Key,
            },
          );
        }
        await queries.email.markOutboundEmailFailed(db, claim.email.id, ws.workspaceId);
        return writeDeliveryError(`local delivery failed: ${msg}`, 500, {
          status: OutboundEmailDeliveryStatus.FAILED,
          messageId: claimMessageId,
          r2Key: claimR2Key,
        });
      }
    }
  }

  // Delegate sending + R2 archival to the email worker with claimed identities.
  const emailPayload = JSON.stringify({
    agentId: body.agentId,
    workspaceId: ws.workspaceId,
    to: body.to,
    subject: body.subject,
    htmlBody,
    inReplyTo: body.inReplyTo || "",
    references: body.references || "",
    customAccountId: customAccountId || undefined,
    messageId: claimMessageId,
    r2Key: claimR2Key,
    attachmentKeys: attachments.length > 0
      ? attachments.map((a) => ({ key: a.key, filename: a.filename, contentType: a.contentType }))
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
    await queries.email.markOutboundEmailAmbiguous(db, claim.email.id, ws.workspaceId);
    return writeDeliveryError(
      "email worker request failed with unknown outcome; not safe to resend with the same idempotency key",
      502,
      { status: OutboundEmailDeliveryStatus.AMBIGUOUS, messageId: claimMessageId, r2Key: claimR2Key },
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
    if (parsed.phase === "pre_send" || emailRes.status === 400 || emailRes.status === 404 || emailRes.status === 413) {
      await queries.email.markOutboundEmailFailed(db, claim.email.id, ws.workspaceId);
      return writeDeliveryError(`email worker error: ${parsed.error ?? errBody}`, emailRes.status, {
        status: OutboundEmailDeliveryStatus.FAILED,
        messageId: claimMessageId,
        r2Key: claimR2Key,
      });
    }
    await queries.email.markOutboundEmailAmbiguous(db, claim.email.id, ws.workspaceId);
    return writeDeliveryError(`email worker ambiguous outcome: ${parsed.error ?? errBody}`, 502, {
      status: OutboundEmailDeliveryStatus.AMBIGUOUS,
      messageId: claimMessageId,
      r2Key: claimR2Key,
    });
  }

  const emailResult = await emailRes.json() as { ok: boolean; r2Key: string; messageId?: string };
  // Prefer claimed identities; worker should echo them.
  const finalMessageId = emailResult.messageId || claimMessageId;
  const finalR2Key = emailResult.r2Key || claimR2Key;
  if (finalMessageId !== claimMessageId || finalR2Key !== claimR2Key) {
    // Worker ignored claimed identities — contract violation; refuse silent success.
    await queries.email.markOutboundEmailAmbiguous(db, claim.email.id, ws.workspaceId);
    return writeDeliveryError(
      "email worker returned identities that do not match the durable claim",
      502,
      { status: OutboundEmailDeliveryStatus.AMBIGUOUS, messageId: claimMessageId, r2Key: claimR2Key },
    );
  }

  return finalizeSuccessfulSend(
    db,
    { id: claim.email.id, messageId: claimMessageId, r2Key: claimR2Key },
    ws.workspaceId,
    agent,
    body,
    fromAddress,
    validatedConversationId,
  );
});
