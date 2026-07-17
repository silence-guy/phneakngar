import { and, eq, isNull } from "drizzle-orm";
import { gatewayBinding, gatewayIngressDedupe, gatewayPeerAllowlist } from "../schema";
import type { Database } from "../index";

export type GatewayBindingStatus = "active" | "disabled";
export type GatewayDmPolicy = "open" | "allowlist" | "pairing";
export type GatewayOutboundMode = "live" | "preview";

export async function listGatewayBindings(db: Database, workspaceId: string) {
  return db
    .select()
    .from(gatewayBinding)
    .where(eq(gatewayBinding.workspaceId, workspaceId));
}

export async function getGatewayBinding(
  db: Database,
  workspaceId: string,
  bindingId: string,
) {
  const rows = await db
    .select()
    .from(gatewayBinding)
    .where(
      and(eq(gatewayBinding.workspaceId, workspaceId), eq(gatewayBinding.id, bindingId)),
    );
  return rows[0] ?? null;
}

/**
 * Resolve active binding for provider + external team (workspace-scoped lookup by key).
 * externalAccountId null matches rows with null account.
 */
export async function findActiveGatewayBinding(
  db: Database,
  provider: string,
  externalTeamId: string,
  externalAccountId?: string | null,
) {
  if (externalAccountId) {
    const rows = await db
      .select()
      .from(gatewayBinding)
      .where(
        and(
          eq(gatewayBinding.provider, provider),
          eq(gatewayBinding.externalTeamId, externalTeamId),
          eq(gatewayBinding.externalAccountId, externalAccountId),
          eq(gatewayBinding.status, "active"),
        ),
      );
    if (rows[0]) return rows[0];
  }

  const rows = await db
    .select()
    .from(gatewayBinding)
    .where(
      and(
        eq(gatewayBinding.provider, provider),
        eq(gatewayBinding.externalTeamId, externalTeamId),
        isNull(gatewayBinding.externalAccountId),
        eq(gatewayBinding.status, "active"),
      ),
    );
  return rows[0] ?? null;
}

