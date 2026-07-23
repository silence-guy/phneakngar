import { NextRequest } from "next/server";
import { StartPlaybookRunRequestSchema, queries } from "@phneakngar/shared";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { parseBody, writeError, writeJSON } from "@/lib/middleware/helpers";
import { playbookRunToResponse } from "@/lib/api/responses";
import { resolveServerEmailDomain } from "@/lib/email-domain";
import { PlaybookEngineError, startPlaybookRun } from "@/lib/services/playbook-engine";

export const GET = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB);
  const playbookId = ctx.params?.id;
  if (!playbookId) return writeError("playbook id is required", 400);

  const rows = await queries.playbookRun.listPlaybookRuns(db, ws.workspaceId, { playbookId });
  return writeJSON({ items: rows.map(playbookRunToResponse) });
});

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB);
  const playbookId = ctx.params?.id;
  if (!playbookId) return writeError("playbook id is required", 400);

  const [body, err] = await parseBody(req, StartPlaybookRunRequestSchema);
  if (err) return err;

  try {
    const run = await startPlaybookRun(db, {
      workspaceId: ws.workspaceId,
      playbookId,
      agentId: body.agent_id,
      input: body.input ?? null,
      conversationId: body.conversation_id ?? null,
      startedByUserId: ctx.userId,
      emailDomain: resolveServerEmailDomain(ctx.env),
    });
    if (!run) return writeError("failed to start run", 500);
    return writeJSON({ run: playbookRunToResponse(run) }, 201);
  } catch (e) {
    if (e instanceof PlaybookEngineError) {
      return writeError(e.message, e.code === "NOT_FOUND" ? 404 : 400);
    }
    throw e;
  }
});
