/**
 * Workspace activity feed (MVP).
 * Full commercial company timeline is not claimed.
 */

import { NextRequest } from "next/server";
import { queries } from "@phneakngar/shared";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { writeJSON } from "@/lib/middleware/helpers";

function eventToResponse(row: {
  id: string;
  workspaceId: string;
  kind: string;
  actorType: string | null;
  actorId: string | null;
  subjectType: string | null;
  subjectId: string | null;
  summary: string;
  payloadJson: string | null;
  dedupeKey: string | null;
  createdAt: string;
}) {
  return {
    id: row.id,
    workspace_id: row.workspaceId,
    kind: row.kind,
    actor_type: row.actorType,
    actor_id: row.actorId,
    subject_type: row.subjectType,
    subject_id: row.subjectId,
    summary: row.summary,
    payload: row.payloadJson
      ? (() => {
          try {
            return JSON.parse(row.payloadJson);
          } catch {
            return null;
          }
        })()
      : null,
    created_at: row.createdAt,
  };
}

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const url = new URL(req.url);
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : 50;

  const db = getDb(ctx.env.DB);
  try {
    const rows = await queries.activityEvent.listActivityEvents(db, ws.workspaceId, {
      limit: Number.isFinite(limit) ? limit : 50,
    });
    return writeJSON({ items: rows.map(eventToResponse) });
  } catch {
    // Pre-0054: table missing — empty feed.
    return writeJSON({ items: [] });
  }
});
