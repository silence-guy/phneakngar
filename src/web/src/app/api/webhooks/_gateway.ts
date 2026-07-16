import { NextRequest } from "next/server";
import { safeEqualSecret } from "@phneakngar/shared/secrets";
import { getDb } from "@/lib/db";
import { withEnv } from "@/lib/middleware/env";
import { writeJSON, writeError } from "@/lib/middleware/helpers";
import {
  ingressGatewayMessage,
  type GatewayProvider,
} from "@/lib/services/gateway-ingress";

export const GATEWAY_SECRET_HEADER = "x-gateway-secret";

/**
 * Thin shared webhook handler for chat-gateway stubs
 * (Slack / Discord / Telegram / Lark / Teams — F2b Lark included).
 * No provider SDK — JSON body only. Workspace mapping comes from GATEWAY_TEAM_MAP.
 *
 * When GATEWAY_TEAM_MAP is set, GATEWAY_WEBHOOK_SECRET is required and every
 * request must present it via x-gateway-secret (or Bearer Authorization).
 */
export function createGatewayWebhookHandler(provider: GatewayProvider) {
  return withEnv(async (req: NextRequest, ctx) => {
    if (req.method !== "POST") {
      return writeError("method not allowed", 405);
    }

    // Env bindings typed in src/web/src/env.d.ts (GATEWAY_TEAM_MAP / GATEWAY_WEBHOOK_SECRET).
    const teamMapRaw = ctx.env.GATEWAY_TEAM_MAP ?? null;
    const secret = ctx.env.GATEWAY_WEBHOOK_SECRET?.trim() || "";
    const mapConfigured = Boolean(teamMapRaw?.trim());

    if (mapConfigured && !secret) {
      return writeError(
        "gateway misconfigured: GATEWAY_WEBHOOK_SECRET required when GATEWAY_TEAM_MAP is set",
        503,
      );
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

    let body: unknown;
    try {
      body = await req.json();
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

    return writeJSON({
      ok: true,
      provider,
      conversation_id: result.conversationId,
      message_id: result.messageId,
      created_conversation: result.createdConversation,
      task_id: result.taskId ?? null,
    });
  });
}
