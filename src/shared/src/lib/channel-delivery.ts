/**
 * Pure helpers for channel delivery posts (C3).
 * Task complete → optional channel-visible assistant message.
 */

import { AutomationDeliveryMode, MessageKind } from "../constants";

export type ChannelDeliveryContext = {
  /** Explicit opt-in flag (parent plan acceptance case). */
  deliver_to_channel?: unknown;
  /** Automation / SOP delivery surface. */
  delivery_mode?: unknown;
  delivery_channel_id?: unknown;
  [key: string]: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

/**
 * True when task context asks for channel delivery.
 * Accepts either `deliver_to_channel: true` or `delivery_mode: "channel"`.
 * Other delivery modes (dm / email_draft / issue) do not auto-post to a channel.
 */
export function shouldDeliverToChannel(context: unknown): boolean {
  const ctx = asRecord(context);
  if (!ctx) return false;

  if (ctx.deliver_to_channel === true) return true;

  const mode = ctx.delivery_mode;
  if (typeof mode === "string" && mode === AutomationDeliveryMode.CHANNEL) {
    return true;
  }
  return false;
}

/** Workspace-scoped delivery channel id from task context, if any. */
export function parseDeliveryChannelId(context: unknown): string | null {
  const ctx = asRecord(context);
  if (!ctx) return null;
  const id = ctx.delivery_channel_id;
  if (typeof id === "string" && id.trim().length > 0) return id.trim();
  return null;
}

/**
 * Extract human-visible delivery body from a completed task result.
 * Prefers `output` (CompleteTaskRequest), then common fallbacks.
 * Returns null when empty so callers can skip posting silence.
 */
export function extractChannelDeliveryContent(result: unknown): string | null {
  if (typeof result === "string") {
    const trimmed = result.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  const obj = asRecord(result);
  if (!obj) return null;

  for (const key of ["output", "content", "raw", "summary", "text"] as const) {
    const v = obj[key];
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }
  return null;
}

/** Deterministic message id for idempotent channel delivery per task. */
export function channelDeliveryMessageId(taskId: string): string {
  return `channel-delivery-${taskId}`;
}

export function isChannelDeliveryMessage(metadata: unknown): boolean {
  const meta = asRecord(metadata);
  if (!meta) return false;
  return meta.kind === MessageKind.CHANNEL_DELIVERY;
}

export function buildChannelDeliveryMetadata(input: {
  taskId: string;
  channelId: string | null;
  channelName: string;
  sourceConversationId?: string | null;
}): string {
  return JSON.stringify({
    kind: MessageKind.CHANNEL_DELIVERY,
    task_id: input.taskId,
    channel_id: input.channelId,
    channel_name: input.channelName,
    source_conversation_id: input.sourceConversationId ?? null,
  });
}
