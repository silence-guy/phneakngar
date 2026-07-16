/**
 * Per-provider gateway webhook verification helpers.
 * Shared x-gateway-secret alone is not the commercial bar — prefer provider secrets.
 * Full commercial Helio/OpenClaw parity is still not claimed.
 */

export type GatewayVerifyProvider = "slack" | "discord" | "telegram" | "lark" | "teams";

export type GatewayVerifyResult =
  | { ok: true; method: "shared_secret" | "provider" | "skip" }
  | { ok: false; error: string; status: number };

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export function extractSharedGatewaySecret(
  headers: Headers | { get(name: string): string | null },
): string {
  const headerSecret = headers.get("x-gateway-secret");
  const auth = headers.get("authorization");
  const bearer =
    auth && /^Bearer\s+/i.test(auth) ? auth.replace(/^Bearer\s+/i, "").trim() : null;
  return headerSecret?.trim() || bearer || "";
}

/**
 * Telegram secret_token header (Bot API webhook).
 * https://core.telegram.org/bots/api#setwebhook
 */
export function verifyTelegramSecretToken(
  headers: Headers | { get(name: string): string | null },
  expected: string | null | undefined,
): GatewayVerifyResult {
  if (!expected?.trim()) {
    return { ok: false, error: "telegram secret not configured", status: 503 };
  }
  const provided =
    headers.get("x-telegram-bot-api-secret-token") ??
    headers.get("X-Telegram-Bot-Api-Secret-Token") ??
    "";
  if (!timingSafeEqualString(provided.trim(), expected.trim())) {
    return { ok: false, error: "unauthorized", status: 401 };
  }
  return { ok: true, method: "provider" };
}

/**
 * Slack signing secret (v0 HMAC). Requires Web Crypto.
 * When signing secret unset, falls back to shared secret path at caller.
 */
