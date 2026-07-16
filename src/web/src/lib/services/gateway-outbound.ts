/**
 * Gateway outbound stubs (Phase 4).
 *
 * Pure formatters only — no live Slack/Lark/Teams/Discord SDKs or network I/O.
 * Callers can plug the returned payload into a future provider client.
 *
 * F2b: Lark covered alongside Slack / Discord / Telegram / Teams.
 */

import { isGatewayProvider, type GatewayProvider } from "./gateway-ingress";

export type GatewayOutboundMessage = {
  provider: GatewayProvider;
  teamId: string;
  channelId: string;
  text: string;
};

export type GatewayOutboundPayloadResult =
  | { ok: true; provider: GatewayProvider; payload: Record<string, unknown> }
  | { ok: false; error: string };

function buildPayload(msg: GatewayOutboundMessage): Record<string, unknown> {
  switch (msg.provider) {
    case "slack":
      return {
        channel: msg.channelId,
        text: msg.text,
        team: msg.teamId,
      };
    case "discord":
      return {
        channel_id: msg.channelId,
        content: msg.text,
        guild_id: msg.teamId,
      };
    case "telegram":
      return {
        chat_id: msg.channelId || msg.teamId,
        text: msg.text,
      };
    case "lark":
      // Lark/Feishu open-apis/im/v1/messages shape (stub).
      return {
        receive_id: msg.channelId,
        receive_id_type: "chat_id",
        msg_type: "text",
        content: JSON.stringify({ text: msg.text }),
        tenant_key: msg.teamId,
      };
    case "teams":
      // Bot Framework activity shape (stub).
      return {
        type: "message",
        conversation: { id: msg.channelId },
        text: msg.text,
        channelData: { tenant: { id: msg.teamId } },
      };
    default: {
      // Exhaustiveness: adding a GatewayProvider requires a case here.
      const _exhaustive: never = msg.provider;
      throw new Error(`unsupported gateway provider: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Format a provider-specific outbound message payload without performing network I/O.
 */
export function formatGatewayOutboundPayload(
  msg: GatewayOutboundMessage,
): GatewayOutboundPayloadResult {
  if (!msg || typeof msg !== "object") {
    return { ok: false, error: "message required" };
  }
  if (!msg.provider) {
    return { ok: false, error: "provider required" };
  }
  // Runtime guard for untyped callers (JSON configs, future dynamic routes).
  if (!isGatewayProvider(msg.provider)) {
    return { ok: false, error: "unsupported provider" };
  }
  if (!msg.teamId?.trim()) {
    return { ok: false, error: "teamId required" };
  }
  if (!msg.channelId?.trim()) {
    return { ok: false, error: "channelId required" };
  }
  if (!msg.text?.trim()) {
    return { ok: false, error: "text required" };
  }

  return {
    ok: true,
    provider: msg.provider,
    payload: buildPayload(msg),
  };
}
