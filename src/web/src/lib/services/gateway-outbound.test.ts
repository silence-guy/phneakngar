import { describe, it, expect } from "vitest";
import { formatGatewayOutboundPayload } from "./gateway-outbound";

describe("formatGatewayOutboundPayload", () => {
  it("formats Lark post payload without network", () => {
    const result = formatGatewayOutboundPayload({
      provider: "lark",
      teamId: "tenant_1",
      channelId: "oc_chat",
      text: "hello lark",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.provider).toBe("lark");
    expect(result.payload.receive_id).toBe("oc_chat");
    expect(result.payload.msg_type).toBe("text");
    expect(result.payload.tenant_key).toBe("tenant_1");
    expect(JSON.parse(String(result.payload.content))).toEqual({ text: "hello lark" });
  });

  it("formats Teams post payload without network", () => {
    const result = formatGatewayOutboundPayload({
      provider: "teams",
      teamId: "tenant-guid",
      channelId: "19:channel@thread.tacv2",
      text: "hello teams",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.provider).toBe("teams");
    expect(result.payload.type).toBe("message");
    expect(result.payload.text).toBe("hello teams");
    expect((result.payload.conversation as { id: string }).id).toBe("19:channel@thread.tacv2");
    expect((result.payload.channelData as { tenant: { id: string } }).tenant.id).toBe(
      "tenant-guid",
    );
  });

  it("formats slack/discord/telegram stubs", () => {
    const slack = formatGatewayOutboundPayload({
      provider: "slack",
      teamId: "T1",
      channelId: "C1",
      text: "hi",
    });
    expect(slack.ok).toBe(true);
    if (slack.ok) {
      expect(slack.payload.channel).toBe("C1");
      expect(slack.payload.text).toBe("hi");
    }

    const discord = formatGatewayOutboundPayload({
      provider: "discord",
      teamId: "G1",
      channelId: "C2",
      text: "yo",
    });
    expect(discord.ok).toBe(true);
    if (discord.ok) {
      expect(discord.payload.content).toBe("yo");
      expect(discord.payload.guild_id).toBe("G1");
    }

    const telegram = formatGatewayOutboundPayload({
      provider: "telegram",
      teamId: "42",
      channelId: "42",
      text: "ping",
    });
    expect(telegram.ok).toBe(true);
    if (telegram.ok) {
      expect(telegram.payload.chat_id).toBe("42");
    }
  });

  it("rejects missing fields", () => {
    expect(
      formatGatewayOutboundPayload({
        provider: "lark",
        teamId: "",
        channelId: "oc",
        text: "hi",
      }),
    ).toEqual({ ok: false, error: "teamId required" });

    expect(
      formatGatewayOutboundPayload({
        provider: "teams",
        teamId: "t",
        channelId: "",
        text: "hi",
      }),
    ).toEqual({ ok: false, error: "channelId required" });

    expect(
      formatGatewayOutboundPayload({
        provider: "slack",
        teamId: "T1",
        channelId: "C1",
        text: "   ",
      }),
    ).toEqual({ ok: false, error: "text required" });
  });

  it("rejects unsupported provider at runtime", () => {
    expect(
      formatGatewayOutboundPayload({
        provider: "irc" as never,
        teamId: "t",
        channelId: "c",
        text: "hi",
      }),
    ).toEqual({ ok: false, error: "unsupported provider" });
  });
});
