import type {
  CompactMemoryRequestInput,
  CreateMemoryRequestInput,
  UpdateMemoryRequestInput,
} from "@phneakngar/shared";
import { apiFetch, wsQuery } from "./client";

export interface MemoryItem {
  id: string;
  workspace_id: string;
  agent_id: string | null;
  kind: string;
  content: string;
  source_task_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompactMemoryResult {
  compacted: boolean;
  reason: "ok" | "below_min_notes" | "empty_summary";
  source_count: number;
  deleted_count: number;
  summary: string | null;
  memory: MemoryItem | null;
}

export const listMemory = (
  workspaceId: string,
  opts?: { agentId?: string; kind?: string; limit?: number }
) => {
  const extra: Record<string, string> = {};
  if (opts?.agentId) extra.agent_id = opts.agentId;
  if (opts?.kind) extra.kind = opts.kind;
  if (opts?.limit !== undefined) extra.limit = String(opts.limit);
  return apiFetch<{ items: MemoryItem[] }>(`/api/memory${wsQuery(workspaceId, extra)}`);
};

export const createMemory = (workspaceId: string, body: CreateMemoryRequestInput) =>
  apiFetch<{ memory: MemoryItem }>(`/api/memory${wsQuery(workspaceId)}`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const updateMemory = (
  workspaceId: string,
  id: string,
  body: UpdateMemoryRequestInput
) =>
  apiFetch<{ memory: MemoryItem }>(`/api/memory/${id}${wsQuery(workspaceId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export const deleteMemory = (workspaceId: string, id: string) =>
  apiFetch<void>(`/api/memory/${id}${wsQuery(workspaceId)}`, { method: "DELETE" });

export const compactMemory = (workspaceId: string, body: CompactMemoryRequestInput = {}) =>
  apiFetch<CompactMemoryResult>(`/api/memory/compact${wsQuery(workspaceId)}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
