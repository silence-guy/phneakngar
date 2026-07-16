import type { DecideApprovalRequestInput } from "@phneakngar/shared";
import { apiFetch, wsQuery } from "./client";

export interface ApprovalItem {
  id: string;
  workspace_id: string;
  agent_id: string | null;
  kind: string;
  status: string;
  title: string;
  summary: string;
  payload: unknown;
  decided_by_user_id: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

export const listApprovals = (
  workspaceId: string,
  opts?: { status?: string; agentId?: string; limit?: number }
) => {
  const extra: Record<string, string> = {};
  if (opts?.status) extra.status = opts.status;
  if (opts?.agentId) extra.agent_id = opts.agentId;
  if (opts?.limit !== undefined) extra.limit = String(opts.limit);
  return apiFetch<{ items: ApprovalItem[] }>(`/api/approvals${wsQuery(workspaceId, extra)}`);
};

export const decideApproval = (
  workspaceId: string,
  id: string,
  body: DecideApprovalRequestInput
) =>
  apiFetch<{ approval: ApprovalItem }>(`/api/approvals/${id}/decide${wsQuery(workspaceId)}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
