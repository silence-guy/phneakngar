import { queries, MessageRole, TASK_TYPES, sliceGraphemes } from "@phneakngar/shared";
import type { Database } from "@phneakngar/shared";
import { TaskService } from "@/lib/services/task";
import { log } from "@/lib/logger";

/**
 * Chat-gateway providers (Phase 4).
 * F2b: Lark is included alongside Slack / Discord / Telegram / Teams.
 * Keep `GATEWAY_PROVIDERS` and `GatewayProvider` in lockstep — webhook routes + outbound stubs cover every entry.
 */
export const GATEWAY_PROVIDERS = ["slack", "discord", "telegram", "lark", "teams"] as const;
export type GatewayProvider = (typeof GATEWAY_PROVIDERS)[number];

export function isGatewayProvider(value: unknown): value is GatewayProvider {
  return typeof value === "string" && (GATEWAY_PROVIDERS as readonly string[]).includes(value);
}

export type GatewayMapping = {
  workspaceId: string;
  agentId: string;
  userId: string;
  /** Present when resolved from D1 gateway_binding. */
  bindingId?: string;
  dmPolicy?: string;
  outboundMode?: string;
};

export type GatewayIngressResult =
  | {
      ok: true;
      conversationId: string;
      messageId: string;
      createdConversation: boolean;
      taskId: string | null;
      /** Quiet no-op paths (bot loop / already processed). */
      ignored?: "bot_loop" | "duplicate";
      bindingId?: string | null;
      outboundMode?: string | null;
    }
  | { ok: false; status: number; error: string };

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

/** Parse GATEWAY_TEAM_MAP JSON: { "slack:T123": { workspaceId, agentId, userId }, ... } */
export function parseGatewayTeamMap(raw: string | undefined | null): Record<string, GatewayMapping> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return {};
    const out: Record<string, GatewayMapping> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!isRecord(value)) continue;
      const workspaceId = asString(value.workspaceId ?? value.workspace_id);
      const agentId = asString(value.agentId ?? value.agent_id);
      const userId = asString(value.userId ?? value.user_id);
      if (!workspaceId || !agentId || !userId) continue;
      out[key] = { workspaceId, agentId, userId };
    }
    return out;
  } catch {
    return {};
  }
}

export function gatewayMapKey(provider: GatewayProvider, teamId: string): string {
  return `${provider}:${teamId}`;
}

export function resolveGatewayMapping(
  map: Record<string, GatewayMapping>,
  provider: GatewayProvider,
  teamId: string,
): GatewayMapping | null {
  return map[gatewayMapKey(provider, teamId)] ?? null;
}

export function extractTeamId(
  provider: GatewayProvider,
  body: unknown,
  headers?: Headers | { get(name: string): string | null },
): string | null {
  const headerTeam =
    headers?.get("x-team-id") ??
    headers?.get("X-Team-Id") ??
    headers?.get("x-external-team-id") ??
    null;
  if (headerTeam?.trim()) return headerTeam.trim();

  // Lark/Feishu tenant header (provider-specific; not used as a generic team override).
  if (provider === "lark") {
    const larkTenantHeader =
      headers?.get("x-lark-tenant-key") ?? headers?.get("X-Lark-Tenant-Key") ?? null;
    if (larkTenantHeader?.trim()) return larkTenantHeader.trim();
  }

  if (!isRecord(body)) return null;

  if (provider === "slack") {
    return (
      asString(body.team_id) ??
      asString(isRecord(body.team) ? body.team.id : null) ??
      asString(isRecord(body.event) ? body.event.team : null)
    );
  }
  if (provider === "discord") {
    return (
      asString(body.guild_id) ??
      asString(isRecord(body.guild) ? body.guild.id : null) ??
      asString(body.team_id)
    );
  }
  if (provider === "lark") {
    // Lark/Feishu: tenant_key body / header.tenant_key / event.tenant_key
    return (
      asString(body.tenant_key) ??
      asString(body.tenant_id) ??
      asString(isRecord(body.header) ? body.header.tenant_key : null) ??
      asString(isRecord(body.event) ? body.event.tenant_key : null) ??
      asString(body.team_id)
    );
  }
  if (provider === "teams") {
    // Microsoft Teams: tenant_id from body, channelData, or conversation
    const channelData = isRecord(body.channelData) ? body.channelData : null;
    const conversation = isRecord(body.conversation) ? body.conversation : null;
    const tenantFromChannelData =
      channelData && isRecord(channelData.tenant)
        ? asString(channelData.tenant.id)
        : channelData
          ? asString(channelData.tenantId)
          : null;
    return (
      asString(body.tenant_id) ??
      tenantFromChannelData ??
      asString(conversation ? conversation.tenantId : null) ??
      asString(body.team_id)
    );
  }
  // telegram uses chat id as the external workspace key
  if (provider === "telegram") {
    if (isRecord(body.message) && isRecord(body.message.chat)) {
      return asString(body.message.chat.id);
    }
    if (isRecord(body.chat)) return asString(body.chat.id);
    return asString(body.chat_id) ?? asString(body.team_id);
  }
  return null;
}

