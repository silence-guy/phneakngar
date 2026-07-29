import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { withEnv } from "@/lib/middleware/env";
import { writeJSON, writeError } from "@/lib/middleware/helpers";
import {
  ingressGatewayMessage,
  type GatewayProvider,
} from "@/lib/services/gateway-ingress";
import {
  verifyGatewayRequest,
  type GatewayVerifyEnv,
} from "@/lib/services/gateway-verify";

export const GATEWAY_SECRET_HEADER = "x-gateway-secret";

/**
 * Thin shared webhook handler for chat-gateway providers
 * (Slack / Discord / Telegram / Lark / Teams).
 * Workspace mapping: D1 gateway_binding first, then GATEWAY_TEAM_MAP bootstrap.
 *
 * Authentication is unconditional. Every provider must have either its native signature
 * secret or the shared GATEWAY_WEBHOOK_SECRET configured; otherwise the route fails closed
 * with 503. GATEWAY_TEAM_MAP has no bearing on authentication — inbound text becomes an
 * agent task prompt, so an unverified request must never reach ingress.
 *
 * Full commercial Helio/OpenClaw parity is still not claimed.
 */
export function createGatewayWebhookHandler(provider: GatewayProvider) {
  return withEnv(async (req: NextRequest, ctx) => {
    if (req.method !== "POST") {
      return writeError("method not allowed", 405);
    }

    const teamMapRaw = ctx.env.GATEWAY_TEAM_MAP ?? null;

    let rawBody = "";
    try {
      rawBody = await req.text();
    } catch {
      return writeError("invalid request body", 400);
    }

    const verdict = await verifyGatewayRequest({
      provider,
      headers: req.headers,
      rawBody,
      env: ctx.env as Cloudflare.Env & GatewayVerifyEnv,
    });
    if (!verdict.ok) {
      return writeError(verdict.error, verdict.status);
    }

    let body: unknown;
    try {
      body = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      return writeError("invalid request body", 400);
    }

    const db = getDb(ctx.env.DB);

    const result = await ingressGatewayMessage(db, {
      provider,
      body,
      teamMapRaw,
    });

    if (!result.ok) {
      return writeError(result.error, result.status);
    }

    if (result.ignored) {
      return writeJSON({
        ok: true,
        provider,
        ignored: result.ignored,
        conversation_id: result.conversationId || null,
        message_id: result.messageId || null,
      });
    }

    return writeJSON({
      ok: true,
      provider,
      conversation_id: result.conversationId,
      message_id: result.messageId,
      created_conversation: result.createdConversation,
      task_id: result.taskId ?? null,
      binding_id: result.bindingId ?? null,
      outbound_mode: result.outboundMode ?? null,
    });
  });
}
