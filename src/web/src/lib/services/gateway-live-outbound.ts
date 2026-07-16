/**
 * Live gateway outbound clients (feature-flagged).
 * Prefer injectable fetch; format stubs remain in gateway-outbound.ts for preview.
 * Full commercial Helio/OpenClaw parity is still not claimed.
 */

import {
  formatGatewayOutboundPayload,
  type GatewayOutboundMessage,
} from "./gateway-outbound";
import type { GatewayProvider } from "./gateway-ingress";

export type LiveOutboundResult =
  | { ok: true; provider: GatewayProvider; status: number; body: unknown }
  | { ok: false; error: string; status?: number };

export type LiveOutboundCredentials = {
  /** Bot token / bearer for the provider. */
  token: string;
  /** Optional API base override (tests). */
  baseUrl?: string;
  fetch?: typeof fetch;
};

/**
 * Whether outbound_mode on a binding allows live network send.
 */
export function isLiveOutboundMode(mode: string | null | undefined): boolean {
  return (mode ?? "").trim().toLowerCase() === "live";
}

/**
 * Send a live message when credentials present. Never called for preview mode.
 */
export async function sendLiveGatewayMessage(
  msg: GatewayOutboundMessage,
  creds: LiveOutboundCredentials,
): Promise<LiveOutboundResult> {
  if (!creds.token?.trim()) {
    return { ok: false, error: "missing token", status: 401 };
  }
  const formatted = formatGatewayOutboundPayload(msg);
  if (!formatted.ok) {
    return { ok: false, error: formatted.error, status: 400 };
  }

  const fetchImpl = creds.fetch ?? globalThis.fetch;
  if (!fetchImpl) {
    return { ok: false, error: "fetch unavailable", status: 500 };
  }

  try {
    if (msg.provider === "telegram") {
      const base = (creds.baseUrl ?? "https://api.telegram.org").replace(/\/$/, "");
      const url = `${base}/bot${creds.token}/sendMessage`;
      const res = await fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: msg.channelId || msg.teamId,
          text: msg.text,
        }),
      });
      const body = await safeJson(res);
      if (!res.ok) {
        return { ok: false, error: "telegram send failed", status: res.status };
      }
      return { ok: true, provider: "telegram", status: res.status, body };
    }

    if (msg.provider === "slack") {
      const base = (creds.baseUrl ?? "https://slack.com/api").replace(/\/$/, "");
      const res = await fetchImpl(`${base}/chat.postMessage`, {
        method: "POST",
        headers: {
          "content-type": "application/json; charset=utf-8",
          authorization: `Bearer ${creds.token}`,
        },
        body: JSON.stringify({
          channel: msg.channelId,
          text: msg.text,
        }),
      });
      const body = await safeJson(res);
      const okFlag =
        body && typeof body === "object" && (body as { ok?: boolean }).ok === true;
      if (!res.ok || !okFlag) {
        return { ok: false, error: "slack send failed", status: res.status };
      }
      return { ok: true, provider: "slack", status: res.status, body };
    }

    // Other providers remain preview-only until Live clients land.
    return {
      ok: false,
      error: `live outbound not implemented for ${msg.provider}`,
      status: 501,
    };
  } catch (err) {
    return { ok: false, error: String(err), status: 500 };
  }
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/** Product badge helper. */
export function outboundModeBadge(
  mode: string | null | undefined,
): "Live" | "Preview" {
  return isLiveOutboundMode(mode) ? "Live" : "Preview";
}
