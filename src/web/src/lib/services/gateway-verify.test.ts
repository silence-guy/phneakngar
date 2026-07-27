import { describe, it, expect } from "vitest";
import {
  extractSharedGatewaySecret,
  verifySharedGatewaySecret,
  verifyTelegramSecretToken,
  extractGatewayBotLoopSignal,
  extractExternalMessageId,
  extractGatewayPeerId,
  verifyGatewayRequest,
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

// ---------------------------------------------------------------------------
// verifyGatewayRequest — the single unconditional authentication gate.
// Inbound gateway text becomes an agent task prompt, so "no secret configured"
// must fail closed rather than allow the request.
// ---------------------------------------------------------------------------

describe("verifyGatewayRequest", () => {
  const PROVIDERS = ["slack", "discord", "telegram", "lark", "teams"] as const;

  async function hmacBase64(secretB64: string, body: string): Promise<string> {
    const bin = atob(secretB64);
    const keyBytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) keyBytes[i] = bin.charCodeAt(i);
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
    let out = "";
    for (const b of new Uint8Array(mac)) out += String.fromCharCode(b);
    return btoa(out);
  }

  it.each(PROVIDERS)("fails closed with 503 when no secret is configured (%s)", async (provider) => {
    const r = await verifyGatewayRequest({
      provider,
      headers: new Headers(),
      rawBody: "{}",
      env: {},
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(503);
      expect(r.error).toContain("not configured");
    }
  });

  it("still fails closed when GATEWAY_TEAM_MAP would have been set", async () => {
    // Regression guard: the legacy env map must not influence authentication.
    const r = await verifyGatewayRequest({
      provider: "discord",
      headers: new Headers(),
      rawBody: "{}",
      env: {},
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(503);
  });

  it("accepts the shared secret when no provider secret is configured", async () => {
    const env = { GATEWAY_WEBHOOK_SECRET: "shared-s" };
    const ok = await verifyGatewayRequest({
      provider: "discord",
      headers: new Headers({ "x-gateway-secret": "shared-s" }),
      rawBody: "{}",
      env,
    });
    expect(ok).toEqual({ ok: true, method: "shared_secret" });

    const bad = await verifyGatewayRequest({
      provider: "discord",
      headers: new Headers(),
      rawBody: "{}",
      env,
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.status).toBe(401);
  });

  it("prefers the provider secret over the shared secret", async () => {
    // A correct shared secret must not bypass a configured provider check.
    const r = await verifyGatewayRequest({
      provider: "telegram",
      headers: new Headers({ "x-gateway-secret": "shared-s" }),
      rawBody: "{}",
      env: { GATEWAY_WEBHOOK_SECRET: "shared-s", TELEGRAM_WEBHOOK_SECRET: "tg-s" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });

  it("verifies telegram secret_token", async () => {
    const env = { TELEGRAM_WEBHOOK_SECRET: "tg-s" };
    const ok = await verifyGatewayRequest({
      provider: "telegram",
      headers: new Headers({ "x-telegram-bot-api-secret-token": "tg-s" }),
      rawBody: "{}",
      env,
    });
    expect(ok).toEqual({ ok: true, method: "provider" });
  });

  it("verifies a real slack v0 signature and rejects a stale timestamp", async () => {
    const signingSecret = "slack-signing";
    const rawBody = JSON.stringify({ team_id: "T1" });
    const ts = "1700000000";
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(signingSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const mac = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`v0:${ts}:${rawBody}`),
    );
    const sig =
      "v0=" +
      [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");

    const headers = new Headers({
      "x-slack-request-timestamp": ts,
      "x-slack-signature": sig,
    });
    const ok = await verifyGatewayRequest({
      provider: "slack",
      headers,
      rawBody,
      env: { SLACK_SIGNING_SECRET: signingSecret },
      nowSec: Number(ts) + 10,
    });
    expect(ok).toEqual({ ok: true, method: "provider" });

    const stale = await verifyGatewayRequest({
      provider: "slack",
      headers,
      rawBody,
      env: { SLACK_SIGNING_SECRET: signingSecret },
      nowSec: Number(ts) + 60 * 60,
    });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.status).toBe(401);
  });

  it("rejects discord requests with missing or bad signature headers", async () => {
    const env = { DISCORD_PUBLIC_KEY: "a".repeat(64) };
    const missing = await verifyGatewayRequest({
      provider: "discord",
      headers: new Headers(),
      rawBody: "{}",
      env,
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.status).toBe(401);
      expect(missing.error).toContain("missing discord signature headers");
    }

    const bad = await verifyGatewayRequest({
      provider: "discord",
      headers: new Headers({
        "x-signature-ed25519": "bb".repeat(32),
        "x-signature-timestamp": "1700000000",
      }),
      rawBody: "{}",
      env,
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.status).toBe(401);
  });

  it("verifies a real lark signature and rejects a tampered body", async () => {
    const encryptKey = "lark-key";
    const rawBody = JSON.stringify({ tenant_key: "tk" });
    const ts = "1700000000";
    const nonce = "n1";
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`${ts}${nonce}${encryptKey}${rawBody}`),
    );
    const sig = [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const headers = new Headers({
      "x-lark-request-timestamp": ts,
      "x-lark-request-nonce": nonce,
      "x-lark-signature": sig,
    });

    const ok = await verifyGatewayRequest({
      provider: "lark",
      headers,
      rawBody,
      env: { LARK_APP_SECRET: encryptKey },
      nowSec: Number(ts) + 5,
    });
    expect(ok).toEqual({ ok: true, method: "provider" });

    const tampered = await verifyGatewayRequest({
      provider: "lark",
      headers,
      rawBody: JSON.stringify({ tenant_key: "attacker" }),
      env: { LARK_APP_SECRET: encryptKey },
      nowSec: Number(ts) + 5,
    });
    expect(tampered.ok).toBe(false);
    if (!tampered.ok) expect(tampered.status).toBe(401);
  });

  it("verifies a real teams HMAC and rejects a tampered body", async () => {
    const secretB64 = btoa("teams-secret-key");
    const rawBody = JSON.stringify({ text: "hi" });
    const mac = await hmacBase64(secretB64, rawBody);

    const ok = await verifyGatewayRequest({
      provider: "teams",
      headers: new Headers({ authorization: `HMAC ${mac}` }),
      rawBody,
      env: { TEAMS_APP_PASSWORD: secretB64 },
    });
    expect(ok).toEqual({ ok: true, method: "provider" });

    const tampered = await verifyGatewayRequest({
      provider: "teams",
      headers: new Headers({ authorization: `HMAC ${mac}` }),
      rawBody: JSON.stringify({ text: "tampered" }),
      env: { TEAMS_APP_PASSWORD: secretB64 },
    });
    expect(tampered.ok).toBe(false);
    if (!tampered.ok) expect(tampered.status).toBe(401);

    const missing = await verifyGatewayRequest({
      provider: "teams",
      headers: new Headers(),
      rawBody,
      env: { TEAMS_APP_PASSWORD: secretB64 },
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.status).toBe(401);
  });
});
