import type { LoginResponse, Workspace } from "@phneakngar/shared";
import { apiFetch, wsQuery } from "./client";

export const listWorkspaces = () => apiFetch<Workspace[]>("/api/workspaces");

export const createWorkspace = (name: string, slug?: string) =>
  apiFetch<Workspace>("/api/workspaces", {
    method: "POST",
    body: JSON.stringify({ name, slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workspace" }),
  });

export const updateWorkspace = (workspaceId: string, data: { name?: string; slug?: string; default_locale?: "km" | "en" }) =>
  apiFetch<Workspace>(`/api/workspaces/${workspaceId}${wsQuery(workspaceId)}`, { method: "PATCH", body: JSON.stringify(data) });

export const deleteWorkspace = (workspaceId: string, confirmName: string) =>
  apiFetch<void>(`/api/workspaces/${workspaceId}${wsQuery(workspaceId)}`, { method: "DELETE", body: JSON.stringify({ confirm_name: confirmName }) });

// Members
export interface MemberEntry {
  id: string; user_id: string; role: string; name: string; email: string; image: string | null; created_at: string;
}

export const listMembers = (workspaceId: string) =>
  apiFetch<MemberEntry[]>(`/api/workspaces/${workspaceId}/members${wsQuery(workspaceId)}`);

export const removeMember = (workspaceId: string, memberId: string) =>
  apiFetch<void>(`/api/workspaces/${workspaceId}/members/${memberId}${wsQuery(workspaceId)}`, { method: "DELETE" });

export interface MemberMeSettings {
  global_instruction: string;
  preferred_locale: "km" | "en";
}

export const getMemberMe = (workspaceId: string) =>
  apiFetch<MemberMeSettings>(`/api/members/me${wsQuery(workspaceId)}`);

export const updateMemberMe = (
  workspaceId: string,
  globalInstruction: string,
  preferredLocale?: "km" | "en",
) =>
  apiFetch<MemberMeSettings>(`/api/members/me${wsQuery(workspaceId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      global_instruction: globalInstruction,
      ...(preferredLocale ? { preferred_locale: preferredLocale } : {}),
    }),
  });

// Invites
export interface InviteEntry {
  id: string; token: string; expires_at: string; created_at: string;
}

export const listInvites = (workspaceId: string) =>
  apiFetch<InviteEntry[]>(`/api/workspaces/${workspaceId}/invites${wsQuery(workspaceId)}`);

export const createInvite = (workspaceId: string) =>
  apiFetch<InviteEntry>(`/api/workspaces/${workspaceId}/invites${wsQuery(workspaceId)}`, { method: "POST" });

export const revokeInvite = (workspaceId: string, inviteId: string) =>
  apiFetch<void>(`/api/workspaces/${workspaceId}/invites/${inviteId}${wsQuery(workspaceId)}`, { method: "DELETE" });

// Invite accept
export interface InviteInfo {
  workspace_name: string; workspace_id: string; invited_by: string;
}

export interface InviteAcceptResult {
  workspace_id: string; workspace_slug: string;
}

export const getInviteInfo = (token: string) => apiFetch<InviteInfo>(`/api/invite/${token}`);
export const acceptInvite = (token: string) => apiFetch<InviteAcceptResult>(`/api/invite/${token}`, { method: "POST" });

// Overview
export interface OverviewEmailAccount {
  id: string;
  agent_id: string;
  email_address: string;
  status: string;
  error_message: string;
  last_synced_at: string | null;
}

export interface OverviewRecentTask {
  id: string;
  agent_id: string;
  type: string;
  status: string;
  prompt: string;
  created_at: string;
  completed_at: string | null;
  error: string | null;
}

export interface OverviewCalendarEvent {
  id: string;
  agent_id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  repeat_interval: string | null;
  repeat_stop_at: string | null;
  last_triggered_at: string | null;
}

export interface OverviewMember {
  id: string;
  user_id: string;
  role: string;
  name: string;
  email: string;
  image: string | null;
  created_at: string;
}

export interface WorkspaceOverview {
  email_stats: { inbound: number; outbound: number; unread: number; rejected: number };
  email_accounts: OverviewEmailAccount[];
  task_stats: { completed: number; failed: number; cancelled: number; queued: number; stale: number };
  recent_tasks: OverviewRecentTask[];
  conversation_counts: Record<string, number>;
  members: OverviewMember[];
  pending_invites: number;
  calendar_events: OverviewCalendarEvent[];
}

export const getWorkspaceOverview = (workspaceId: string) =>
  apiFetch<WorkspaceOverview>(`/api/workspaces/${workspaceId}/overview${wsQuery(workspaceId)}`);

export interface WorkspaceHealthReport {
  status: "ok" | "warning" | "critical";
  generated_at: string;
  checks: {
    machines: { status: "ok" | "warning" | "critical"; total: number; online: number; offline: number };
    runtimes: { status: "ok" | "warning" | "critical"; total: number; providers: string[] };
    queue: { status: "ok" | "warning" | "critical"; queued: number; stale: number; failed_today: number };
    configuration: {
      status: "ok" | "warning" | "critical";
      total_agents: number;
      assigned_agents: number;
      unassigned_agents: number;
      agents_with_missing_runtime: number;
    };
    headroom: {
      status: "ok" | "warning" | "critical";
      enabled_agents: number;
      required_agents: number;
      unavailable_agents: number;
      runtimes_reporting: number;
      runtimes_available: number;
    };
  };
  issues: Array<{
    code: string;
    severity: "warning" | "critical";
    message: string;
    next_actions?: string[];
  }>;
}

export const getWorkspaceHealth = (workspaceId: string) =>
  apiFetch<WorkspaceHealthReport>(`/api/workspaces/${workspaceId}/health${wsQuery(workspaceId)}`);

// Auth
export const signOut = async () => {
  if (typeof window !== "undefined") {
    window.location.href = "/sign-in";
  }
};

export const verifyCode = (email: string, code: string) =>
  apiFetch<LoginResponse>("/api/auth/sign-in/email", {
    method: "POST",
    body: JSON.stringify({ email, otp: code }),
  });
