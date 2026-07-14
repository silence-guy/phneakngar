import { NextRequest } from "next/server";
import { queries } from "@phneakngar/shared"
import { getDb, withD1Retry } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { withChhlatTaskAccess } from "@/lib/middleware/chhlat";
import { writeJSON, writeError, parseBody } from "@/lib/middleware/helpers";
import { taskMessageToResponse } from "@/lib/api/responses";
import { ReportMessagesRequestSchema } from "@phneakngar/shared";
import { broadcastToUser } from "@/lib/broadcast";
import { log } from "@/lib/logger";

export const GET = withAuth(async (_req, ctx) => {
  if (!ctx.workspaceId) {
    return writeError("Forbidden: machine token required", 403);
  }

  const db = getDb(ctx.env.DB)

  const taskId = ctx.params?.taskId;
  if (!taskId) {
    return writeError("task_id is required", 400);
  }

  const taskAccess = await withChhlatTaskAccess(db, ctx, taskId);
  if (taskAccess instanceof Response) return taskAccess;

  const messages = await withD1Retry(() => queries.taskMessage.listTaskMessages(db, taskId, taskAccess.workspaceId));
  return writeJSON(messages.map(taskMessageToResponse));
});

export const POST = withAuth(async (req: NextRequest, ctx) => {
  if (!ctx.workspaceId) {
    return writeError("Forbidden: machine token required", 403);
  }

  const db = getDb(ctx.env.DB)

  const taskId = ctx.params?.taskId;
  if (!taskId) {
    return writeError("task_id is required", 400);
  }

  const [body, err] = await parseBody(req, ReportMessagesRequestSchema);
  if (err) return err;

  const taskAccess = await withChhlatTaskAccess(db, ctx, taskId);
  if (taskAccess instanceof Response) return taskAccess;
  const task = taskAccess.task;

  // What we persist (INTENTIONAL — do not "clean up" as dead storage):
  //   - We DROP only "log" and "status" — pure transient runtime noise, never
  //     useful after the fact.
  //   - We KEEP text/tool-use/thinking/tool-result rows even though the chat UI
  //     no longer reads them (since the move to agent-authored `send-dm`, the UI
  //     only consumes type:"error" + the final reply bubble). These rows are
  //     retained for FUTURE DATA ANALYSIS of agent runs (tool usage, reasoning,
  //     etc.). The read paths (listTaskMessages*) filter them out for the UI, but
  //     the rows must stay in storage. Don't delete this write or narrow it to
  //     errors-only.
  const filtered = body.messages.filter((m) => m.type !== "log" && m.type !== "status");
  if (filtered.length === 0) {
    return writeJSON({ status: "ok" });
  }

  const normalized = filtered.map((m) => ({
    taskId,
    seq: m.seq,
    type: m.type,
    tool: m.tool || "",
    callId: m.call_id || "",
    // tool-result content/input/output are intentionally blanked: those
    // payloads can be very large (full tool stdout, file dumps), so we keep
    // the row (for analysis: which tool ran, when) but not the heavy body.
    content: m.type === "tool-result" ? "" : (m.content || ""),
    input: m.type === "tool-result" ? undefined : m.input,
    output: m.type === "tool-result" ? "" : (m.output || ""),
  }));

  const acceptedBySeq = new Map<number, typeof normalized[number]>();
  for (const message of normalized) {
    const existing = acceptedBySeq.get(message.seq);
    if (!existing) {
      acceptedBySeq.set(message.seq, message);
      continue;
    }
    if (queries.taskMessage.taskMessagePayloadFingerprint(existing)
      !== queries.taskMessage.taskMessagePayloadFingerprint(message)) {
      return writeError("task message payload conflict", 409);
    }
  }
  const accepted = [...acceptedBySeq.values()];

  const results = await Promise.allSettled(
    accepted.map((m) =>
      withD1Retry(() => queries.taskMessage.createTaskMessage(db, m))
    )
  );

  const rejected = results.filter((result) => result.status === "rejected");
  rejected.forEach((result) => {
    log.warn("Failed to create task message", {
      taskId,
      err: result.reason instanceof Error ? result.reason.message : String(result.reason),
    });
  });

  const newlyCreated = results.flatMap((result) =>
    result.status === "fulfilled" && result.value.created ? [result.value.message] : []
  );

  if (rejected.some((result) => !(result.reason instanceof queries.taskMessage.TaskMessageConflictError))) {
    return writeError("task messages were not fully stored", 503);
  }
  if (rejected.length > 0) {
    return writeError("task message payload conflict", 409);
  }

  // Broadcast is a separate concern from storage: we STORE tool-use/thinking/
  // tool-result (for later analysis, above) but don't BROADCAST them — the live
  // chat has no use for them. Exact HTTP retries are not rebroadcast because only
  // rows newly confirmed durable by this request are included here.
  const broadcastable = newlyCreated.filter((message) =>
    message.type !== "tool-result" && message.type !== "tool-use" && message.type !== "thinking"
  );
  if (broadcastable.length > 0) {
    const wsMessages = broadcastable.map(taskMessageToResponse);
    const conv = await queries.conversation.getConversation(db, task.conversationId, ctx.workspaceId);
    if (conv) {
      broadcastToUser(conv.userId, { type: "task.messages", taskId, messages: wsMessages }).catch(() => {});
    }
  }

  return writeJSON({ status: "ok" });
});