export function extractText(provider: GatewayProvider, body: unknown): string | null {
  if (!isRecord(body)) return null;

  if (provider === "slack") {
    const eventText = isRecord(body.event) ? asString(body.event.text) : null;
    return asString(body.text) ?? eventText;
  }
  if (provider === "discord") {
    return asString(body.content) ?? asString(body.text);
  }
  if (provider === "lark") {
    // event.message.content is often a JSON string: {"text":"..."}
    const event = isRecord(body.event) ? body.event : null;
    const message = event && isRecord(event.message) ? event.message : isRecord(body.message) ? body.message : null;
    if (message) {
      const content = asString(message.content);
      if (content) {
        try {
          const parsed = JSON.parse(content) as unknown;
          if (isRecord(parsed)) {
            const t = asString(parsed.text);
            if (t) return t;
          }
        } catch {
          // plain text content
          return content;
        }
        return content;
      }
      return asString(message.text);
    }
    return asString(body.text) ?? asString(body.content);
  }
  if (provider === "teams") {
    // Bot Framework Activity: text / body / attachments[0].content
    const text = asString(body.text);
    if (text) return text;
    // `body` may be plain text or a nested object with content/text
    const bodyField = body.body;
    if (typeof bodyField === "string") {
      const t = asString(bodyField);
      if (t) return t;
    } else if (isRecord(bodyField)) {
      const nested =
        asString(bodyField.content) ?? asString(bodyField.text) ?? asString(bodyField.body);
      if (nested) return nested;
    }
    if (Array.isArray(body.attachments) && body.attachments[0] && isRecord(body.attachments[0])) {
      return asString(body.attachments[0].content) ?? asString(body.attachments[0].text);
    }
    return asString(body.content);
  }
  // telegram
  if (isRecord(body.message)) {
    return asString(body.message.text) ?? asString(body.message.caption);
  }
  return asString(body.text) ?? asString(body.content);
}

export function extractChannelId(provider: GatewayProvider, body: unknown): string | null {
  if (!isRecord(body)) return null;
  if (provider === "slack") {
    const eventChannel = isRecord(body.event) ? asString(body.event.channel) : null;
    return asString(body.channel_id) ?? asString(body.channel) ?? eventChannel;
  }
  if (provider === "discord") {
    return asString(body.channel_id) ?? asString(isRecord(body.channel) ? body.channel.id : null);
  }
  if (provider === "lark") {
    const event = isRecord(body.event) ? body.event : null;
    const message = event && isRecord(event.message) ? event.message : isRecord(body.message) ? body.message : null;
    return (
      asString(message ? message.chat_id : null) ??
      asString(body.chat_id) ??
      asString(body.open_chat_id) ??
      asString(isRecord(body.chat) ? body.chat.id : null)
    );
  }
  if (provider === "teams") {
    const conversation = isRecord(body.conversation) ? body.conversation : null;
    return (
      asString(conversation ? conversation.id : null) ??
      asString(body.conversation_id) ??
      asString(body.channel_id) ??
      asString(isRecord(body.channel) ? body.channel.id : null)
    );
  }
  // telegram
  if (provider === "telegram") {
    if (isRecord(body.message) && isRecord(body.message.chat)) {
      return asString(body.message.chat.id);
    }
    return asString(body.chat_id) ?? asString(isRecord(body.chat) ? body.chat.id : null);
  }
  return null;
}

