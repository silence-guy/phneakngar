import { safeEqualSecret } from "./utils/secrets";

export const WS_TICKET_VERSION = 1;
export const WS_USER_TICKET_AUDIENCE = "user-ws";
export const WS_CHHLAT_TICKET_AUDIENCE = "chhlat-ws";
export const WS_TICKET_TTL_SECONDS = 60;

export type WsConnectionTicketAudience =
  | typeof WS_USER_TICKET_AUDIENCE
  | typeof WS_CHHLAT_TICKET_AUDIENCE;

export interface WsConnectionTicketPayload {
  v: typeof WS_TICKET_VERSION;
  aud: WsConnectionTicketAudience;
  sub: string;
  workspaceId?: string;
  chhlatId?: string;
  iat: number;
  exp: number;
  nonce: string;
}

export type WsTicketValidationResult =
  | { ok: true; payload: WsConnectionTicketPayload }
  | { ok: false; reason: "missing" | "malformed" | "bad-signature" | "expired" | "wrong-audience" | "wrong-subject" | "wrong-workspace" | "wrong-chhlat" };

const encoder = new TextEncoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): Uint8Array | null {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

async function hmacSha256(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return base64UrlEncode(new Uint8Array(signature));
}

function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

function parsePayload(encoded: string): WsConnectionTicketPayload | null {
  const bytes = base64UrlDecode(encoded);
  if (!bytes) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as Partial<WsConnectionTicketPayload>;
    if (
      payload.v !== WS_TICKET_VERSION ||
      typeof payload.aud !== "string" ||
      typeof payload.sub !== "string" ||
      payload.sub.length === 0 ||
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number" ||
      typeof payload.nonce !== "string" ||
      payload.nonce.length === 0
    ) {
      return null;
    }
    return payload as WsConnectionTicketPayload;
  } catch {
    return null;
  }
}

export async function issueWsConnectionTicket(
  secret: string,
  data: {
    userId: string;
    audience?: WsConnectionTicketAudience;
    workspaceId?: string;
    chhlatId?: string;
    nowMs?: number;
    ttlSeconds?: number;
  },
): Promise<{ ticket: string; payload: WsConnectionTicketPayload }> {
  const nowSeconds = Math.floor((data.nowMs ?? Date.now()) / 1000);
  const audience = data.audience ?? WS_USER_TICKET_AUDIENCE;
  const payload: WsConnectionTicketPayload = {
    v: WS_TICKET_VERSION,
    aud: audience,
    sub: data.userId,
    ...(data.workspaceId ? { workspaceId: data.workspaceId } : {}),
    ...(data.chhlatId ? { chhlatId: data.chhlatId } : {}),
    iat: nowSeconds,
    exp: nowSeconds + (data.ttlSeconds ?? WS_TICKET_TTL_SECONDS),
    nonce: createNonce(),
  };
  const encodedPayload = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signature = await hmacSha256(secret, encodedPayload);
  return { ticket: `${encodedPayload}.${signature}`, payload };
}

export async function validateWsConnectionTicket(
  secret: string | null | undefined,
  ticket: string | null | undefined,
  options?: {
    expectedAudience?: WsConnectionTicketAudience;
    expectedSubject?: string;
    expectedWorkspaceId?: string;
    expectedChhlatId?: string;
    nowMs?: number;
  },
): Promise<WsTicketValidationResult> {
  if (!secret || !ticket) return { ok: false, reason: "missing" };

  const [encodedPayload, providedSignature, extra] = ticket.split(".");
  if (!encodedPayload || !providedSignature || extra !== undefined) {
    return { ok: false, reason: "malformed" };
  }

  const payload = parsePayload(encodedPayload);
  if (!payload) return { ok: false, reason: "malformed" };

  const expectedSignature = await hmacSha256(secret, encodedPayload);
  if (!safeEqualSecret(providedSignature, expectedSignature)) {
    return { ok: false, reason: "bad-signature" };
  }

  const nowSeconds = Math.floor((options?.nowMs ?? Date.now()) / 1000);
  if (payload.exp <= nowSeconds) return { ok: false, reason: "expired" };
  if (payload.aud !== WS_USER_TICKET_AUDIENCE && payload.aud !== WS_CHHLAT_TICKET_AUDIENCE) {
    return { ok: false, reason: "wrong-audience" };
  }
  if (options?.expectedAudience && payload.aud !== options.expectedAudience) {
    return { ok: false, reason: "wrong-audience" };
  }
  if (options?.expectedSubject && payload.sub !== options.expectedSubject) {
    return { ok: false, reason: "wrong-subject" };
  }
  if (options?.expectedWorkspaceId && payload.workspaceId !== options.expectedWorkspaceId) {
    return { ok: false, reason: "wrong-workspace" };
  }
  if (options?.expectedChhlatId && payload.chhlatId !== options.expectedChhlatId) {
    return { ok: false, reason: "wrong-chhlat" };
  }

  return { ok: true, payload };
}
