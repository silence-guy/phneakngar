import type { Database } from "@phneakngar/shared";
import {
  queries,
  MessageRole,
  shouldDeliverToChannel,
  parseDeliveryChannelId,
  extractChannelDeliveryContent,
  channelDeliveryMessageId,
  buildChannelDeliveryMetadata,
} from "@phneakngar/shared";
import { log } from "@/lib/logger";
import { broadcastToUser } from "@/lib/broadcast";
import { messageToResponse } from "@/lib/api/responses";

export type ChannelDeliveryTask = {
  id: string;
  agentId: string;
  workspaceId: string;
  conversationId: string;
  context?: unknown;
  result?: unknown;
};

export type DeliverTaskToChannelResult = {
  message: {
    id: string;
    conversationId: string;
    role: string;
    content: string;
    taskId: string | null;
    metadata: string | null;
    createdAt: string;
  };
  conversationId: string;
  channelName: string;
  channelId: string | null;
  created: boolean;
};

/**
 * Create (or reuse) a channel-visible assistant post for a completed task.
 *
 * Ownership is scoped ahead:
 * - channel resolved with workspaceId
 * - conversation get/create with workspaceId + owner + agent + channel name
 * - message id is deterministic per task (`channel-delivery-${taskId}`) for retries
 *
 * Returns null when delivery is not requested, content is empty, or scope fails.
 */
export async function deliverTaskResultToChannel(
  db: Database,
  task: ChannelDeliveryTask,
  opts?: {
    /** Parsed complete payload; defaults to task.result. */
    result?: unknown;
    /** Skip the shouldDeliverToChannel gate (caller already decided). */
    force?: boolean;
  },
): Promise<DeliverTaskToChannelResult | null> {
  const context = task.context;
  if (!opts?.force && !shouldDeliverToChannel(context)) {
    return null;
  }

  const content = extractChannelDeliveryContent(opts?.result ?? task.result);
  if (!content) {
    log.info("channel-delivery: skip empty content", { taskId: task.id });
    return null;
  }

  const channelId = parseDeliveryChannelId(context);
  let channelName = "default";
  let resolvedChannelId: string | null = channelId;

  if (channelId) {
    const channel = await queries.channel.getChannelById(db, channelId, task.workspaceId);
    if (!channel) {
      log.warn("channel-delivery: channel not in workspace", {
        taskId: task.id,
        channelId,
        workspaceId: task.workspaceId,
      });
      return null;
    }
    channelName = channel.name;
    resolvedChannelId = channel.id;
  }

  // Prefer owner on the source conversation; fall back to agent owner.
  const sourceConv = await queries.conversation.getConversation(
    db,
    task.conversationId,
    task.workspaceId,
  );
  let userId: string | null = sourceConv?.userId ?? null;
  if (!userId) {
    const agent = await queries.agent.getAgent(db, task.agentId, task.workspaceId);
    userId = agent?.ownerId ?? null;
  }
  if (!userId) {
    log.warn("channel-delivery: no owner for delivery", {
      taskId: task.id,
      agentId: task.agentId,
    });
    return null;
  }

  const targetConv = await queries.conversation.getOrCreateAgentConversation(
    db,
    task.workspaceId,
    userId,
    task.agentId,
    channelName,
  );

  const messageId = channelDeliveryMessageId(task.id);
  const metadata = buildChannelDeliveryMetadata({
    taskId: task.id,
    channelId: resolvedChannelId,
    channelName,
    sourceConversationId: task.conversationId,
  });

  const { message, created } = await queries.message.createMessageIfAbsent(db, {
    id: messageId,
    conversationId: targetConv.id,
    role: MessageRole.ASSISTANT,
    content,
    taskId: task.id,
    metadata,
  });

  if (created) {
    broadcastToUser(userId, {
      type: "conversation.message",
      conversationId: targetConv.id,
      message: messageToResponse(message),
    }).catch(() => {});

    queries.inbox
      .updateUnreadLatestMessage(db, targetConv.id, userId, message.id)
      .catch(() => {});

    // Channel posts are visible outcomes for the task lifecycle.
    queries.task
      .updateTaskVisibleOutcomeStatus(db, task.id, task.workspaceId, "visible_output")
      .catch(() => {});
  }

  return {
    message: {
      id: message.id,
      conversationId: message.conversationId,
      role: message.role,
      content: message.content,
      taskId: message.taskId ?? null,
      metadata: message.metadata ?? null,
      createdAt: message.createdAt,
    },
    conversationId: targetConv.id,
    channelName,
    channelId: resolvedChannelId,
    created,
  };
}

/** Thin UI helper re-export surface for channel timeline chrome. */
export { MessageKind, isChannelDeliveryMessage } from "@phneakngar/shared";
