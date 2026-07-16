import { NextRequest } from "next/server";
import { ClaimIssueRequestSchema, queries } from "@phneakngar/shared";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { parseBody, writeError, writeJSON } from "@/lib/middleware/helpers";
import { issueToResponse } from "@/lib/api/responses";
import { invalidate, cacheKeys } from "@/lib/cache";

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB);
  const id = ctx.params?.id;
  if (!id) return writeError("issue id is required", 400);

  const [body, err] = await parseBody(req, ClaimIssueRequestSchema);
  if (err) return err;

  const existing = await queries.issue.getIssue(db, id, ws.workspaceId, ctx.userId);
  if (!existing) return writeError("issue not found", 404);

  const agent = await queries.agent.getAgent(db, body.agent_id, ws.workspaceId, ctx.userId);
  if (!agent) return writeError("agent not found in workspace", 404);

  const claimed = await queries.issue.claimIssue(db, id, ws.workspaceId, body.agent_id);
  if (!claimed) {
    return writeError("issue already claimed by another agent or not active", 409);
  }

  // Audit trail comment (best-effort; claim already applied).
  try {
    await queries.issueComment.createComment(db, {
      issueId: id,
      workspaceId: ws.workspaceId,
      authorType: "agent",
      authorId: body.agent_id,
      content: `Claimed by ${agent.name || body.agent_id}`,
    });
  } catch {
    // non-fatal
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  invalidate(cacheKeys.overviewTaskStats(ws.workspaceId, dateStr)).catch(() => {});
  return writeJSON({ issue: issueToResponse(claimed) });
});