export function buildGatewayConversationMapKey(
  provider: GatewayProvider,
  teamId: string,
  channelId: string | null,
): string {
  return `gateway:${provider}:${teamId}:${channelId || "default"}`;
}

/**
 * Resolve workspace mapping: D1 gateway_binding first (product source of truth),
 * then GATEWAY_TEAM_MAP env bootstrap. Full commercial Helio/OpenClaw parity is not claimed.
 */
export async function resolveGatewayIngressMapping(
  db: Database,
  opts: {
    provider: GatewayProvider;
    teamId: string;
    teamMapRaw?: string | null;
    externalAccountId?: string | null;
  },
): Promise<GatewayMapping | null> {
  try {
    const row = await queries.gatewayBinding.findActiveGatewayBinding(
      db,
      opts.provider,
      opts.teamId,
      opts.externalAccountId ?? null,
    );
    if (row) {
      return {
        workspaceId: row.workspaceId,
        agentId: row.agentId,
        userId: row.userId,
        bindingId: row.id,
        dmPolicy: row.dmPolicy,
        outboundMode: row.outboundMode,
      };
    }
  } catch (err) {
    // Table may not exist until 0053 is applied — fall through to env map.
    log.warn("gateway: binding lookup failed; using env map if present", {
      provider: opts.provider,
      err: String(err),
    });
  }

  return resolveGatewayMapping(
    parseGatewayTeamMap(opts.teamMapRaw),
    opts.provider,
    opts.teamId,
  );
}

/**
 * Map an inbound chat-provider message into a workspace conversation + task.
 * Unknown team mappings are rejected (404). Known mappings create/reuse a
 * conversation via conversation_map, append a user message, and enqueue work.
 * Agent + mapped user membership are validated before any write.
 * Bot-authored messages are ignored; external message ids are deduped when present.
 */
