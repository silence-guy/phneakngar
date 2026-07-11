import { queries } from "@phneakngar/shared"
import { getDb, withD1Retry } from "@/lib/db"
import { withAuth } from "@/lib/middleware/auth";
import { withChhlatTaskAccess } from "@/lib/middleware/chhlat";
import { writeJSON, writeError } from "@/lib/middleware/helpers";

export const GET = withAuth(async (_req, ctx) => {
  const db = getDb(ctx.env.DB)

  if (!ctx.workspaceId) {
    return writeError("Forbidden: machine token required", 403);
  }

  const taskId = ctx.params?.taskId;
  if (!taskId) {
    return writeError("task_id is required", 400);
  }

  const taskAccess = await withChhlatTaskAccess(db, ctx, taskId);
  if (taskAccess instanceof Response) return taskAccess;

  const status = await withD1Retry(() => queries.task.getTaskStatus(db, taskId, taskAccess.workspaceId));
  if (!status) {
    return writeError("task not found", 404);
  }

  return writeJSON({ status });
});
