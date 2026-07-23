import { NextRequest } from "next/server";
import { playbookDefinitionSchema, queries } from "@phneakngar/shared";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { writeError, writeJSON } from "@/lib/middleware/helpers";
import { playbookToResponse } from "@/lib/api/responses";

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB);
  const id = ctx.params?.id;
  if (!id) return writeError("playbook id is required", 400);

  const existing = await queries.playbook.getPlaybook(db, id, ws.workspaceId);
  if (!existing) return writeError("playbook not found", 404);

  const parsed = playbookDefinitionSchema.safeParse(existing.definition);
  if (!parsed.success) {
    return writeError("playbook definition is invalid and cannot be published", 400);
  }

  const updated = await queries.playbook.updatePlaybook(db, id, ws.workspaceId, {
    status: "published",
  });
  if (!updated) return writeError("playbook not found", 404);

  return writeJSON({ playbook: playbookToResponse(updated) });
});