export async function ingressGatewayMessage(
  db: Database,
  opts: {
    provider: GatewayProvider;
    body: unknown;
    headers?: Headers | { get(name: string): string | null };
    teamMapRaw?: string | null;
  },
): Promise<GatewayIngressResult> {
  // Lazy import keeps pure extract helpers testable without circular deps.
  const {
    extractGatewayBotLoopSignal,
    extractExternalMessageId,
    extractGatewayPeerId,
  } = await import("./gateway-verify");

  const botLoop = extractGatewayBotLoopSignal(opts.provider, opts.body);
  if (botLoop.isBot) {
    return {
      ok: true,
      conversationId: "",
      messageId: "",
      createdConversation: false,
      taskId: null,
      ignored: "bot_loop",
    };
  }

  const teamId = extractTeamId(opts.provider, opts.body, opts.headers);
  if (!teamId) {
    return { ok: false, status: 400, error: "team_id required" };
  }

  const text = extractText(opts.provider, opts.body);
  if (!text) {
    return { ok: false, status: 400, error: "text required" };
  }

  const mapping = await resolveGatewayIngressMapping(db, {
    provider: opts.provider,
    teamId,
    teamMapRaw: opts.teamMapRaw,
  });
  if (!mapping) {
    return { ok: false, status: 404, error: "unknown workspace mapping" };
  }

  // Validate mapped identities before writing (workspace-scoped first).
  const agent = await queries.agent.getAgent(db, mapping.agentId, mapping.workspaceId);
  if (!agent) {
    return { ok: false, status: 404, error: "mapped agent not found in workspace" };
  }
  const member = await queries.member.getMemberByUserAndWorkspace(
    db,
    mapping.userId,
    mapping.workspaceId,
  );
  if (!member) {
    return { ok: false, status: 404, error: "mapped user not a workspace member" };
  }
  if (!agent.runtimeId) {
    return { ok: false, status: 409, error: "mapped agent has no runtime" };
  }

  // DM policy: allowlist / pairing require peer on allowlist.
  const dmPolicy = (mapping.dmPolicy ?? "open").toLowerCase();
  if (
    mapping.bindingId &&
    (dmPolicy === "allowlist" || dmPolicy === "pairing")
  ) {
    const peerId = extractGatewayPeerId(opts.provider, opts.body);
    if (!peerId) {
      return { ok: false, status: 403, error: "peer id required for dm policy" };
    }
    let allowed = false;
    try {
      allowed = await queries.gatewayBinding.isPeerAllowed(
        db,
        mapping.workspaceId,
        mapping.bindingId,
        peerId,
      );
    } catch (err) {
      log.warn("gateway: peer allowlist check failed", { err: String(err) });
      return { ok: false, status: 503, error: "peer allowlist unavailable" };
    }
    if (!allowed) {
      return { ok: false, status: 403, error: "peer not allowlisted" };
    }
  }

  const externalMessageId = extractExternalMessageId(opts.provider, opts.body);
  if (externalMessageId) {
    try {
      const claim = await queries.gatewayBinding.claimIngressDedupe(db, {
        workspaceId: mapping.workspaceId,
        provider: opts.provider,
        externalMessageId,
      });
      if (!claim.claimed) {
        return {
          ok: true,
          conversationId: claim.row?.conversationId ?? "",
          messageId: claim.row?.messageId ?? "",
          createdConversation: false,
          taskId: null,
          ignored: "duplicate",
          bindingId: mapping.bindingId ?? null,
          outboundMode: mapping.outboundMode ?? null,
        };
      }
    } catch (err) {
      // Dedupe table missing pre-0053 — continue without idempotency.
      log.warn("gateway: ingress dedupe unavailable", { err: String(err) });
    }
  }

  const channelId = extractChannelId(opts.provider, opts.body);
  const mapKey = buildGatewayConversationMapKey(opts.provider, teamId, channelId);

  let conversationId = await queries.conversationMap.findByKey(
    db,
    mapKey,
    mapping.workspaceId,
  );
  let createdConversation = false;

  if (!conversationId) {
    const title = sliceGraphemes(`${opts.provider}: ${text}`, 50);
    const conversation = await queries.conversation.createConversation(db, {
      workspaceId: mapping.workspaceId,
      agentId: mapping.agentId,
      userId: mapping.userId,
      title,
      type: TASK_TYPES.USER_DM_MESSAGE,
      channel: opts.provider,
    });
    conversationId = await queries.conversationMap.createMapping(db, {
      key: mapKey,
      workspaceId: mapping.workspaceId,
      conversationId: conversation.id,
    });
    createdConversation = conversationId === conversation.id;
  }

  const message = await queries.message.createMessage(db, {
    conversationId,
    role: MessageRole.USER,
    content: text,
    metadata: JSON.stringify({
      provider: opts.provider,
      teamId,
      channelId,
      bindingId: mapping.bindingId ?? null,
      outboundMode: mapping.outboundMode ?? null,
      externalMessageId,
    }),
  });

  let taskId: string | null = null;
  try {
    const taskService = new TaskService(db);
    const task = await taskService.enqueueTask(
      mapping.agentId,
      conversationId,
      mapping.workspaceId,
      text,
      TASK_TYPES.USER_DM_MESSAGE,
      {
        contextKey: conversationId,
        context: {
          provider: opts.provider,
          team_id: teamId,
          channel_id: channelId,
          gateway: true,
          binding_id: mapping.bindingId ?? null,
          outbound_mode: mapping.outboundMode ?? null,
        },
      },
    );
    taskId = task?.id ?? null;
  } catch (err) {
    log.warn("gateway: message stored but task enqueue failed", {
      provider: opts.provider,
      conversationId,
      err: String(err),
    });
  }

  return {
    ok: true,
    conversationId,
    messageId: message.id,
    createdConversation,
    taskId,
    bindingId: mapping.bindingId ?? null,
    outboundMode: mapping.outboundMode ?? null,
  };
}
