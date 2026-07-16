import { describe, it, expect } from "vitest";
import {
  extractSharedGatewaySecret,
  verifySharedGatewaySecret,
  verifyTelegramSecretToken,
  extractGatewayBotLoopSignal,
  extractExternalMessageId,
  extractGatewayPeerId,
} from "./gateway-verify";

describe("shared gateway secret", () => {
  it("extracts from header or bearer", () => {
    const h = new Headers({ "x-gateway-secret": "s1" });
    expect(extractSharedGatewaySecret(h)).toBe("s1");
    const h2 = new Headers({ authorization: "Bearer tok" });
    expect(extractSharedGatewaySecret(h2)).toBe("tok");
  });

  it("verifies shared secret", () => {
    const h = new Headers({ "x-gateway-secret": "abc" });
    expect(verifySharedGatewaySecret(h, "abc").ok).toBe(true);
    expect(verifySharedGatewaySecret(h, "wrong").ok).toBe(false);
    expect(verifySharedGatewaySecret(h, "").ok).toBe(false);
  });
});

describe("verifyTelegramSecretToken", () => {
  it("accepts matching secret token header", () => {
    const h = new Headers({ "x-telegram-bot-api-secret-token": "tg-secret" });
    expect(verifyTelegramSecretToken(h, "tg-secret")).toEqual({
      ok: true,
      method: "provider",
    });
  });

  it("rejects mismatch", () => {
    const h = new Headers({ "x-telegram-bot-api-secret-token": "nope" });
    const r = verifyTelegramSecretToken(h, "tg-secret");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });
});

describe("bot loop + ids", () => {
  it("detects slack bot messages", () => {
    expect(
      extractGatewayBotLoopSignal("slack", {
        event: { bot_id: "B1", text: "hi" },
      }).isBot,
    ).toBe(true);
    expect(
      extractGatewayBotLoopSignal("slack", {
        event: { user: "U1", text: "hi" },
      }).isBot,
    ).toBe(false);
  });

  it("detects telegram bot sender", () => {
    expect(
      extractGatewayBotLoopSignal("telegram", {
        message: { from: { id: 1, is_bot: true }, text: "x" },
      }).isBot,
    ).toBe(true);
  });

  it("extracts external message ids", () => {
    expect(
      extractExternalMessageId("slack", {
        event: { ts: "1.2", channel: "C1" },
      }),
    ).toBe("slack:C1:1.2");
    expect(
      extractExternalMessageId("telegram", { update_id: 99 }),
    ).toBe("telegram:99");
  });

  it("extracts peer ids", () => {
    expect(
      extractGatewayPeerId("slack", { event: { user: "U9" } }),
    ).toBe("U9");
    expect(
      extractGatewayPeerId("telegram", {
        message: { from: { id: 42 } },
      }),
    ).toBe("42");
  });
});
