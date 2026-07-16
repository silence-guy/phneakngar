import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetChannelById = vi.fn();
const mockGetConversation = vi.fn();
const mockGetOrCreate = vi.fn();
const mockGetAgent = vi.fn();
const mockCreateMessageIfAbsent = vi.fn();
const mockUpdateVisible = vi.fn();
const mockUpdateUnread = vi.fn();
const mockBroadcast = vi.fn().mockResolvedValue(undefined);

vi.mock("@phneakngar/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@phneakngar/shared")>();
  return {
    ...actual,
    queries: {
      channel: {
        getChannelById: (...a: unknown[]) => mockGetChannelById(...a),
      },
      conversation: {
        getConversation: (...a: unknown[]) => mockGetConversation(...a),
        getOrCreateAgentConversation: (...a: unknown[]) => mockGetOrCreate(...a),
      },
      agent: {
        getAgent: (...a: unknown[]) => mockGetAgent(...a),
      },
      message: {
        createMessageIfAbsent: (...a: unknown[]) => mockCreateMessageIfAbsent(...a),
      },
      task: {
        updateTaskVisibleOutcomeStatus: (...a: unknown[]) => mockUpdateVisible(...a),
      },
      inbox: {
        updateUnreadLatestMessage: (...a: unknown[]) => mockUpdateUnread(...a),
      },
    },
  };
});

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/broadcast", () => ({
  broadcastToUser: (...a: unknown[]) => mockBroadcast(...a),
}));

vi.mock("@/lib/api/responses", () => ({
  messageToResponse: (m: unknown) => m,
}));

import { deliverTaskResultToChannel } from "./channel-delivery";
import { MessageKind } from "@phneakngar/shared";

const baseTask = {
  id: "t1",
  agentId: "a1",
  workspaceId: "w1",
  conversationId: "c_src",
  context: {
    deliver_to_channel: true,
    delivery_channel_id: "ch_ops",
  },
  result: { output: "Ship notes ready" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetChannelById.mockResolvedValue({ id: "ch_ops", name: "ops", workspaceId: "w1" });
  mockGetConversation.mockResolvedValue({
    id: "c_src",
    userId: "u1",
    workspaceId: "w1",
    agentId: "a1",
  });
  mockGetOrCreate.mockResolvedValue({
    id: "c_channel",
    userId: "u1",
    workspaceId: "w1",
    agentId: "a1",
    channel: "ops",
  });
  mockCreateMessageIfAbsent.mockResolvedValue({
    created: true,
    message: {
      id: "channel-delivery-t1",
      conversationId: "c_channel",
      role: "assistant",
      content: "Ship notes ready",
      taskId: "t1",
      metadata: JSON.stringify({ kind: MessageKind.CHANNEL_DELIVERY }),
      createdAt: "2026-07-16T00:00:00.000Z",
    },
  });
  mockUpdateVisible.mockResolvedValue(undefined);
  mockUpdateUnread.mockResolvedValue(undefined);
});

