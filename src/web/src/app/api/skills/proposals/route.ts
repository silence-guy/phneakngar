import { NextRequest } from "next/server";
import { ProposeSkillFromTaskRequestSchema } from "@phneakngar/shared";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { parseBody, writeError, writeJSON } from "@/lib/middleware/helpers";
import { approvalToResponse } from "@/lib/api/responses";
import { proposeSkillFromCompletedTask } from "@/lib/services/skill-proposal";
import { invalidate, cacheKeys } from "@/lib/cache";

/**
 * POST /api/skills/proposals
 * Explicit propose path from a completed task → pending skill_install approval.
 * Idempotent per source_trace_id while a pending approval exists.
 */
export const POST = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const [body, err] = await parseBody(req, ProposeSkillFromTaskRequestSchema);
  if (err) return err;

  const db = getDb(ctx.env.DB);
  const result = await proposeSkillFromCompletedTask(db, {
    workspaceId: ws.workspaceId,
    userId: ctx.userId,
    task_id: body.task_id,
    agent_id: body.agent_id,
    runtime: body.runtime,
  });

  if (!result.ok) {
    return writeError(result.error, result.status);
  }

  if (!result.reused) {
    invalidate(cacheKeys.overviewAttention(ws.workspaceId)).catch(() => {});
  }

  return writeJSON({
    approval: approvalToResponse(result.approval),
    proposal: result.proposal,
    reused: result.reused,
  });
});
