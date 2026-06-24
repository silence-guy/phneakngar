import { queries } from "@alook/shared"
import { getDb, withD1Retry } from "@/lib/db"
import { withAuth } from "@/lib/middleware/auth";
import { withDaemonTaskAccess } from "@/lib/middleware/daemon";
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

  const taskAccess = await withDaemonTaskAccess(db, ctx, taskId);
  if (taskAccess instanceof Response) return taskAccess;

  const status = await withD1Retry(() => queries.task.getTaskStatus(db, taskId, ctx.workspaceId));
  if (!status) {
    return writeError("task not found", 404);
  }

  return writeJSON({ status });
});
