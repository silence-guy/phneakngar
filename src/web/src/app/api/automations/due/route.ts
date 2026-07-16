import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { writeJSON } from "@/lib/middleware/helpers";
import { promoteDueAutomationsForWorkspace } from "@/lib/services/automation";
import { resolveServerEmailDomain } from "@/lib/email-domain";

/**
 * Stateless due scan: list enabled automations whose next_run_at <= now,
 * claim each run, enqueue AUTOMATION_EVENT tasks. Safe to call repeatedly.
 */
export const POST = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB);
  const emailDomain = resolveServerEmailDomain(ctx.env);
  const enqueued = await promoteDueAutomationsForWorkspace(db, ws.workspaceId, {
    emailDomain,
  });

  return writeJSON({ enqueued });
});
