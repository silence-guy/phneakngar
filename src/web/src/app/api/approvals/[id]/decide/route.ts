import { NextRequest } from "next/server";
import {
  ApprovalKind,
  DecideApprovalRequestSchema,
  OutboundEmailDeliveryStatus,
  approvalKindRequiresSideEffect,
  queries,
} from "@phneakngar/shared";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { parseBody, writeError, writeJSON } from "@/lib/middleware/helpers";
import { approvalToResponse, emailToResponse } from "@/lib/api/responses";
import { resolveServerEmailDomain } from "@/lib/email-domain";
import { sendReleasedOutboundEmail } from "@/lib/outbound-email-dispatch";
import { invalidate, cacheKeys } from "@/lib/cache";
import { buildEmailDecisionSystemEvent } from "@/components/chat-primitives/timeline-chrome";
import { handlePlaybookApprovalDecided } from "@/lib/services/playbook-engine";
import { log } from "@/lib/logger";

type OutboundEmailPayload = {
  emailId?: string;
  customAccountId?: string | null;
  conversationId?: string | null;
  traceId?: string | null;
  sourceTaskId?: string | null;
};

type Db = Parameters<typeof queries.approval.getApproval>[0];

/**
 * Thin chat system line for outbound email approve/reject (timeline-chrome quiet).
 * Idempotent on approval id — safe under decide retries. No-ops without conversationId.
 */
async function stampOutboundEmailDecisionSystemEvent(
  db: Db,
  opts: {
    decision: "approved" | "rejected";
    approvalId: string;
    conversationId?: string | null;
    email: { id: string; subject?: string | null; toEmail?: string | null };
  },
): Promise<void> {
  const conversationId =
    typeof opts.conversationId === "string" && opts.conversationId.trim()
      ? opts.conversationId.trim()
      : null;
  if (!conversationId) return;

  const draft = buildEmailDecisionSystemEvent({
    decision: opts.decision,
    approvalId: opts.approvalId,
    emailId: opts.email.id,
    subject: opts.email.subject ?? "",
    to: opts.email.toEmail ?? "",
  });
  try {
    await queries.message.createMessageIfAbsent(db, {
      id: draft.idempotencyId!,
      conversationId,
      role: draft.role,
      content: draft.content,
      metadata: draft.metadataJson,
    });
  } catch {
    // non-critical: decision side effects already applied
  }
}

type SkillInstallPayload = {
  name?: string;
  description?: string;
  source_trace_id?: string;
  runtime?: string;
  agentId?: string;
  taskId?: string;
};

function parsePayload(raw: unknown): OutboundEmailPayload {
  if (!raw || typeof raw !== "object") return {};
  return raw as OutboundEmailPayload;
}

