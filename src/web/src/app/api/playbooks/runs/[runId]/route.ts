import { NextRequest } from "next/server";
import { queries } from "@phneakngar/shared";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { writeError, writeJSON } from "@/lib/middleware/helpers";
import { playbookRunToResponse, playbookStepRunToResponse } from "@/lib/api/responses";

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB);
  const runId = ctx.params?.runId;
  if (!runId) return writeError("run id is required", 400);

  const run = await queries.playbookRun.getPlaybookRun(db, runId, ws.workspaceId);
  if (!run) return writeError("run not found", 404);

  const steps = await queries.playbookRun.listStepRuns(db, runId, ws.workspaceId);
  return writeJSON({
    run: playbookRunToResponse(run),
    steps: steps.map(playbookStepRunToResponse),
  });
});
