import { describe, it, expect, vi } from "vitest";
import {
  isLiveOutboundMode,
  outboundModeBadge,
  sendLiveGatewayMessage,
} from "./gateway-live-outbound";

describe("outbound mode helpers", () => {
  it("classifies live vs preview", () => {
    expect(isLiveOutboundMode("live")).toBe(true);
    expect(isLiveOutboundMode("preview")).toBe(false);
    expect(outboundModeBadge("live")).toBe("Live");
    expect(outboundModeBadge(null)).toBe("Preview");
  });
});

describe("sendLiveGatewayMessage", () => {
  it("sends telegram via injectable fetch", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const result = await sendLiveGatewayMessage(
      {
        provider: "telegram",
        teamId: "42",
        channelId: "42",
        text: "hello",
      },
      { token: "bot-token", fetch: fetchMock as unknown as typeof fetch },
    );
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/botbot-token/sendMessage"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("sends slack chat.postMessage", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const result = await sendLiveGatewayMessage(
      {
        provider: "slack",
        teamId: "T1",
        channelId: "C1",
        text: "hi",
      },
      {
        token: "xoxb-token",
        baseUrl: "https://slack.test/api",
        fetch: fetchMock as unknown as typeof fetch,
      },
    );
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://slack.test/api/chat.postMessage",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer xoxb-token",
        }),
      }),
    );
  });

  it("rejects missing token and unimplemented providers", async () => {
    const noToken = await sendLiveGatewayMessage(
      { provider: "telegram", teamId: "1", channelId: "1", text: "x" },
      { token: "" },
    );
    expect(noToken.ok).toBe(false);

    const lark = await sendLiveGatewayMessage(
      { provider: "lark", teamId: "t", channelId: "c", text: "x" },
      { token: "tok" },
    );
    expect(lark.ok).toBe(false);
    if (!lark.ok) expect(lark.status).toBe(501);
  });
});
