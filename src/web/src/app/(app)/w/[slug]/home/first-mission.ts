/**
 * Pure helpers for the optional “first mission” checklist on home.
 * Dismissal is localStorage-keyed; no server state.
 */

export const FIRST_MISSION_STORAGE_PREFIX = "phneakngar.firstMission.v1.";

export function firstMissionStorageKey(workspaceId: string): string {
  return `${FIRST_MISSION_STORAGE_PREFIX}${workspaceId}`;
}

export type FirstMissionVisibilityInput = {
  agentCount: number;
  onlineRuntimeCount: number;
  dismissed: boolean;
};

/** Show when the company has at least one agent and a computer online, and not dismissed. */
export function shouldShowFirstMission(input: FirstMissionVisibilityInput): boolean {
  if (input.dismissed) return false;
  if (input.agentCount < 1) return false;
  if (input.onlineRuntimeCount < 1) return false;
  return true;
}

export type FirstMissionStepId =
  | "agent_online"
  | "send_message"
  | "approvals"
  | "web_brain"
  | "activity";

export type FirstMissionStep = {
  id: FirstMissionStepId;
  /** Path under /w/{slug}/… or external doc anchor */
  href: "agent" | "approvals" | "activity" | "help" | "none";
};

export const FIRST_MISSION_STEPS: FirstMissionStep[] = [
  { id: "agent_online", href: "none" },
  { id: "send_message", href: "agent" },
  { id: "approvals", href: "approvals" },
  { id: "web_brain", href: "help" },
  { id: "activity", href: "activity" },
];

export function resolveFirstMissionHref(
  step: FirstMissionStep,
  slug: string,
  firstAgentId: string | null,
): string | null {
  const prefix = `/w/${slug}`;
  switch (step.href) {
    case "agent":
      return firstAgentId ? `${prefix}/agents/${firstAgentId}` : `${prefix}/home`;
    case "approvals":
      return `${prefix}/approvals`;
    case "activity":
      return `${prefix}/activity`;
    case "help":
      return `${prefix}/help`;
    default:
      return null;
  }
}
