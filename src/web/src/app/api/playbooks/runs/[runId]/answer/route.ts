import { NextRequest } from "next/server";
import { AnswerPlaybookRunRequestSchema } from "@phneakngar/shared";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { parseBody, writeError, writeJSON } from "@/lib/middleware/helpers";
import { getDb } from "@/lib/db";
import { playbookRunToResponse } from "@/lib/api/responses";
import { resolveServerEmailDomain } from "@/lib/email-domain";
import { PlaybookEngineError, answerPlaybookHumanInput } from "@/lib/services/playbook-engine";

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB);
  const runId = ctx.params?.runId;
  if (!runId) return writeError("run id is required", 400);

  const [body, err] = await parseBody(req, AnswerPlaybookRunRequestSchema);
  if (err) return err;

  try {
    const run = await answerPlaybookHumanInput(db, ws.workspaceId, runId, body.answer, {
      emailDomain: resolveServerEmailDomain(ctx.env),
    });
    if (!run) return writeError("run not found", 404);
    return writeJSON({ run: playbookRunToResponse(run) });
  } catch (e) {
    if (e instanceof PlaybookEngineError) {
      return writeError(e.message, e.code === "NOT_FOUND" ? 404 : 400);
    }
    throw e;
  }
});
