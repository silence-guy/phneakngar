import {
  OutboundEmailDeliveryStatus,
  queries,
  UpdateEmailStatusRequestSchema,
} from "@phneakngar/shared";
import { getDb } from "@/lib/db"
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { writeJSON, writeError, parseBody } from "@/lib/middleware/helpers";
import { emailToResponse } from "@/lib/api/responses";

/** Delivery/approval pipeline statuses — never mutate via mailbox PATCH. */
const OUTBOUND_PIPELINE_STATUSES = new Set<string>([
  OutboundEmailDeliveryStatus.PENDING,
  OutboundEmailDeliveryStatus.PENDING_APPROVAL,
  OutboundEmailDeliveryStatus.SENDING,
  OutboundEmailDeliveryStatus.SENT,
  OutboundEmailDeliveryStatus.FAILED,
  OutboundEmailDeliveryStatus.AMBIGUOUS,
  OutboundEmailDeliveryStatus.REJECTED,
]);

export const GET = withAuth(async (req, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB);

  const id = ctx.params?.id;
  if (!id) return writeError("email id is required", 400);

  const email = await queries.email.getEmailById(db, id, ws.workspaceId);
  if (!email) return writeError("not found", 404);

  const agent = await queries.agent.getAgent(db, email.agentId, ws.workspaceId, ctx.userId);
  if (!agent) return writeError("not found", 404);

  return writeJSON(emailToResponse(email));
});

export const DELETE = withAuth(async (req, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB);

  const id = ctx.params?.id;
  if (!id) return writeError("email id is required", 400);

  const email = await queries.email.getEmailById(db, id, ws.workspaceId);
  if (!email) return writeError("not found", 404);

  const agent = await queries.agent.getAgent(db, email.agentId, ws.workspaceId, ctx.userId);
  if (!agent) return writeError("not found", 404);

  await queries.email.deleteEmail(db, id, ws.workspaceId);

  return new Response(null, { status: 204 });
});

export const PATCH = withAuth(async (req, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB);

  const id = ctx.params?.id;
  if (!id) return writeError("email id is required", 400);

  const email = await queries.email.getEmailById(db, id, ws.workspaceId);
  if (!email) return writeError("not found", 404);

  const agent = await queries.agent.getAgent(db, email.agentId, ws.workspaceId, ctx.userId);
  if (!agent) return writeError("not found", 404);

  const [body, valErr] = await parseBody(req, UpdateEmailStatusRequestSchema);
  if (valErr) return valErr;

  // Hard fence: approval/outbound state machine is not reachable via PATCH.
  if (OUTBOUND_PIPELINE_STATUSES.has(email.status)) {
    return writeError(
      "outbound delivery status cannot be changed via PATCH; use the approval decide path",
      409,
    );
  }

  const updated = await queries.email.updateEmailStatus(db, id, ws.workspaceId, body.status);
  if (!updated) return writeError("not found", 404);

  return writeJSON(emailToResponse(updated));
});
