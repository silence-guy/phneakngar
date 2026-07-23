import { NextRequest } from "next/server";
import { queries, TASK_TYPES } from "@phneakngar/shared"
import { getDb } from "@/lib/db"
import { withAuth } from "@/lib/middleware/auth";
import { withChhlatTaskAccess } from "@/lib/middleware/chhlat";
import { writeJSON, writeError, parseBody } from "@/lib/middleware/helpers";
import { taskToResponse } from "@/lib/api/responses";
import {
  TaskAlreadyTerminalError,
  TaskService,
  TASK_ALREADY_TERMINAL_CODE,
} from "@/lib/services/task";
import { FailTaskRequestSchema } from "@phneakngar/shared";
import { broadcastToUser } from "@/lib/broadcast";
import { invalidate, invalidateInboxCounts, cacheKeys } from "@/lib/cache";
import { handlePlaybookTaskTerminal } from "@/lib/services/playbook-engine";
import { resolveServerEmailDomain } from "@/lib/email-domain";
import { log } from "@/lib/logger";

export const POST = withAuth(async (req: NextRequest, ctx) => {
  if (!ctx.workspaceId) {
    return writeError("Forbidden: machine token required", 403);
  }

  const db = getDb(ctx.env.DB)

  const taskId = ctx.params?.taskId;
  if (!taskId) {
    return writeError("task_id is required", 400);
  }

  const [body, err] = await parseBody(req, FailTaskRequestSchema);
  if (err) return err;

  const taskAccess = await withChhlatTaskAccess(db, ctx, taskId);
  if (taskAccess instanceof Response) return taskAccess;

  const taskService = new TaskService(db);
  try {
    const task = await taskService.failTask(taskId, ctx.workspaceId, body.error);
    const dateStr = new Date().toISOString().slice(0, 10);
    invalidate(cacheKeys.overviewTaskStats(ctx.workspaceId, dateStr)).catch(() => {});
    const conv = await queries.conversation.getConversation(db, task.conversationId, ctx.workspaceId);
    if (conv) {
      invalidateInboxCounts(conv.userId, ctx.workspaceId).catch(() => {});
      broadcastToUser(conv.userId, { type: "task.updated", taskId, agentId: task.agentId, status: "failed" }).catch(() => {});
    }
    if (task.type === TASK_TYPES.PLAYBOOK_STEP) {
      await handlePlaybookTaskTerminal(db, task, "failed", {
        error: body.error || "task failed",
        emailDomain: resolveServerEmailDomain(ctx.env),
      }).catch((hookErr) => {
        log.warn("playbook hook failed on fail", { taskId, err: String(hookErr) });
      });
    }
    return writeJSON(taskToResponse(task));
  } catch (e: unknown) {
    if (e instanceof TaskAlreadyTerminalError) {
      return writeJSON({
        error: e.message,
        code: TASK_ALREADY_TERMINAL_CODE,
      }, 409);
    }
    return writeError(e instanceof Error ? e.message : "Unknown error", 400);
  }
});