export async function verifySlackSignature(opts: {
  headers: Headers | { get(name: string): string | null };
  rawBody: string;
  signingSecret: string;
  /** Max age seconds (default 5 minutes). */
  maxAgeSec?: number;
  nowSec?: number;
}): Promise<GatewayVerifyResult> {
  const timestamp = opts.headers.get("x-slack-request-timestamp")?.trim() ?? "";
  const signature = opts.headers.get("x-slack-signature")?.trim() ?? "";
  if (!timestamp || !signature) {
    return { ok: false, error: "missing slack signature headers", status: 401 };
  }
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) {
    return { ok: false, error: "invalid slack timestamp", status: 401 };
  }
  const now = opts.nowSec ?? Math.floor(Date.now() / 1000);
  const maxAge = opts.maxAgeSec ?? 60 * 5;
  if (Math.abs(now - ts) > maxAge) {
    return { ok: false, error: "slack timestamp out of range", status: 401 };
  }

  const base = `v0:${timestamp}:${opts.rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(opts.signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(base));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const expected = `v0=${hex}`;
  if (!timingSafeEqualString(expected, signature)) {
    return { ok: false, error: "unauthorized", status: 401 };
  }
  return { ok: true, method: "provider" };
}

/**
 * Discord ed25519 signature headers — validates presence + timing shape.
 * Full ed25519 verify requires public key; when publicKey provided, uses Web Crypto.
 */
export async function verifyDiscordSignature(opts: {
  headers: Headers | { get(name: string): string | null };
  rawBody: string;
  publicKeyHex: string;
}): Promise<GatewayVerifyResult> {
  const signature = opts.headers.get("x-signature-ed25519")?.trim() ?? "";
  const timestamp = opts.headers.get("x-signature-timestamp")?.trim() ?? "";
  if (!signature || !timestamp) {
    return { ok: false, error: "missing discord signature headers", status: 401 };
  }
  if (!opts.publicKeyHex?.trim()) {
    return { ok: false, error: "discord public key not configured", status: 503 };
  }
  try {
    const keyData = hexToBytes(opts.publicKeyHex.trim()) as BufferSource;
    const sig = hexToBytes(signature) as BufferSource;
    const msg = new TextEncoder().encode(timestamp + opts.rawBody);
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "Ed25519", namedCurve: "Ed25519" } as EcKeyImportParams,
      false,
      ["verify"],
    );
    const ok = await crypto.subtle.verify({ name: "Ed25519" }, key, sig, msg);
    if (!ok) return { ok: false, error: "unauthorized", status: 401 };
    return { ok: true, method: "provider" };
  } catch {
    // Ed25519 may be unavailable in some runtimes — fail closed when key configured.
    return { ok: false, error: "discord signature verification failed", status: 401 };
  }
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) throw new Error("invalid hex");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function verifySharedGatewaySecret(
  headers: Headers | { get(name: string): string | null },
  expected: string | null | undefined,
): GatewayVerifyResult {
  if (!expected?.trim()) {
    return { ok: false, error: "gateway secret not configured", status: 503 };
  }
  const provided = extractSharedGatewaySecret(headers);
  if (!timingSafeEqualString(provided, expected.trim())) {
    return { ok: false, error: "unauthorized", status: 401 };
  }
  return { ok: true, method: "shared_secret" };
}

/**
 * Detect bot-loop: message author is our bot / is_bot flags.
 * Pure extraction — callers decide drop.
 */
export function extractGatewayBotLoopSignal(
  provider: GatewayVerifyProvider,
  body: unknown,
): { isBot: boolean; botUserId: string | null } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { isBot: false, botUserId: null };
  }
  const b = body as Record<string, unknown>;

  if (provider === "slack") {
    const event = b.event && typeof b.event === "object" ? (b.event as Record<string, unknown>) : b;
    const botId = typeof event.bot_id === "string" ? event.bot_id : null;
    const subtype = typeof event.subtype === "string" ? event.subtype : null;
    if (botId || subtype === "bot_message") {
      return { isBot: true, botUserId: botId };
    }
  }

  if (provider === "discord") {
    const author =
      b.author && typeof b.author === "object" ? (b.author as Record<string, unknown>) : null;
    if (author?.bot === true) {
      return {
        isBot: true,
        botUserId: typeof author.id === "string" ? author.id : null,
      };
    }
  }

  if (provider === "telegram") {
    const message =
      b.message && typeof b.message === "object" ? (b.message as Record<string, unknown>) : b;
    const from =
      message.from && typeof message.from === "object"
        ? (message.from as Record<string, unknown>)
        : null;
    if (from?.is_bot === true) {
      return {
        isBot: true,
        botUserId: from.id != null ? String(from.id) : null,
      };
    }
  }

  return { isBot: false, botUserId: null };
}

/** Extract a stable external message id for dedupe when present. */
export function extractExternalMessageId(
  provider: GatewayVerifyProvider,
  body: unknown,
): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;

  if (provider === "slack") {
    const event = b.event && typeof b.event === "object" ? (b.event as Record<string, unknown>) : b;
    const ts = typeof event.ts === "string" ? event.ts : null;
    const channel = typeof event.channel === "string" ? event.channel : "c";
    return ts ? `slack:${channel}:${ts}` : null;
  }
  if (provider === "discord") {
    const id = typeof b.id === "string" ? b.id : null;
    return id ? `discord:${id}` : null;
  }
  if (provider === "telegram") {
    const message =
      b.message && typeof b.message === "object" ? (b.message as Record<string, unknown>) : null;
    const updateId = b.update_id != null ? String(b.update_id) : null;
    const msgId = message?.message_id != null ? String(message.message_id) : null;
    if (updateId) return `telegram:${updateId}`;
    if (msgId) return `telegram:msg:${msgId}`;
  }
  if (provider === "lark") {
    const event = b.event && typeof b.event === "object" ? (b.event as Record<string, unknown>) : b;
    const message =
      event.message && typeof event.message === "object"
        ? (event.message as Record<string, unknown>)
        : null;
    const mid = typeof message?.message_id === "string" ? message.message_id : null;
    return mid ? `lark:${mid}` : null;
  }
  if (provider === "teams") {
    const id = typeof b.id === "string" ? b.id : null;
    return id ? `teams:${id}` : null;
  }
  return null;
}

/** Extract peer (sender) id for allowlist checks. */
export function extractGatewayPeerId(
  provider: GatewayVerifyProvider,
  body: unknown,
): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;

  if (provider === "slack") {
    const event = b.event && typeof b.event === "object" ? (b.event as Record<string, unknown>) : b;
    return typeof event.user === "string" ? event.user : null;
  }
  if (provider === "discord") {
    const author =
      b.author && typeof b.author === "object" ? (b.author as Record<string, unknown>) : null;
    return typeof author?.id === "string" ? author.id : null;
  }
  if (provider === "telegram") {
    const message =
      b.message && typeof b.message === "object" ? (b.message as Record<string, unknown>) : null;
    const from =
      message?.from && typeof message.from === "object"
        ? (message.from as Record<string, unknown>)
        : null;
    return from?.id != null ? String(from.id) : null;
  }
  return null;
}
