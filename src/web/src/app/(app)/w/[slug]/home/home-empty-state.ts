import type { MemberRole } from "@/contexts/workspace-context";

/**
 * Home empty-state matrix for agents.length === 0.
 * Encodes plan: plans/2026-07-15-invite-member-vs-cli-ux.md
 */
export type HomeEmptyPresentation = {
  showOwnerConnectRequired: boolean;
  showMemberWaitingForTeamComputer: boolean;
  showMemberOptionalConnect: boolean;
  showMemberWaitingForAgents: boolean;
  showOwnerGetStarted: boolean;
};

export function resolveHomeEmptyPresentation(input: {
  memberRole: MemberRole;
  agentCount: number;
  onlineRuntimeCount: number;
}): HomeEmptyPresentation | null {
  if (input.agentCount > 0) return null;

  const isOwner = input.memberRole === "owner";
  const hasComputer = input.onlineRuntimeCount > 0;

  return {
    showOwnerConnectRequired: isOwner && !hasComputer,
    showMemberWaitingForTeamComputer: !isOwner && !hasComputer,
    showMemberOptionalConnect: !isOwner && !hasComputer,
    showMemberWaitingForAgents: !isOwner && hasComputer,
    showOwnerGetStarted: isOwner,
  };
}

/** True if this presentation auto-mints a machine token on first paint. */
export function emptyStateAutoMintsToken(p: HomeEmptyPresentation): boolean {
  return p.showOwnerConnectRequired;
}
