import { NextRequest } from "next/server";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { writeError, writeJSON } from "@/lib/middleware/helpers";
import { getDb } from "@/lib/db";
import { playbookRunToResponse } from "@/lib/api/responses";
import { PlaybookEngineError, cancelPlaybookRun } from "@/lib/services/playbook-engine";

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB);
  const runId = ctx.params?.runId;
  if (!runId) return writeError("run id is required", 400);

  try {
    const run = await cancelPlaybookRun(db, ws.workspaceId, runId);
    if (!run) return writeError("run not found", 404);
    return writeJSON({ run: playbookRunToResponse(run) });
  } catch (e) {
    if (e instanceof PlaybookEngineError && e.code === "NOT_FOUND") {
      return writeError("run not found", 404);
    }
    throw e;
  }
});
