import { NextRequest } from "next/server";
import { CompactMemoryRequestSchema, queries } from "@phneakngar/shared";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { parseBody, writeError, writeJSON } from "@/lib/middleware/helpers";
import { memoryToResponse } from "@/lib/api/responses";
import { compactAgentMemory } from "@/lib/services/memory-compaction";

export const POST = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const [body, err] = await parseBody(req, CompactMemoryRequestSchema);
  if (err) return err;

  const db = getDb(ctx.env.DB);

  if (body.agent_id) {
    const agent = await queries.agent.getAgent(db, body.agent_id, ws.workspaceId, ctx.userId);
    if (!agent) return writeError("agent not found in workspace", 404);
  }

  const result = await compactAgentMemory(db, {
    workspaceId: ws.workspaceId,
    agent_id: body.agent_id,
    min_notes: body.min_notes,
    max_notes: body.max_notes,
    max_length: body.max_length,
    dry_run: body.dry_run,
  });

  return writeJSON({
    compacted: result.compacted,
    reason: result.reason,
    source_count: result.source_count,
    deleted_count: result.deleted_count,
    summary: result.summary,
    memory: result.memory ? memoryToResponse(result.memory) : null,
  });
});
