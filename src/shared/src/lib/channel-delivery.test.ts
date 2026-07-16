import { describe, it, expect } from "vitest";
import {
  shouldDeliverToChannel,
  parseDeliveryChannelId,
  extractChannelDeliveryContent,
  channelDeliveryMessageId,
  isChannelDeliveryMessage,
  buildChannelDeliveryMetadata,
} from "./channel-delivery";
import { MessageKind } from "../constants";

describe("shouldDeliverToChannel", () => {
  it("returns false for null/empty context", () => {
    expect(shouldDeliverToChannel(null)).toBe(false);
    expect(shouldDeliverToChannel(undefined)).toBe(false);
    expect(shouldDeliverToChannel({})).toBe(false);
  });

  it("returns true when deliver_to_channel is true", () => {
    expect(shouldDeliverToChannel({ deliver_to_channel: true })).toBe(true);
  });

  it("returns false when deliver_to_channel is truthy but not true", () => {
    expect(shouldDeliverToChannel({ deliver_to_channel: "yes" })).toBe(false);
    expect(shouldDeliverToChannel({ deliver_to_channel: 1 })).toBe(false);
  });

  it("returns true when delivery_mode is channel", () => {
    expect(shouldDeliverToChannel({ delivery_mode: "channel" })).toBe(true);
  });

  it("returns false for other delivery modes", () => {
    expect(shouldDeliverToChannel({ delivery_mode: "dm" })).toBe(false);
    expect(shouldDeliverToChannel({ delivery_mode: "email_draft" })).toBe(false);
    expect(shouldDeliverToChannel({ delivery_mode: "issue" })).toBe(false);
  });
});

describe("parseDeliveryChannelId", () => {
  it("returns trimmed channel id or null", () => {
    expect(parseDeliveryChannelId({ delivery_channel_id: "ch_1" })).toBe("ch_1");
    expect(parseDeliveryChannelId({ delivery_channel_id: "  ch_2  " })).toBe("ch_2");
    expect(parseDeliveryChannelId({ delivery_channel_id: "" })).toBeNull();
    expect(parseDeliveryChannelId({ delivery_channel_id: null })).toBeNull();
    expect(parseDeliveryChannelId({})).toBeNull();
  });
});

describe("extractChannelDeliveryContent", () => {
  it("extracts output from complete payload", () => {
    expect(extractChannelDeliveryContent({ output: "  Morning brief  " })).toBe("Morning brief");
  });

  it("falls back across common keys and raw string", () => {
    expect(extractChannelDeliveryContent({ content: "c" })).toBe("c");
    expect(extractChannelDeliveryContent({ raw: "r" })).toBe("r");
    expect(extractChannelDeliveryContent({ summary: "s" })).toBe("s");
    expect(extractChannelDeliveryContent({ text: "t" })).toBe("t");
    expect(extractChannelDeliveryContent(" plain ")).toBe("plain");
  });

  it("returns null for empty payloads", () => {
    expect(extractChannelDeliveryContent({})).toBeNull();
    expect(extractChannelDeliveryContent({ output: "   " })).toBeNull();
    expect(extractChannelDeliveryContent(null)).toBeNull();
  });

  it("prefers output over other keys", () => {
    expect(extractChannelDeliveryContent({ output: "o", content: "c", raw: "r" })).toBe("o");
  });
});

describe("channelDeliveryMessageId", () => {
  it("is deterministic per task", () => {
    expect(channelDeliveryMessageId("t1")).toBe("channel-delivery-t1");
    expect(channelDeliveryMessageId("t1")).toBe(channelDeliveryMessageId("t1"));
  });
});

describe("isChannelDeliveryMessage / buildChannelDeliveryMetadata", () => {
  it("round-trips kind channel_delivery", () => {
    const meta = buildChannelDeliveryMetadata({
      taskId: "t1",
      channelId: "ch_1",
      channelName: "ops",
      sourceConversationId: "c_src",
    });
    const parsed = JSON.parse(meta);
    expect(parsed.kind).toBe(MessageKind.CHANNEL_DELIVERY);
    expect(parsed.task_id).toBe("t1");
    expect(parsed.channel_id).toBe("ch_1");
    expect(parsed.channel_name).toBe("ops");
    expect(parsed.source_conversation_id).toBe("c_src");
    expect(isChannelDeliveryMessage(parsed)).toBe(true);
    expect(isChannelDeliveryMessage({ kind: "dm" })).toBe(false);
    expect(isChannelDeliveryMessage(null)).toBe(false);
    expect(isChannelDeliveryMessage("channel_delivery")).toBe(false);
  });

  it("nulls source_conversation_id when omitted", () => {
    const parsed = JSON.parse(
      buildChannelDeliveryMetadata({
        taskId: "t2",
        channelId: null,
        channelName: "default",
      }),
    );
    expect(parsed.source_conversation_id).toBeNull();
    expect(parsed.channel_id).toBeNull();
  });
});

describe("shouldDeliverToChannel edge cases", () => {
  it("ignores array / non-object context", () => {
    expect(shouldDeliverToChannel([])).toBe(false);
    expect(shouldDeliverToChannel("channel")).toBe(false);
  });

  it("accepts deliver_to_channel true even with other delivery_mode", () => {
    expect(
      shouldDeliverToChannel({ deliver_to_channel: true, delivery_mode: "dm" }),
    ).toBe(true);
  });
});
