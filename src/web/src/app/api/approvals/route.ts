import { NextRequest } from "next/server";
import { queries } from "@phneakngar/shared";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { writeJSON } from "@/lib/middleware/helpers";
import { approvalToResponse } from "@/lib/api/responses";

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB);
  const status = req.nextUrl.searchParams.get("status") ?? undefined;
  const agentId = req.nextUrl.searchParams.get("agent_id") ?? undefined;
  const kind = req.nextUrl.searchParams.get("kind") ?? undefined;
  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 100, 1), 200) : 100;

  const rows = await queries.approval.listApprovals(db, ws.workspaceId, {
    status,
    agentId,
    kind,
    limit,
  });

  return writeJSON({ items: rows.map(approvalToResponse) });
});
