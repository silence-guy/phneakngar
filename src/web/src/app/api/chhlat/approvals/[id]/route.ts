/**
 * Machine-authenticated GET for a single approval (CLI hold/resume poll).
 * Workspace-scoped via machine token workspaceId.
 */

import { NextRequest } from "next/server";
import { queries } from "@phneakngar/shared";
import { getDb, withD1Retry } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { writeJSON, writeError } from "@/lib/middleware/helpers";
import { approvalToResponse } from "@/lib/api/responses";

export const GET = withAuth(async (req: NextRequest, ctx) => {
  if (!ctx.workspaceId) {
    return writeError("Forbidden: machine token required", 403);
  }

  const id = ctx.params?.id;
  if (!id) return writeError("approval id is required", 400);

  const db = getDb(ctx.env.DB);
  const row = await withD1Retry(() =>
    queries.approval.getApproval(db, id, ctx.workspaceId!),
  );
  if (!row) return writeError("approval not found", 404);

  return writeJSON({ approval: approvalToResponse(row) });
});