export async function createGatewayBinding(
  db: Database,
  data: {
    workspaceId: string;
    provider: string;
    externalTeamId: string;
    externalAccountId?: string | null;
    agentId: string;
    userId: string;
    status?: GatewayBindingStatus;
    dmPolicy?: GatewayDmPolicy;
    outboundMode?: GatewayOutboundMode;
    /** Write-only bot token / vault pointer. */
    secretRef?: string | null;
  },
) {
  const now = new Date().toISOString();
  const rows = await db
    .insert(gatewayBinding)
    .values({
      workspaceId: data.workspaceId,
      provider: data.provider,
      externalTeamId: data.externalTeamId,
      externalAccountId: data.externalAccountId ?? null,
      agentId: data.agentId,
      userId: data.userId,
      status: data.status ?? "active",
      dmPolicy: data.dmPolicy ?? "open",
      outboundMode: data.outboundMode ?? "preview",
      secretRef: data.secretRef ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return rows[0] ?? null;
}

export async function updateGatewayBinding(
  db: Database,
  workspaceId: string,
  bindingId: string,
  patch: {
    status?: GatewayBindingStatus;
    dmPolicy?: GatewayDmPolicy;
    outboundMode?: GatewayOutboundMode;
    agentId?: string;
    userId?: string;
    /** Write-only; pass null to clear. Omit to leave unchanged. */
    secretRef?: string | null;
  },
) {
  const set: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  if (patch.status !== undefined) set.status = patch.status;
  if (patch.dmPolicy !== undefined) set.dmPolicy = patch.dmPolicy;
  if (patch.outboundMode !== undefined) set.outboundMode = patch.outboundMode;
  if (patch.agentId !== undefined) set.agentId = patch.agentId;
  if (patch.userId !== undefined) set.userId = patch.userId;
  if (patch.secretRef !== undefined) set.secretRef = patch.secretRef;

  const rows = await db
    .update(gatewayBinding)
    .set(set)
    .where(
      and(eq(gatewayBinding.workspaceId, workspaceId), eq(gatewayBinding.id, bindingId)),
    )
    .returning();
  return rows[0] ?? null;
}

/** Public API shape — never includes secretRef. */
export function toPublicGatewayBinding(row: {
  id: string;
  workspaceId: string;
  provider: string;
  externalTeamId: string;
  externalAccountId: string | null;
  agentId: string;
  userId: string;
  status: string;
  dmPolicy: string;
  outboundMode: string;
  secretRef?: string | null;
  createdAt: string;
  updatedAt: string;
}) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    provider: row.provider,
    externalTeamId: row.externalTeamId,
    externalAccountId: row.externalAccountId,
    agentId: row.agentId,
    userId: row.userId,
    status: row.status,
    dmPolicy: row.dmPolicy,
    outboundMode: row.outboundMode,
    hasSecret: Boolean(row.secretRef?.trim()),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function deleteGatewayBinding(
  db: Database,
  workspaceId: string,
  bindingId: string,
) {
  const rows = await db
    .delete(gatewayBinding)
    .where(
      and(eq(gatewayBinding.workspaceId, workspaceId), eq(gatewayBinding.id, bindingId)),
    )
    .returning();
  return rows[0] ?? null;
}

export async function listPeerAllowlist(
  db: Database,
  workspaceId: string,
  bindingId: string,
) {
  return db
    .select()
    .from(gatewayPeerAllowlist)
    .where(
      and(
        eq(gatewayPeerAllowlist.workspaceId, workspaceId),
        eq(gatewayPeerAllowlist.bindingId, bindingId),
      ),
    );
}

export async function isPeerAllowed(
  db: Database,
  workspaceId: string,
  bindingId: string,
  peerId: string,
): Promise<boolean> {
  const rows = await db
    .select()
    .from(gatewayPeerAllowlist)
    .where(
      and(
        eq(gatewayPeerAllowlist.workspaceId, workspaceId),
        eq(gatewayPeerAllowlist.bindingId, bindingId),
        eq(gatewayPeerAllowlist.peerId, peerId),
      ),
    );
  const row = rows[0];
  if (!row) return false;
  return row.status === "allow" || row.status === "paired";
}

export async function addPeerAllowlist(
  db: Database,
  data: {
    workspaceId: string;
    bindingId: string;
    peerId: string;
    status?: "allow" | "deny" | "paired";
  },
) {
  const rows = await db
    .insert(gatewayPeerAllowlist)
    .values({
      workspaceId: data.workspaceId,
      bindingId: data.bindingId,
      peerId: data.peerId,
      status: data.status ?? "allow",
      createdAt: new Date().toISOString(),
    })
    .onConflictDoNothing()
    .returning();
  if (rows[0]) return rows[0];
  const existing = await db
    .select()
    .from(gatewayPeerAllowlist)
    .where(
      and(
        eq(gatewayPeerAllowlist.workspaceId, data.workspaceId),
        eq(gatewayPeerAllowlist.bindingId, data.bindingId),
        eq(gatewayPeerAllowlist.peerId, data.peerId),
      ),
    );
  return existing[0] ?? null;
}

export async function removePeerAllowlist(
  db: Database,
  workspaceId: string,
  bindingId: string,
  peerId: string,
) {
  const rows = await db
    .delete(gatewayPeerAllowlist)
    .where(
      and(
        eq(gatewayPeerAllowlist.workspaceId, workspaceId),
        eq(gatewayPeerAllowlist.bindingId, bindingId),
        eq(gatewayPeerAllowlist.peerId, peerId),
      ),
    )
    .returning();
  return rows[0] ?? null;
}

/**
 * Soft-idempotent: insert dedupe row; on conflict return existing (duplicate).
 */
export async function claimIngressDedupe(
  db: Database,
  data: {
    workspaceId: string;
    provider: string;
    externalMessageId: string;
    conversationId?: string | null;
    messageId?: string | null;
  },
): Promise<{ claimed: boolean; row: typeof gatewayIngressDedupe.$inferSelect | null }> {
  const rows = await db
    .insert(gatewayIngressDedupe)
    .values({
      workspaceId: data.workspaceId,
      provider: data.provider,
      externalMessageId: data.externalMessageId,
      conversationId: data.conversationId ?? null,
      messageId: data.messageId ?? null,
      createdAt: new Date().toISOString(),
    })
    .onConflictDoNothing()
    .returning();
  if (rows[0]) return { claimed: true, row: rows[0] };

  const existing = await db
    .select()
    .from(gatewayIngressDedupe)
    .where(
      and(
        eq(gatewayIngressDedupe.provider, data.provider),
        eq(gatewayIngressDedupe.externalMessageId, data.externalMessageId),
      ),
    );
  return { claimed: false, row: existing[0] ?? null };
}

// ---------------------------------------------------------------------------
// Dry-config doctor assessors (no live provider API probes).
// Live badges are not send-readiness; full commercial Helio/OpenClaw parity is not claimed.
// ---------------------------------------------------------------------------

export type GatewayBindingDrySnapshot = {
  id?: string;
  provider: string;
  externalTeamId?: string | null;
  agentId?: string | null;
  status?: string | null;
  dmPolicy?: string | null;
  outboundMode?: string | null;
  /** True when secret_ref is non-empty (never pass raw secret into assessor). */
  hasSecret?: boolean | null;
};

export type GatewayDryConfigIssue = {
  code: string;
  severity: "warning" | "critical";
  message: string;
  next_actions?: string[];
};

export type GatewayBindingsDryConfigReport = {
  status: "ok" | "warning" | "critical";
  total: number;
  active: number;
  disabled: number;
  live: number;
  preview: number;
  /** Bindings marked live; dry-config cannot prove outbound tokens exist. */
  live_without_token_risk: number;
  missing_team_id: number;
  missing_agent_ref: number;
  issues: GatewayDryConfigIssue[];
};

export type GatewayWebhookSecretConfigReport = {
  status: "ok" | "warning" | "critical";
  map_configured: boolean;
  secret_configured: boolean;
  /** True when map expects a shared secret and it is missing (fail-closed). */
  fail_closed: boolean;
  issues: GatewayDryConfigIssue[];
};

function isLiveOutboundModeDry(mode: string | null | undefined): boolean {
  return (mode ?? "").trim().toLowerCase() === "live";
}

function worstDryStatus(
  issues: GatewayDryConfigIssue[],
): "ok" | "warning" | "critical" {
  if (issues.some((issue) => issue.severity === "critical")) return "critical";
  return issues.length > 0 ? "warning" : "ok";
}

/**
 * Pure dry-config assessment of gateway bindings.
 * Does not call Telegram/Slack/etc. network APIs.
 */
export function assessGatewayBindingsDryConfig(
  bindings: GatewayBindingDrySnapshot[],
  opts: { knownAgentIds?: Iterable<string> } = {},
): GatewayBindingsDryConfigReport {
  const known = opts.knownAgentIds ? new Set(opts.knownAgentIds) : null;
  const issues: GatewayDryConfigIssue[] = [];
  let active = 0;
  let disabled = 0;
  let live = 0;
  let preview = 0;
  let live_without_token_risk = 0;
  let missing_team_id = 0;
  let missing_agent_ref = 0;

  for (const binding of bindings) {
    const status = (binding.status ?? "active").trim().toLowerCase();
    if (status === "disabled") disabled += 1;
    else active += 1;

    if (isLiveOutboundModeDry(binding.outboundMode)) {
      live += 1;
      // Live without vaulted secret_ref is still a send-readiness risk.
      if (!binding.hasSecret) {
        live_without_token_risk += 1;
      }
    } else {
      preview += 1;
    }

    if (!(binding.externalTeamId ?? "").trim()) {
      missing_team_id += 1;
    }
    if (
      known &&
      (!(binding.agentId ?? "").trim() || !known.has(binding.agentId as string))
    ) {
      missing_agent_ref += 1;
    }
  }

  if (missing_team_id > 0) {
    issues.push({
      code: "gateway_binding_missing_team_id",
      severity: "critical",
      message: "One or more gateway bindings are missing an external team / chat id.",
      next_actions: ["fix_gateway_binding_team_id"],
    });
  }
  if (missing_agent_ref > 0) {
    issues.push({
      code: "gateway_binding_missing_agent",
      severity: "critical",
      message: "One or more gateway bindings reference a missing or unscoped agent.",
      next_actions: ["reassign_gateway_binding_agent"],
    });
  }
  if (live_without_token_risk > 0) {
    issues.push({
      code: "gateway_live_without_token_risk",
      severity: "warning",
      message:
        "One or more bindings are marked Live, but dry-config cannot verify outbound provider tokens. Live badges are not proof of send readiness.",
      next_actions: ["configure_live_outbound_credentials", "or_switch_outbound_to_preview"],
    });
  }

  return {
    status: worstDryStatus(issues),
    total: bindings.length,
    active,
    disabled,
    live,
    preview,
    live_without_token_risk,
    missing_team_id,
    missing_agent_ref,
    issues,
  };
}

/**
 * Pure dry-config for GATEWAY_TEAM_MAP / GATEWAY_WEBHOOK_SECRET fail-closed rule.
 * When the map is set, a shared secret is required; webhooks return 503 otherwise.
 */
export function assessGatewayWebhookSecretConfig(env: {
  GATEWAY_TEAM_MAP?: string | null;
  GATEWAY_WEBHOOK_SECRET?: string | null;
}): GatewayWebhookSecretConfigReport {
  const map_configured = Boolean(env.GATEWAY_TEAM_MAP?.trim());
  const secret_configured = Boolean(env.GATEWAY_WEBHOOK_SECRET?.trim());
  const fail_closed = map_configured && !secret_configured;
  const issues: GatewayDryConfigIssue[] = [];
  if (fail_closed) {
    issues.push({
      code: "gateway_webhook_secret_missing",
      severity: "critical",
      message:
        "GATEWAY_TEAM_MAP is set without GATEWAY_WEBHOOK_SECRET; gateway webhooks fail closed.",
      next_actions: ["set_GATEWAY_WEBHOOK_SECRET", "or_clear_GATEWAY_TEAM_MAP"],
    });
  }
  return {
    status: fail_closed ? "critical" : "ok",
    map_configured,
    secret_configured,
    fail_closed,
    issues,
  };
}
