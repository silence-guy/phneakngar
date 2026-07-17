import { apiFetch, wsQuery } from "./client";

export type ActivityEventItem = {
  id: string;
  workspace_id: string;
  kind: string;
  actor_type: string | null;
  actor_id: string | null;
  subject_type: string | null;
  subject_id: string | null;
  summary: string;
  payload: unknown;
  created_at: string;
};

export async function listActivityEvents(
  workspaceId: string,
  opts?: { limit?: number },
): Promise<{ items: ActivityEventItem[] }> {
  const extra =
    opts?.limit != null && Number.isFinite(opts.limit)
      ? { limit: String(opts.limit) }
      : undefined;
  return apiFetch(`/api/activity${wsQuery(workspaceId, extra)}`);
}
