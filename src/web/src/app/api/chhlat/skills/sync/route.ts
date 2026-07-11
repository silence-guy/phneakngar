import { NextRequest } from "next/server";
import { queries, SkillSyncRequestSchema } from "@phneakngar/shared";
import { withAuth } from "@/lib/middleware/auth";
import { withChhlatMachine } from "@/lib/middleware/chhlat";
import { parseBody, writeJSON, writeError } from "@/lib/middleware/helpers";
import { getDb, withD1Retry } from "@/lib/db";

export const POST = withAuth(async (req: NextRequest, ctx) => {
  if (!ctx.workspaceId) {
    return writeError("Forbidden: machine token required", 403);
  }

  const db = getDb(ctx.env.DB);

  const [body, err] = await parseBody(req, SkillSyncRequestSchema);
  if (err) return err;

  if (!body.chhlat_id) return writeError("chhlat_id required", 400);

  const chhlatAuth = await withChhlatMachine(db, ctx, body.chhlat_id);
  if (chhlatAuth instanceof Response) return chhlatAuth;

  const { workspaceId } = chhlatAuth;

  if (body.scope === "global") {
    await withD1Retry(() =>
      queries.agentSkill.syncGlobalSkills(
        db,
        workspaceId,
        body.runtime,
        body.skills,
        body.chhlat_id,
      )
    );
  } else {
    if (!body.agent_id) return writeError("agent_id required for agent scope", 400);
    await withD1Retry(() =>
      queries.agentSkill.syncAgentSkills(
        db,
        body.agent_id!,
        body.runtime,
        workspaceId,
        body.skills,
      )
    );
  }

  return writeJSON({ status: "ok" });
});
