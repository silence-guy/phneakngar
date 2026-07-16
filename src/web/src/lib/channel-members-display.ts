/**
 * Pure display helpers for channel participant lists (C8).
 * No I/O — map API membership rows + name directories into ordered UI rows.
 */

export type ChannelMemberType = "user" | "agent";

export type ChannelMemberRow = {
  id: string;
  workspace_id: string;
  channel_id: string;
  member_type: ChannelMemberType | string;
  member_id: string;
  created_at?: string;
};

export type ResolvedChannelMember = {
  key: string;
  memberType: ChannelMemberType;
  memberId: string;
  displayName: string;
  subtitle: string | null;
  /** Membership row id when present. */
  membershipId: string | null;
};

export type NameDirectory = {
  /** agentId → display name */
  agents?: Record<string, string | undefined | null>;
  /** userId → display name */
  users?: Record<string, string | undefined | null>;
  /** userId → email (fallback / subtitle) */
  userEmails?: Record<string, string | undefined | null>;
};

function normalizeType(raw: string): ChannelMemberType | null {
  if (raw === "agent" || raw === "user") return raw;
  return null;
}

function fallbackName(memberType: ChannelMemberType, memberId: string): string {
  const short = memberId.length > 10 ? `${memberId.slice(0, 8)}…` : memberId;
  return memberType === "agent" ? `Agent ${short}` : `User ${short}`;
}

/**
 * Resolve a single membership into a display row.
 * Unknown member_type rows are dropped (returns null).
 */
export function resolveChannelMemberRow(
  row: ChannelMemberRow,
  names: NameDirectory = {},
): ResolvedChannelMember | null {
  const memberType = normalizeType(row.member_type);
  if (!memberType) return null;

  if (memberType === "agent") {
    const name = names.agents?.[row.member_id]?.trim();
    return {
      key: `agent:${row.member_id}`,
      memberType,
      memberId: row.member_id,
      displayName: name && name.length > 0 ? name : fallbackName("agent", row.member_id),
      subtitle: "agent",
      membershipId: row.id ?? null,
    };
  }

  const userName = names.users?.[row.member_id]?.trim();
  const email = names.userEmails?.[row.member_id]?.trim() ?? null;
  const displayName =
    userName && userName.length > 0
      ? userName
      : email && email.length > 0
        ? email
        : fallbackName("user", row.member_id);

  return {
    key: `user:${row.member_id}`,
    memberType,
    memberId: row.member_id,
    displayName,
    subtitle: userName && email && userName !== email ? email : "user",
    membershipId: row.id ?? null,
  };
}

/**
 * Order: agents first (stable by displayName), then users.
 * Drops unknown types and de-dupes by (type, id) keeping first occurrence.
 */
export function resolveChannelMembers(
  rows: ChannelMemberRow[],
  names: NameDirectory = {},
): ResolvedChannelMember[] {
  const seen = new Set<string>();
  const agents: ResolvedChannelMember[] = [];
  const users: ResolvedChannelMember[] = [];

  for (const row of rows) {
    const resolved = resolveChannelMemberRow(row, names);
    if (!resolved) continue;
    if (seen.has(resolved.key)) continue;
    seen.add(resolved.key);
    if (resolved.memberType === "agent") agents.push(resolved);
    else users.push(resolved);
  }

  const byName = (a: ResolvedChannelMember, b: ResolvedChannelMember) =>
    a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" });

  agents.sort(byName);
  users.sort(byName);
  return [...agents, ...users];
}

/**
 * Agents available to add: workspace agents not already channel members.
 * Current agent is ordered first when present in the pool.
 */
export function agentsAvailableToAdd(
  workspaceAgents: Array<{ id: string; name: string }>,
  members: ChannelMemberRow[],
  opts?: { preferAgentId?: string | null },
): Array<{ id: string; name: string }> {
  const memberAgentIds = new Set(
    members
      .filter((m) => m.member_type === "agent")
      .map((m) => m.member_id),
  );

  const available = workspaceAgents
    .filter((a) => a.id && !memberAgentIds.has(a.id))
    .map((a) => ({ id: a.id, name: a.name?.trim() || fallbackName("agent", a.id) }));

  available.sort((a, b) => {
    if (opts?.preferAgentId) {
      if (a.id === opts.preferAgentId) return -1;
      if (b.id === opts.preferAgentId) return 1;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  return available;
}

/** Count agents in a membership list (for badge). */
export function countAgentMembers(rows: ChannelMemberRow[]): number {
  return rows.filter((r) => r.member_type === "agent").length;
}
