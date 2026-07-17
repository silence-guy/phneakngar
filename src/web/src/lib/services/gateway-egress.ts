/**
 * Production gateway live egress.
 * When a gateway-sourced task completes with outbound_mode=live and a vaulted
 * binding token, send the agent reply via sendLiveGatewayMessage.
 *
 * Full commercial Helio/OpenClaw parity is still not claimed.
 */

import {
  extractChannelDeliveryContent,
  queries,
  type Database,
} from "@phneakngar/shared";
import { log } from "@/lib/logger";
import {
  isLiveOutboundMode,
  sendLiveGatewayMessage,
  type LiveOutboundCredentials,
} from "./gateway-live-outbound";
import type { GatewayProvider } from "./gateway-ingress";
import { isGatewayProvider } from "./gateway-ingress";

export type GatewayEgressTask = {
  id: string;
  agentId: string;
  workspaceId: string;
  conversationId: string;
  context?: unknown;
  result?: unknown;
};

export type GatewayEgressResult =
  | { ok: true; skipped?: string; provider?: string; status?: number }
  | { ok: false; error: string; skipped?: string };

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

export function gatewayEgressDedupeKey(taskId: string): string {
  return `gateway-egress:${taskId}`;
}

/**
 * Pure gate: should we attempt live external send for this task context?
 */
export function shouldAttemptGatewayLiveEgress(context: unknown): {
  attempt: boolean;
  reason?: string;
  provider?: GatewayProvider;
  teamId?: string;
  channelId?: string;
  bindingId?: string | null;
  outboundMode?: string | null;
} {
  const ctx = asRecord(context);
  if (!ctx) return { attempt: false, reason: "no_context" };
  if (ctx.gateway !== true && ctx.gateway !== "true") {
    return { attempt: false, reason: "not_gateway_task" };
  }
  const providerRaw = typeof ctx.provider === "string" ? ctx.provider : "";
  if (!isGatewayProvider(providerRaw)) {
    return { attempt: false, reason: "unsupported_provider" };
  }
  if (providerRaw !== "telegram" && providerRaw !== "slack") {
    return { attempt: false, reason: "provider_not_live", provider: providerRaw };
  }
  const outboundMode =
    typeof ctx.outbound_mode === "string" ? ctx.outbound_mode : null;
  if (!isLiveOutboundMode(outboundMode)) {
    return {
      attempt: false,
      reason: "preview_mode",
      provider: providerRaw,
      outboundMode,
    };
  }
  const teamId =
    typeof ctx.team_id === "string"
      ? ctx.team_id
      : typeof ctx.teamId === "string"
        ? ctx.teamId
        : "";
  const channelId =
    typeof ctx.channel_id === "string"
      ? ctx.channel_id
      : typeof ctx.channelId === "string"
        ? ctx.channelId
        : "";
  if (!teamId.trim() || !channelId.trim()) {
    return {
      attempt: false,
      reason: "missing_team_or_channel",
      provider: providerRaw,
    };
  }
  const bindingId =
    typeof ctx.binding_id === "string"
      ? ctx.binding_id
      : typeof ctx.bindingId === "string"
        ? ctx.bindingId
        : null;
  return {
    attempt: true,
    provider: providerRaw,
    teamId,
    channelId,
    bindingId,
    outboundMode,
  };
}

/**
 * Attempt live external send for a completed gateway task.
 * Soft-fail: never throws to caller; records activity_event when possible.
 */
export async function deliverTaskResultToGatewayLive(
  db: Database,
  task: GatewayEgressTask,
  opts?: {
    result?: unknown;
    fetch?: typeof fetch;
    /** Test injection: pre-resolved token (skips binding load). */
    token?: string | null;
  },
): Promise<GatewayEgressResult> {
  const gate = shouldAttemptGatewayLiveEgress(task.context);
  if (!gate.attempt || !gate.provider || !gate.teamId || !gate.channelId) {
    return { ok: true, skipped: gate.reason ?? "gated" };
  }

  const dedupeKey = gatewayEgressDedupeKey(task.id);
  try {
    if (await queries.activityEvent.hasActivityDedupe(db, task.workspaceId, dedupeKey)) {
      return { ok: true, skipped: "already_sent" };
    }
  } catch (err) {
    // Table may be missing pre-0054 — continue without idempotency.
    log.warn("gateway-egress: dedupe check unavailable", { err: String(err) });
  }

  const content = extractChannelDeliveryContent(opts?.result ?? task.result);
  if (!content) {
    return { ok: true, skipped: "empty_content" };
  }

  let token = opts?.token?.trim() ?? "";
  if (!token) {
    if (!gate.bindingId) {
      return { ok: true, skipped: "no_binding_id" };
    }
    const binding = await queries.gatewayBinding.getGatewayBinding(
      db,
      task.workspaceId,
      gate.bindingId,
    );
    if (!binding) {
      return { ok: true, skipped: "binding_not_found" };
    }
    // Re-check live mode from durable binding (source of truth).
    if (!isLiveOutboundMode(binding.outboundMode)) {
      return { ok: true, skipped: "binding_preview" };
    }
    token = (binding.secretRef ?? "").trim();
    if (!token) {
      return { ok: true, skipped: "missing_token" };
    }
  }

  const creds: LiveOutboundCredentials = {
    token,
    fetch: opts?.fetch,
  };

  const send = await sendLiveGatewayMessage(
    {
      provider: gate.provider,
      teamId: gate.teamId,
      channelId: gate.channelId,
      text: content,
    },
    creds,
  );

  try {
    await queries.activityEvent.createActivityEvent(db, {
      workspaceId: task.workspaceId,
      kind: send.ok ? "gateway_egress_ok" : "gateway_egress_fail",
      summary: send.ok
        ? `Live ${gate.provider} send ok for task ${task.id}`
        : `Live ${gate.provider} send failed for task ${task.id}: ${send.error}`,
      actorType: "agent",
      actorId: task.agentId,
      subjectType: "task",
      subjectId: task.id,
      dedupeKey: send.ok ? dedupeKey : null,
      payloadJson: JSON.stringify({
        provider: gate.provider,
        binding_id: gate.bindingId,
        ok: send.ok,
        status: "status" in send ? send.status : undefined,
        error: send.ok ? undefined : send.error,
      }),
    });
  } catch (err) {
    log.warn("gateway-egress: activity event failed", { err: String(err) });
  }

  if (!send.ok) {
    log.warn("gateway-egress: live send failed", {
      taskId: task.id,
      provider: gate.provider,
      error: send.error,
    });
    return { ok: false, error: send.error };
  }

  return { ok: true, provider: gate.provider, status: send.status };
}
