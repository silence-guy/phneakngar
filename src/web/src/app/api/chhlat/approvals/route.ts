import { NextRequest } from "next/server";
import { z } from "zod";
import { ApprovalKind, queries } from "@phneakngar/shared";
import { getDb, withD1Retry } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { withChhlatMachine } from "@/lib/middleware/chhlat";
import { parseBody, writeJSON, writeError } from "@/lib/middleware/helpers";
import { approvalToResponse } from "@/lib/api/responses";
import { invalidate, cacheKeys } from "@/lib/cache";

/**
 * Machine-authenticated create for durable tool_action approvals from the CLI
 * control_request bridge. Web UI still lists/decides via /api/approvals.
 *
 * Body is intentionally local (no shared schema file change in this slice).
 */
const CreateChhlatToolApprovalSchema = z.object({
  chhlat_id: z.string().min(1),
  agent_id: z.string().min(1).optional().nullable(),
  tool_name: z.string().optional().nullable(),
  tool_class: z.string().optional().nullable(),
  request_id: z.string().optional().nullable(),
  title: z.string().optional(),
  summary: z.string().optional(),
  input: z.unknown().optional(),
  policy_reason: z.string().optional().nullable(),
  // Reserved for forward-compat; CLI always sends tool_action and we force it.
  kind: z.string().optional().nullable(),
});

export const POST = withAuth(async (req: NextRequest, ctx) => {
  if (!ctx.workspaceId) {
    return writeError("Forbidden: machine token required", 403);
  }

  const db = getDb(ctx.env.DB);

  const [body, err] = await parseBody(req, CreateChhlatToolApprovalSchema);
  if (err) return err;

  if (!body.chhlat_id) return writeError("chhlat_id required", 400);

  const chhlatAuth = await withChhlatMachine(db, ctx, body.chhlat_id);
  if (chhlatAuth instanceof Response) return chhlatAuth;

  const { workspaceId, chhlatId } = chhlatAuth;

  const agentId: string | null =
    typeof body.agent_id === "string" && body.agent_id.trim()
      ? body.agent_id.trim()
      : null;

  if (agentId) {
    // Scope agent to workspace before insert (no post-check ownership).
    const agent = await withD1Retry(() =>
      queries.agent.getAgent(db, agentId!, workspaceId),
    );
    if (!agent) return writeError("agent not found in workspace", 404);
  }

  const toolName =
    typeof body.tool_name === "string" && body.tool_name.trim()
      ? body.tool_name.trim()
      : null;
  const toolClass =
    typeof body.tool_class === "string" && body.tool_class.trim()
      ? body.tool_class.trim()
      : null;
  const requestId =
    typeof body.request_id === "string" && body.request_id.trim()
      ? body.request_id.trim()
      : null;
  const policyReason =
    typeof body.policy_reason === "string" && body.policy_reason.trim()
      ? body.policy_reason.trim()
      : null;

  const title =
    (typeof body.title === "string" && body.title.trim()
      ? body.title.trim()
      : null) ??
    (toolName ? `Tool: ${toolName}` : toolClass ? `Tool class: ${toolClass}` : "Tool action");

  const summary =
    (typeof body.summary === "string" && body.summary.trim()
      ? body.summary.trim()
      : null) ??
    policyReason ??
    "High-stakes tool requires human approval";

  // CLI control_request bridge always creates tool_action rows (not outbound_email
  // side-effect kinds) so web decide can mark status without missing emailId.
  const approval = await withD1Retry(() =>
    queries.approval.createApproval(db, {
      workspaceId,
      agentId,
      kind: ApprovalKind.TOOL_ACTION,
      title,
      summary,
      payload: {
        source: "cli_control_request",
        chhlatId,
        toolName,
        toolClass,
        requestId,
        policyReason,
        input: body.input ?? null,
      },
    }),
  );

  invalidate(cacheKeys.overviewAttention(workspaceId)).catch(() => {});

  return writeJSON({ approval: approvalToResponse(approval) }, 201);
});
