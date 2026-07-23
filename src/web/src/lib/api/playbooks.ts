import type {
  CreatePlaybookRequest,
  UpdatePlaybookRequest,
  StartPlaybookRunRequest,
  PlaybookDefinition,
} from "@phneakngar/shared";
import { apiFetch, wsQuery } from "./client";

export interface PlaybookItem {
  id: string;
  workspace_id: string;
  agent_id: string | null;
  title: string;
  description: string;
  definition: PlaybookDefinition;
  version: number;
  status: string;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlaybookRunItem {
  id: string;
  workspace_id: string;
  playbook_id: string;
  playbook_version: number;
  agent_id: string;
  runtime_id: string | null;
  conversation_id: string | null;
  status: string;
  current_step_id: string | null;
  snapshot: PlaybookDefinition;
  input: Record<string, unknown> | null;
  output: Record<string, string> | null;
  started_by_user_id: string | null;
  current_task_id: string | null;
  current_approval_id: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
}

export interface PlaybookStepRunItem {
  id: string;
  run_id: string;
  step_id: string;
  step_kind: string;
  status: string;
  output: string | null;
  task_id: string | null;
  approval_id: string | null;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
}

export const listPlaybooks = (workspaceId: string, opts?: { agentId?: string; status?: string }) => {
  const extra: Record<string, string> = {};
  if (opts?.agentId) extra.agent_id = opts.agentId;
  if (opts?.status) extra.status = opts.status;
  return apiFetch<{ items: PlaybookItem[] }>(`/api/playbooks${wsQuery(workspaceId, extra)}`);
};

export const getPlaybook = (workspaceId: string, id: string) =>
  apiFetch<{ playbook: PlaybookItem }>(`/api/playbooks/${id}${wsQuery(workspaceId)}`);

export const createPlaybook = (workspaceId: string, body: CreatePlaybookRequest) =>
  apiFetch<{ playbook: PlaybookItem }>(`/api/playbooks${wsQuery(workspaceId)}`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const updatePlaybook = (workspaceId: string, id: string, body: UpdatePlaybookRequest) =>
  apiFetch<{ playbook: PlaybookItem }>(`/api/playbooks/${id}${wsQuery(workspaceId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export const deletePlaybook = (workspaceId: string, id: string) =>
  apiFetch<void>(`/api/playbooks/${id}${wsQuery(workspaceId)}`, { method: "DELETE" });

export const publishPlaybook = (workspaceId: string, id: string) =>
  apiFetch<{ playbook: PlaybookItem }>(`/api/playbooks/${id}/publish${wsQuery(workspaceId)}`, {
    method: "POST",
  });

export const listPlaybookRuns = (workspaceId: string, playbookId: string) =>
  apiFetch<{ items: PlaybookRunItem[] }>(
    `/api/playbooks/${playbookId}/runs${wsQuery(workspaceId)}`,
  );

export const startPlaybookRun = (workspaceId: string, playbookId: string, body: StartPlaybookRunRequest) =>
  apiFetch<{ run: PlaybookRunItem }>(`/api/playbooks/${playbookId}/runs${wsQuery(workspaceId)}`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const getPlaybookRun = (workspaceId: string, runId: string) =>
  apiFetch<{ run: PlaybookRunItem; steps: PlaybookStepRunItem[] }>(
    `/api/playbooks/runs/${runId}${wsQuery(workspaceId)}`,
  );

export const cancelPlaybookRun = (workspaceId: string, runId: string) =>
  apiFetch<{ run: PlaybookRunItem }>(`/api/playbooks/runs/${runId}/cancel${wsQuery(workspaceId)}`, {
    method: "POST",
  });

export const answerPlaybookRun = (workspaceId: string, runId: string, answer: string) =>
  apiFetch<{ run: PlaybookRunItem }>(`/api/playbooks/runs/${runId}/answer${wsQuery(workspaceId)}`, {
    method: "POST",
    body: JSON.stringify({ answer }),
  });
