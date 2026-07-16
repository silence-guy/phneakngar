/**
 * DM membership helpers.
 *
 * Schema: conversation has primary agentId + userId. Multi-party membership
 * is modeled on conversation_member (0052). Pure helpers resolve participants
 * from conversation rows and/or membership rows without inventing product UX.
 */

export type DmParticipantType = "agent" | "user";

export type DmConversationLike = {
  id: string;
  agentId?: string | null;
  agent_id?: string | null;
  userId?: string | null;
  user_id?: string | null;
  type?: string | null;
};

export type DmMembershipLike = {
  memberType?: string | null;
  member_type?: string | null;
  memberId?: string | null;
  member_id?: string | null;
};

export type DmParticipant = {
  key: string;
  memberType: DmParticipantType;
  memberId: string;
  role: "agent" | "user";
};

/** Conversations of this type are treated as DMs for participant resolution. */
export const DM_CONVERSATION_TYPES = new Set(["user_dm_message", "dm"]);

export function isDmConversationType(type: string | null | undefined): boolean {
  if (!type) return true; // default conversation type is user_dm_message
  return DM_CONVERSATION_TYPES.has(type);
}

/**
 * Multi-party DM is supported via conversation_member rows.
 * Primary conversation.agentId remains the task-routing owner.
 */
export const MULTI_PARTY_DM_SUPPORTED = true;

function pushParticipant(
  out: DmParticipant[],
  seen: Set<string>,
  memberType: DmParticipantType,
  memberId: string,
) {
  const id = memberId.trim();
  if (!id) return;
  const key = `${memberType}:${id}`;
  if (seen.has(key)) return;
  seen.add(key);
  out.push({
    key,
    memberType,
    memberId: id,
    role: memberType,
  });
}

/** Normalize membership rows into typed (memberType, memberId) pairs. */
export function mergeDmMemberships(
  memberships: DmMembershipLike[] | null | undefined,
): Array<{ memberType: DmParticipantType; memberId: string }> {
  const out: Array<{ memberType: DmParticipantType; memberId: string }> = [];
  const seen = new Set<string>();
  for (const row of memberships ?? []) {
    const rawType = (row.memberType ?? row.member_type ?? "").trim();
    const rawId = (row.memberId ?? row.member_id ?? "").trim();
    if (rawType !== "agent" && rawType !== "user") continue;
    if (!rawId) continue;
    const key = `${rawType}:${rawId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ memberType: rawType, memberId: rawId });
  }
  return out;
}

/**
 * Resolve durable DM participants from a conversation row (1:1 primary pair)
 * and optional conversation_member rows.
 *
 * - If memberships are provided: primary pair first, then extra members merged in.
 * - Else: fall back to conversation agent + user only.
 *
 * Returns agent first, then user for the primary pair. Drops empty ids.
 */
export function resolveDmParticipants(
  conversation: DmConversationLike | null | undefined,
  memberships?: DmMembershipLike[] | null,
): DmParticipant[] {
  if (!conversation) return [];
  if (!isDmConversationType(conversation.type)) return [];

  const out: DmParticipant[] = [];
  const seen = new Set<string>();

  const agentId = (conversation.agentId ?? conversation.agent_id ?? "").trim();
  const userId = (conversation.userId ?? conversation.user_id ?? "").trim();
  if (agentId) pushParticipant(out, seen, "agent", agentId);
  if (userId) pushParticipant(out, seen, "user", userId);

  // When memberships array is provided, merge extras (and re-include primary if present).
  if (memberships != null) {
    for (const { memberType, memberId } of mergeDmMemberships(memberships)) {
      pushParticipant(out, seen, memberType, memberId);
    }
  }

  return out;
}

/**
 * Merge primary conversation participants with conversation_member rows.
 * Alias of resolveDmParticipants(conversation, memberships).
 */
export function resolveDmParticipantsFromMembership(
  conversation: DmConversationLike | null | undefined,
  memberships: DmMembershipLike[] | null | undefined,
): DmParticipant[] {
  return resolveDmParticipants(conversation, memberships ?? []);
}

/** True when membership rows expand the participant set beyond the primary pair. */
export function isMultiPartyDm(
  conversation: DmConversationLike | null | undefined,
  memberships: DmMembershipLike[] | null | undefined,
): boolean {
  return resolveDmParticipants(conversation, memberships ?? []).length > 2;
}

/** True when the given agent is a DM participant (primary or membership). */
export function isAgentDmParticipant(
  conversation: DmConversationLike | null | undefined,
  agentId: string,
  memberships?: DmMembershipLike[] | null,
): boolean {
  const id = agentId.trim();
  if (!id) return false;
  const parts = resolveDmParticipants(conversation, memberships);
  return parts.some((p) => p.memberType === "agent" && p.memberId === id);
}
