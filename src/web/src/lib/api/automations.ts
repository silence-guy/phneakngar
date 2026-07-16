import type {
  CreateAutomationRequestInput,
  UpdateAutomationRequestInput,
} from "@phneakngar/shared";
import { apiFetch, wsQuery } from "./client";

export interface AutomationItem {
  id: string;
  workspace_id: string;
  agent_id: string;
  title: string;
  sop_markdown: string;
  schedule: string;
  next_run_at: string;
  delivery_mode: string;
  delivery_channel_id: string | null;
  skill_name: string | null;
  enabled: boolean;
  last_run_at: string | null;
  last_task_id: string | null;
  created_at: string;
  updated_at: string;
}

export const listAutomations = (
  workspaceId: string,
  opts?: { agentId?: string; enabled?: boolean }
) => {
  const extra: Record<string, string> = {};
  if (opts?.agentId) extra.agent_id = opts.agentId;
  if (opts?.enabled !== undefined) extra.enabled = String(opts.enabled);
  return apiFetch<{ items: AutomationItem[] }>(`/api/automations${wsQuery(workspaceId, extra)}`);
};

export const getAutomation = (workspaceId: string, id: string) =>
  apiFetch<{ automation: AutomationItem }>(`/api/automations/${id}${wsQuery(workspaceId)}`);

export const createAutomation = (workspaceId: string, body: CreateAutomationRequestInput) =>
  apiFetch<{ automation: AutomationItem }>(`/api/automations${wsQuery(workspaceId)}`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const updateAutomation = (
  workspaceId: string,
  id: string,
  body: UpdateAutomationRequestInput
) =>
  apiFetch<{ automation: AutomationItem }>(`/api/automations/${id}${wsQuery(workspaceId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export const deleteAutomation = (workspaceId: string, id: string) =>
  apiFetch<void>(`/api/automations/${id}${wsQuery(workspaceId)}`, { method: "DELETE" });

export const runDueAutomations = (workspaceId: string) =>
  apiFetch<{ enqueued: number }>(`/api/automations/due${wsQuery(workspaceId)}`, {
    method: "POST",
  });

export interface AutomationPatternSuggestionItem {
  pattern_key: string;
  agent_id: string;
  count: number;
  sample_prompt: string;
  suggested_title: string;
  suggested_sop_markdown: string;
  suggested_schedule: string;
  task_ids: string[];
  latest_completed_at: string | null;
}

export const listAutomationSuggestions = (
  workspaceId: string,
  opts?: { agentId?: string; minCount?: number; limit?: number },
) => {
  const extra: Record<string, string> = {};
  if (opts?.agentId) extra.agent_id = opts.agentId;
  if (opts?.minCount !== undefined) extra.min_count = String(opts.minCount);
  if (opts?.limit !== undefined) extra.limit = String(opts.limit);
  return apiFetch<{ items: AutomationPatternSuggestionItem[]; min_count: number }>(
    `/api/automations/suggestions${wsQuery(workspaceId, extra)}`,
  );
};
