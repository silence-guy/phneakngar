import type { Agent } from "@phneakngar/shared";
import { apiFetch, wsQuery } from "./client";

export type GatewayBindingItem = {
  id: string;
  workspace_id: string;
  provider: string;
  external_team_id: string;
  external_account_id: string | null;
  agent_id: string;
  user_id: string;
  status: string;
  dm_policy: string;
  outbound_mode: string;
  outbound_badge: "Live" | "Preview";
  created_at: string;
  updated_at: string;
};

export async function listGatewayBindings(
  workspaceId: string,
): Promise<{ items: GatewayBindingItem[] }> {
  return apiFetch(`/api/gateway/bindings${wsQuery(workspaceId)}`);
}

export async function createGatewayBinding(
  workspaceId: string,
  body: {
    provider: string;
    external_team_id: string;
    external_account_id?: string | null;
    agent_id: string;
    user_id?: string;
    status?: string;
    dm_policy?: string;
    outbound_mode?: string;
  },
): Promise<{ binding: GatewayBindingItem }> {
  return apiFetch(`/api/gateway/bindings${wsQuery(workspaceId)}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateGatewayBinding(
  workspaceId: string,
  id: string,
  body: {
    status?: string;
    dm_policy?: string;
    outbound_mode?: string;
    agent_id?: string;
    user_id?: string;
  },
): Promise<{ binding: GatewayBindingItem }> {
  return apiFetch(`/api/gateway/bindings/${encodeURIComponent(id)}${wsQuery(workspaceId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteGatewayBinding(
  workspaceId: string,
  id: string,
): Promise<{ ok: boolean; id: string }> {
  return apiFetch(`/api/gateway/bindings/${encodeURIComponent(id)}${wsQuery(workspaceId)}`, {
    method: "DELETE",
  });
}

// Re-export Agent for consumers that load agents alongside bindings.
export type { Agent as GatewayAgentOption };