function parseSkillInstallPayload(raw: unknown): SkillInstallPayload {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as SkillInstallPayload;
}

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB);
  const id = ctx.params?.id;
  if (!id) return writeError("approval id is required", 400);

  const [body, err] = await parseBody(req, DecideApprovalRequestSchema);
  if (err) return err;

  // Load first — do not terminal-decide until side effects succeed for email / skill install.
  const pending = await queries.approval.getApproval(db, id, ws.workspaceId);
  if (!pending) return writeError("approval not found", 404);
  if (pending.status !== "pending") {
    return writeError("approval not found or already decided", 409);
  }

  // skill_install: install catalog row on approve, then terminal decide.
  // Reject is status-only. Install is idempotent (upsert).
  if (pending.kind === ApprovalKind.SKILL_INSTALL) {
    if (body.decision === "rejected") {
      const decided = await queries.approval.decideApproval(
        db,
        id,
        ws.workspaceId,
        "rejected",
        ctx.userId,
      );
      if (!decided) {
        return writeError("approval not found or already decided", 409);
      }
      invalidate(cacheKeys.overviewAttention(ws.workspaceId)).catch(() => {});
      return writeJSON({ approval: approvalToResponse(decided) });
    }

    const skillPayload = parseSkillInstallPayload(pending.payload);
    const name = typeof skillPayload.name === "string" ? skillPayload.name.trim() : "";
    const description =
      typeof skillPayload.description === "string" ? skillPayload.description : "";
    const runtime =
      typeof skillPayload.runtime === "string" ? skillPayload.runtime.trim() : "";
    const agentId =
      (typeof skillPayload.agentId === "string" && skillPayload.agentId) ||
      pending.agentId ||
      "";

    if (!name || !runtime || !agentId) {
      return writeError("skill_install approval is missing name/runtime/agentId payload", 500);
    }

    const agent = await queries.agent.getAgent(
      db,
      agentId,
      ws.workspaceId,
      ctx.userId,
    );
    if (!agent) {
      return writeError("agent not found in workspace for skill install approval", 404);
    }

    // Side effect before terminal decide — re-approve is safe (idempotent upsert).
    const skill = await queries.agentSkill.installAgentSkill(db, {
      workspaceId: ws.workspaceId,
      agentId,
      runtime,
      name,
      description,
    });

    const decided = await queries.approval.decideApproval(
      db,
      id,
      ws.workspaceId,
      "approved",
      ctx.userId,
    );
    if (!decided) {
      // Skill installed but approval race lost — surface both truths.
      return writeJSON(
        {
          approval: approvalToResponse(pending),
          skill: {
            name: skill.name,
            description: skill.description,
            runtime: skill.runtime,
            agent_id: skill.agentId,
          },
          error: "skill installed but approval was already decided",
        },
        409,
      );
    }

    invalidate(cacheKeys.overviewAttention(ws.workspaceId)).catch(() => {});
    return writeJSON({
      approval: approvalToResponse(decided),
      skill: {
        name: skill.name,
        description: skill.description,
        runtime: skill.runtime,
        agent_id: skill.agentId,
      },
    });
  }

  // Non side-effect approvals (tool_action, automation_promote, …): status only.
  // Side-effect kinds (today: outbound_email) run release/send after decide.
  if (!approvalKindRequiresSideEffect(pending.kind)) {
    const decided = await queries.approval.decideApproval(
      db,
      id,
      ws.workspaceId,
      body.decision,
      ctx.userId,
    );
    if (!decided) {
      return writeError("approval not found or already decided", 409);
    }
    invalidate(cacheKeys.overviewAttention(ws.workspaceId)).catch(() => {});
    try {
      await queries.activityEvent.createActivityEvent(db, {
        workspaceId: ws.workspaceId,
        kind: "approval_decided",
        summary: `Approval ${body.decision}: ${pending.title || pending.kind}`,
        actorType: "user",
        actorId: ctx.userId,
        subjectType: "approval",
        subjectId: id,
        payloadJson: JSON.stringify({
          decision: body.decision,
          kind: pending.kind,
        }),
      });
    } catch {
      // activity_event may be missing pre-0054
    }
    if (pending.kind === ApprovalKind.PLAYBOOK_STEP_GATE) {
      await handlePlaybookApprovalDecided(db, decided, {
        emailDomain: resolveServerEmailDomain(ctx.env),
      }).catch((hookErr) => {
        log.warn("playbook hook failed on approval decide", { approvalId: id, err: String(hookErr) });
      });
    }
    return writeJSON({ approval: approvalToResponse(decided) });
  }

  const payload = parsePayload(pending.payload);
  const emailId = typeof payload.emailId === "string" ? payload.emailId : "";
  if (!emailId) {
    return writeError("outbound email approval is missing emailId payload", 500);
  }

  const email = await queries.email.getEmailById(db, emailId, ws.workspaceId);
  if (!email) {
    return writeError("outbound email claim not found", 404);
  }

  // ACL before any mutation — operator must own/see the agent in this workspace.
  const agent = await queries.agent.getAgent(
    db,
    email.agentId,
    ws.workspaceId,
    ctx.userId,
  );
  if (!agent) {
    return writeError("agent not found in workspace for outbound email approval", 404);
  }

  // Already past approval gate — reconcile approval row if claim already matches.
  if (email.status !== OutboundEmailDeliveryStatus.PENDING_APPROVAL) {
    const alreadyRejected =
      body.decision === "rejected" &&
      email.status === OutboundEmailDeliveryStatus.REJECTED;
    const alreadyReleased =
      body.decision === "approved" &&
      email.status !== OutboundEmailDeliveryStatus.REJECTED &&
      email.status !== OutboundEmailDeliveryStatus.PENDING_APPROVAL;

    if (!alreadyRejected && !alreadyReleased) {
      return writeJSON(
        {
          approval: approvalToResponse(pending),
          email: emailToResponse(email),
          error: "outbound email claim is no longer pending approval",
        },
        409,
      );
    }

    const decided = await queries.approval.decideApproval(
      db,
      id,
      ws.workspaceId,
      body.decision,
      ctx.userId,
    );
    if (!decided) {
      return writeError("approval not found or already decided", 409);
    }
    invalidate(cacheKeys.overviewAttention(ws.workspaceId)).catch(() => {});
    return writeJSON({
      approval: approvalToResponse(decided),
      email: emailToResponse(email),
    });
  }

  if (body.decision === "rejected") {
    const rejected = await queries.email.markOutboundEmailRejected(
      db,
      email.id,
      ws.workspaceId,
    );
    if (!rejected) {
      // Race: another path moved the claim. Leave approval pending for retry.
      const current = await queries.email.getEmailById(db, email.id, ws.workspaceId);
      return writeJSON(
        {
          approval: approvalToResponse(pending),
          email: current ? emailToResponse(current) : emailToResponse(email),
          error: "failed to mark outbound email rejected",
        },
        409,
      );
    }

    const decided = await queries.approval.decideApproval(
      db,
      id,
      ws.workspaceId,
      "rejected",
      ctx.userId,
    );
    if (!decided) {
      // Email is rejected but approval race lost — still return email truth.
      return writeJSON(
        {
          approval: approvalToResponse(pending),
          email: emailToResponse(rejected),
          error: "email rejected but approval was already decided",
        },
        409,
      );
    }
    await stampOutboundEmailDecisionSystemEvent(db, {
      decision: "rejected",
      approvalId: id,
      conversationId: payload.conversationId,
      email: rejected,
    });
    invalidate(cacheKeys.overviewAttention(ws.workspaceId)).catch(() => {});
    return writeJSON({
      approval: approvalToResponse(decided),
      email: emailToResponse(rejected),
    });
  }

  // approved → release first, then decide, then dispatch
  const released = await queries.email.releaseOutboundEmailFromApproval(
    db,
    email.id,
    ws.workspaceId,
  );
  if (!released) {
    const current = await queries.email.getEmailById(db, email.id, ws.workspaceId);
    return writeJSON(
      {
        approval: approvalToResponse(pending),
        email: current ? emailToResponse(current) : emailToResponse(email),
        error: "failed to release outbound email from approval",
      },
      409,
    );
  }

  const decided = await queries.approval.decideApproval(
    db,
    id,
    ws.workspaceId,
    "approved",
    ctx.userId,
  );
  if (!decided) {
    // Released but approval already decided elsewhere — surface for operator recovery.
    return writeJSON(
      {
        approval: approvalToResponse(pending),
        email: emailToResponse(released),
        error: "email released but approval was already decided",
      },
      409,
    );
  }

  await stampOutboundEmailDecisionSystemEvent(db, {
    decision: "approved",
    approvalId: id,
    conversationId: payload.conversationId,
    email: released,
  });

  invalidate(cacheKeys.overviewAttention(ws.workspaceId)).catch(() => {});

  const emailDomain = resolveServerEmailDomain(ctx.env);
  const sendRes = await sendReleasedOutboundEmail({
    db,
    cfEnv: ctx.env,
    emailDomain,
    workspaceId: ws.workspaceId,
    agent,
    email: released,
    customAccountId: payload.customAccountId || undefined,
    conversationId: payload.conversationId || undefined,
    traceId: payload.traceId || undefined,
    sourceTaskId: payload.sourceTaskId || undefined,
  });

  // Prefer structured JSON that includes both approval + email when send succeeds.
  if (sendRes.status >= 200 && sendRes.status < 300) {
    try {
      const sentBody = (await sendRes.clone().json()) as Record<string, unknown>;
      return writeJSON({
        approval: approvalToResponse(decided),
        email: sentBody,
      });
    } catch {
      return sendRes;
    }
  }

  // Surface send failure while keeping the decided approval + released claim.
  try {
    const errBody = (await sendRes.clone().json()) as Record<string, unknown>;
    return writeJSON(
      {
        approval: approvalToResponse(decided),
        error: errBody.error ?? "outbound send failed after approval",
        ...errBody,
      },
      sendRes.status,
    );
  } catch {
    return sendRes;
  }
});
