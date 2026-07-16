import { NextRequest } from "next/server";
import { safeEqualSecret } from "@phneakngar/shared/secrets";
import { getDb } from "@/lib/db";
import { withEnv } from "@/lib/middleware/env";
import { writeJSON, writeError } from "@/lib/middleware/helpers";
import {
  ingressGatewayMessage,
  type GatewayProvider,
} from "@/lib/services/gateway-ingress";
import {
  verifyTelegramSecretToken,
  verifySlackSignature,
} from "@/lib/services/gateway-verify";

export const GATEWAY_SECRET_HEADER = "x-gateway-secret";

/**
 * Thin shared webhook handler for chat-gateway providers
 * (Slack / Discord / Telegram / Lark / Teams — F2b Lark included).
 * Workspace mapping: D1 gateway_binding first, then GATEWAY_TEAM_MAP bootstrap.
 *
 * When GATEWAY_TEAM_MAP is set, GATEWAY_WEBHOOK_SECRET is required and every
 * request must present it via x-gateway-secret (or Bearer Authorization).
 * Optional provider-native secrets (TELEGRAM_WEBHOOK_SECRET / SLACK_SIGNING_SECRET)
 * are enforced when configured.
 *
 * Full commercial Helio/OpenClaw parity is still not claimed.
 */
export function createGatewayWebhookHandler(provider: GatewayProvider) {
  return withEnv(async (req: NextRequest, ctx) => {
    if (req.method !== "POST") {
      return writeError("method not allowed", 405);
    }

    const teamMapRaw = ctx.env.GATEWAY_TEAM_MAP ?? null;
    const secret = ctx.env.GATEWAY_WEBHOOK_SECRET?.trim() || "";
    const mapConfigured = Boolean(teamMapRaw?.trim());

    if (mapConfigured && !secret) {
      return writeError(
        "gateway misconfigured: GATEWAY_WEBHOOK_SECRET required when GATEWAY_TEAM_MAP is set",
        503,
      );
    }

    let rawBody = "";
    try {
      rawBody = await req.text();
    } catch {
      return writeError("invalid request body", 400);
    }

    if (secret) {
      const headerSecret = req.headers.get(GATEWAY_SECRET_HEADER);
      const auth = req.headers.get("authorization");
      const bearer =
        auth && /^Bearer\s+/i.test(auth) ? auth.replace(/^Bearer\s+/i, "").trim() : null;
      const provided = headerSecret?.trim() || bearer || "";
      if (!safeEqualSecret(provided, secret)) {
        return writeError("unauthorized", 401);
      }
    }

    // Optional per-provider verification when secrets are present.
    const envExtra = ctx.env as Cloudflare.Env & {
      TELEGRAM_WEBHOOK_SECRET?: string;
      SLACK_SIGNING_SECRET?: string;
    };
    if (provider === "telegram") {
      const tg = envExtra.TELEGRAM_WEBHOOK_SECRET?.trim();
      if (tg) {
        const v = verifyTelegramSecretToken(req.headers, tg);
        if (!v.ok) return writeError(v.error, v.status);
      }
    }
    if (provider === "slack") {
      const slackSecret = envExtra.SLACK_SIGNING_SECRET?.trim();
      if (slackSecret) {
        const v = await verifySlackSignature({
          headers: req.headers,
          rawBody,
          signingSecret: slackSecret,
        });
        if (!v.ok) return writeError(v.error, v.status);
      }
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
      headers: req.headers,
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