describe("deliverTaskResultToChannel", () => {
  it("creates a channel-visible assistant message for deliver_to_channel (workspace-scoped)", async () => {
    const result = await deliverTaskResultToChannel({} as any, baseTask);

    expect(result).not.toBeNull();
    expect(result!.created).toBe(true);
    expect(result!.channelName).toBe("ops");
    expect(result!.conversationId).toBe("c_channel");
    expect(result!.message.id).toBe("channel-delivery-t1");

    // Scope ahead: channel + conversation use workspaceId first.
    expect(mockGetChannelById).toHaveBeenCalledWith({}, "ch_ops", "w1");
    expect(mockGetConversation).toHaveBeenCalledWith({}, "c_src", "w1");
    expect(mockGetOrCreate).toHaveBeenCalledWith({}, "w1", "u1", "a1", "ops");

    expect(mockCreateMessageIfAbsent).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        id: "channel-delivery-t1",
        conversationId: "c_channel",
        role: "assistant",
        content: "Ship notes ready",
        taskId: "t1",
      }),
    );
    const meta = JSON.parse(
      (mockCreateMessageIfAbsent.mock.calls[0]![1] as { metadata: string }).metadata,
    );
    expect(meta.kind).toBe(MessageKind.CHANNEL_DELIVERY);
    expect(meta.channel_id).toBe("ch_ops");
    expect(meta.channel_name).toBe("ops");

    expect(mockBroadcast).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({
        type: "conversation.message",
        conversationId: "c_channel",
      }),
    );
    expect(mockUpdateVisible).toHaveBeenCalledWith({}, "t1", "w1", "visible_output");
  });

  it("returns null when context does not request channel delivery", async () => {
    const result = await deliverTaskResultToChannel({} as any, {
      ...baseTask,
      context: { delivery_mode: "dm" },
    });
    expect(result).toBeNull();
    expect(mockCreateMessageIfAbsent).not.toHaveBeenCalled();
  });

  it("returns null when channel id is outside workspace", async () => {
    mockGetChannelById.mockResolvedValue(null);
    const result = await deliverTaskResultToChannel({} as any, baseTask);
    expect(result).toBeNull();
    expect(mockCreateMessageIfAbsent).not.toHaveBeenCalled();
  });

  it("returns null when content is empty", async () => {
    const result = await deliverTaskResultToChannel({} as any, {
      ...baseTask,
      result: { output: "  " },
    });
    expect(result).toBeNull();
    expect(mockCreateMessageIfAbsent).not.toHaveBeenCalled();
  });

  it("defaults to channel name 'default' when no delivery_channel_id", async () => {
    const result = await deliverTaskResultToChannel({} as any, {
      ...baseTask,
      context: { delivery_mode: "channel" },
    });
    expect(result).not.toBeNull();
    expect(mockGetChannelById).not.toHaveBeenCalled();
    expect(mockGetOrCreate).toHaveBeenCalledWith({}, "w1", "u1", "a1", "default");
  });

  it("is idempotent: does not re-broadcast when message already existed", async () => {
    mockCreateMessageIfAbsent.mockResolvedValue({
      created: false,
      message: {
        id: "channel-delivery-t1",
        conversationId: "c_channel",
        role: "assistant",
        content: "Ship notes ready",
        taskId: "t1",
        metadata: null,
        createdAt: "2026-07-16T00:00:00.000Z",
      },
    });
    const result = await deliverTaskResultToChannel({} as any, baseTask);
    expect(result!.created).toBe(false);
    expect(mockBroadcast).not.toHaveBeenCalled();
    expect(mockUpdateVisible).not.toHaveBeenCalled();
  });

  it("falls back to agent owner when source conversation missing", async () => {
    mockGetConversation.mockResolvedValue(null);
    mockGetAgent.mockResolvedValue({ id: "a1", ownerId: "u_owner", workspaceId: "w1" });
    const result = await deliverTaskResultToChannel({} as any, baseTask);
    expect(result).not.toBeNull();
    expect(mockGetAgent).toHaveBeenCalledWith({}, "a1", "w1");
    expect(mockGetOrCreate).toHaveBeenCalledWith({}, "w1", "u_owner", "a1", "ops");
  });

  it("returns null when no owner can be resolved (workspace-scoped agent miss)", async () => {
    mockGetConversation.mockResolvedValue(null);
    mockGetAgent.mockResolvedValue(null);
    const result = await deliverTaskResultToChannel({} as any, baseTask);
    expect(result).toBeNull();
    expect(mockGetAgent).toHaveBeenCalledWith({}, "a1", "w1");
    expect(mockCreateMessageIfAbsent).not.toHaveBeenCalled();
  });

  it("force:true bypasses shouldDeliverToChannel gate", async () => {
    const result = await deliverTaskResultToChannel(
      {} as any,
      { ...baseTask, context: { delivery_mode: "dm" } },
      { force: true },
    );
    expect(result).not.toBeNull();
    expect(mockCreateMessageIfAbsent).toHaveBeenCalled();
  });

  it("prefers opts.result over task.result for delivery body", async () => {
    await deliverTaskResultToChannel(
      {} as any,
      baseTask,
      { result: { output: "Override body" } },
    );
    expect(mockCreateMessageIfAbsent).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ content: "Override body" }),
    );
  });

  it("updates unread on the channel conversation (not source task conversation)", async () => {
    await deliverTaskResultToChannel({} as any, baseTask);
    // Allow fire-and-forget unread update to settle.
    await Promise.resolve();
    expect(mockUpdateUnread).toHaveBeenCalledWith({}, "c_channel", "u1", "channel-delivery-t1");
  });

  it("does not create a message when agent has no ownerId", async () => {
    mockGetConversation.mockResolvedValue(null);
    mockGetAgent.mockResolvedValue({ id: "a1", ownerId: null, workspaceId: "w1" });
    const result = await deliverTaskResultToChannel({} as any, baseTask);
    expect(result).toBeNull();
    expect(mockCreateMessageIfAbsent).not.toHaveBeenCalled();
  });
});
