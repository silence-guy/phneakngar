import { NextRequest } from "next/server";
import {
  queries,
  SendEmailRequestSchema,
  toPhneakngarAddress,
  isEmailDraftAttachmentKeyForScope,
  IDEMPOTENCY_KEY_HEADER,
  OutboundEmailDeliveryStatus,
  ApprovalKind,
  ToolClass,
  evaluateApprovalPolicy,
  mapToolClassToApprovalKind,
} from "@phneakngar/shared";
import { nanoid } from "nanoid";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { writeJSON, writeError, parseBody } from "@/lib/middleware/helpers";
import { emailToResponse, approvalToResponse } from "@/lib/api/responses";
import { cached, cacheKeys, invalidate } from "@/lib/cache";
import { resolveServerEmailDomain } from "@/lib/email-domain";
import { NextResponse } from "next/server";
import {
  dispatchClaimedOutboundEmail,
} from "@/lib/outbound-email-dispatch";

function writeDeliveryError(
  message: string,
  status: number,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json({ error: message, ...extra }, { status });
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
    const phneakngarAddr = agent.emailHandle
      ? toPhneakngarAddress(agent.emailHandle, emailDomain)
      : null;
    if (body.from === phneakngarAddr) {
      fromAddress = phneakngarAddr;
    } else {
      const allAccounts = await cached(cacheKeys.allEmailAccounts(ws.workspaceId), 600, () =>
        queries.emailAccount.getAllEmailAccountsForWorkspace(db, ws.workspaceId),
      );
      const match = allAccounts.find(
        (a) => a.agentId === body.agentId && a.emailAddress === body.from,
      );
      if (!match) {
        return writeError(`email address '${body.from}' is not configured for this agent`, 400);
      }
      customAccountId = match.id;
      fromAddress = match.emailAddress;
    }
  } else if (customAccountId) {
    const account = await queries.emailAccount.getEmailAccountScoped(
      db,
      customAccountId,
      body.agentId,
      ws.workspaceId,
    );
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
  // Shared policy: outbound_email is high-stakes. Explicit body.requiresApproval
  // force-requires; explicit false force-allows (operator override).
  const approvalPolicy = evaluateApprovalPolicy({
    toolClass: ToolClass.OUTBOUND_EMAIL,
    kind: ApprovalKind.OUTBOUND_EMAIL,
    forceRequire: body.requiresApproval === true,
    forceAllow: body.requiresApproval === false,
  });
  const requiresApproval = approvalPolicy.requiresApproval;

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
    status: requiresApproval
      ? OutboundEmailDeliveryStatus.PENDING_APPROVAL
      : OutboundEmailDeliveryStatus.PENDING,
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
  if (claim.outcome === "pending_approval") {
    return writeDeliveryError(
      "outbound email is awaiting human approval for this idempotency key",
      409,
      {
        status: OutboundEmailDeliveryStatus.PENDING_APPROVAL,
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

  // Fresh claim: either queue for human approval or proceed to send.
  if (
    requiresApproval ||
    claim.email.status === OutboundEmailDeliveryStatus.PENDING_APPROVAL
  ) {
    let approvalEmail = claim.email;
    if (approvalEmail.status !== OutboundEmailDeliveryStatus.PENDING_APPROVAL) {
      // Failed reclaim lands on pending; move into the approval gate.
      approvalEmail =
        (await queries.email.transitionOutboundEmailStatus(
          db,
          claim.email.id,
          ws.workspaceId,
          [OutboundEmailDeliveryStatus.PENDING],
          OutboundEmailDeliveryStatus.PENDING_APPROVAL,
        )) ?? approvalEmail;
    }
    const approvalKind =
      mapToolClassToApprovalKind(approvalPolicy.toolClass) ??
      approvalPolicy.approvalKind ??
      ApprovalKind.OUTBOUND_EMAIL;
    const approval = await queries.approval.createApproval(db, {
      workspaceId: ws.workspaceId,
      agentId: body.agentId,
      kind: approvalKind,
      title: `Send email: ${body.subject}`,
      summary: `To ${body.to}`,
      payload: {
        emailId: approvalEmail.id,
        customAccountId: customAccountId || null,
        conversationId: validatedConversationId || null,
        traceId: body.traceId || null,
        sourceTaskId: body.sourceTaskId || null,
        toolClass: approvalPolicy.toolClass,
        policyReason: approvalPolicy.reason,
      },
    });
    invalidate(cacheKeys.overviewAttention(ws.workspaceId)).catch(() => {});
    return writeJSON(
      {
        email: emailToResponse(approvalEmail),
        approval: approvalToResponse(approval),
        status: OutboundEmailDeliveryStatus.PENDING_APPROVAL,
      },
      202,
    );
  }

  // Winner of immediate-send path: use durable identities from the claim row.
  const sending = await queries.email.markOutboundEmailSending(
    db,
    claim.email.id,
    ws.workspaceId,
  );
  if (!sending) {
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

  // Prefer request content for dispatch; claim row supplies durable identities.
  // (Approval path reloads content from the durable email row instead.)
  return dispatchClaimedOutboundEmail({
    db,
    cfEnv,
    emailDomain,
    workspaceId: ws.workspaceId,
    agent,
    email: {
      ...sending,
      fromEmail: fromAddress,
      toEmail: body.to,
      subject: body.subject,
      htmlBody,
      attachments: attachmentsJson,
      inReplyTo: body.inReplyTo ?? "",
      references: body.references ?? "",
    },
    customAccountId,
    conversationId: validatedConversationId,
    traceId: body.traceId,
    sourceTaskId: body.sourceTaskId,
  });
});
