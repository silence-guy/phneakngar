import { NextRequest } from "next/server"
import { queries, MeetingStatus, EmailNotifyRequestSchema, EMAIL_NOTIFY_SECRET_HEADER } from "@phneakngar/shared"
import { getDb } from "@/lib/db"
import { hashSecret, safeEqualSecret } from "@phneakngar/shared/secrets"
import { withEnv } from "@/lib/middleware/env"
import { writeJSON, writeError, parseBody } from "@/lib/middleware/helpers"
import { broadcastToUser } from "@/lib/broadcast"
import { invalidate, cacheKeys } from "@/lib/cache"
import { dispatchEmailToAgent } from "@/lib/services/email-dispatch"

export const POST = withEnv(async (req: NextRequest, ctx) => {
  const secret = ctx.env.EMAIL_NOTIFY_SECRET
  if (!secret) return writeError("email notify secret not configured", 500)
  if (!safeEqualSecret(req.headers.get(EMAIL_NOTIFY_SECRET_HEADER), secret)) {
    return writeError("unauthorized", 401)
  }

  const db = getDb(ctx.env.DB)

  const [body, valErr] = await parseBody(req, EmailNotifyRequestSchema);
  if (valErr) return valErr;

  const agent = await queries.agent.getAgent(db, body.agentId, body.workspaceId)

  const deliveryKey = body.deliveryKey ?? `web:${hashSecret(
    body.messageId
      ? `${body.workspaceId}:${body.agentId}:message:${body.messageId}`
      : `${body.workspaceId}:${body.agentId}:r2:${body.r2Key}`,
  )}`
  const emailResult = await queries.email.createEmailIfAbsent(db, {
    agentId: body.agentId,
    workspaceId: body.workspaceId,
    fromEmail: body.from,
    toEmail: body.to ?? "",
    subject: body.subject,
    r2Key: body.r2Key,
    isWhitelisted: body.isWhitelisted,
    forwarded: body.forwarded,
    messageId: body.messageId,
    deliveryKey,
    inReplyTo: body.inReplyTo,
    references: body.references,
    direction: "inbound",
    attachments: body.attachments,
  })
  const email = emailResult.email
  if (!emailResult.created && (email.agentId !== body.agentId || email.r2Key !== body.r2Key)) {
    return writeError("email delivery key conflict", 409)
  }

  let meetingCreated = false
  if (body.meetingInfo && agent) {
    const mi = body.meetingInfo
    const meetingResult = await queries.meetingSession.createMeetingSessionIfAbsent(db, {
      id: `email-meeting-${email.id}`,
      agentId: body.agentId,
      workspaceId: body.workspaceId,
      title: mi.title || body.subject,
      meetingUrl: mi.meetingUrl,
      status: body.isWhitelisted ? MeetingStatus.SCHEDULED : MeetingStatus.PENDING,
      fromEmail: body.from,
      isWhitelisted: body.isWhitelisted,
      participants: mi.attendees.map(a => a.email),
      scheduledAt: mi.startTime,
    })
    meetingCreated = meetingResult.created
  }

  let conversationId: string | null = null;
  let dispatchCreated = false

  if (body.isWhitelisted && agent && agent.runtimeId && agent.ownerId) {
    const result = await dispatchEmailToAgent(db, email, agent, {
      isInternal: body.isInternal,
      senderConversationId: body.senderConversationId,
      senderAgentId: body.senderAgentId,
      traceId: body.traceId,
      sourceTaskId: body.sourceTaskId,
    })
    conversationId = result.conversationId
    dispatchCreated = result.created
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  await Promise.all([
    invalidate(cacheKeys.overviewEmailStats(body.workspaceId)),
    invalidate(cacheKeys.overviewTaskStats(body.workspaceId, dateStr)),
  ]);

  if (agent?.ownerId && (emailResult.created || meetingCreated || dispatchCreated)) {
    broadcastToUser(agent.ownerId, { type: "email.received", agentId: body.agentId }).catch(() => {})
  }

  return writeJSON({
    ok: true,
    duplicate: !emailResult.created && !meetingCreated && !dispatchCreated,
    ...(conversationId ? { conversationId } : {}),
  })
});
