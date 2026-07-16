/**
 * Pure helpers for the unified context panel live-data wiring (E3).
 * Workspace scope always comes first — callers must pass workspaceId before agent filters.
 */

import type {
  ContextIssueItem,
  ContextMemoryNote,
} from "@/components/agent-context-panel";

export const CONTEXT_PANEL_MEMORY_LIMIT = 12;
export const CONTEXT_PANEL_ISSUE_LIMIT = 8;

export interface ContextPanelScope {
  workspaceId: string;
  agentId?: string | null;
}

export interface ContextPanelMemorySource {
  id: string;
  kind?: string | null;
  content: string;
}

export interface ContextPanelIssueSource {
  id: string;
  title: string;
  status?: string | null;
}

export interface ContextPanelIntegrationSource {
  id: string;
  status?: string | null;
}

export interface AgentContextPanelData {
  memoryNotes: ContextMemoryNote[];
  recentIssues: ContextIssueItem[];
  integrationsCount: number;
}

/** Require workspaceId before any agent-scoped filter is applied. */
export function requireWorkspaceScope(scope: ContextPanelScope): string {
  const workspaceId = scope.workspaceId?.trim();
  if (!workspaceId) {
    throw new Error("workspaceId is required before loading context panel data");
  }
  return workspaceId;
}

/**
 * Whether the live panel should issue network loads.
 * Both workspaceId and agentId must be present (workspace first).
 */
export function isContextPanelScopeReady(
  workspaceId: string | null | undefined,
  agentId: string | null | undefined,
  enabled = true,
): boolean {
  return Boolean(enabled && workspaceId?.trim() && agentId?.trim());
}

/**
 * Build listMemory options with workspace-first semantics.
 * `workspaceId` is validated here; callers pass it to the API as the primary arg.
 */
export function buildMemoryListOpts(scope: ContextPanelScope): {
  workspaceId: string;
  opts: { agentId?: string; limit: number };
} {
  const workspaceId = requireWorkspaceScope(scope);
  const opts: { agentId?: string; limit: number } = {
    limit: CONTEXT_PANEL_MEMORY_LIMIT,
  };
  const agentId = scope.agentId?.trim();
  if (agentId) opts.agentId = agentId;
  return { workspaceId, opts };
}

/**
 * Build listIssues options with workspace-first semantics.
 * Active (non-terminal) issues only for the recent strip.
 */
export function buildIssueListOpts(scope: ContextPanelScope): {
  workspaceId: string;
  opts: { agentId?: string; terminal: false };
} {
  const workspaceId = requireWorkspaceScope(scope);
  const opts: { agentId?: string; terminal: false } = { terminal: false };
  const agentId = scope.agentId?.trim();
  if (agentId) opts.agentId = agentId;
  return { workspaceId, opts };
}

/** Integrations list is always agent-scoped under a workspace. */
export function buildIntegrationsScope(scope: ContextPanelScope & { agentId: string }): {
  workspaceId: string;
  agentId: string;
} {
  const workspaceId = requireWorkspaceScope(scope);
  const agentId = scope.agentId?.trim();
  if (!agentId) {
    throw new Error("agentId is required for integrations context");
  }
  return { workspaceId, agentId };
}

export function mapMemoryToContextNotes(
  items: ContextPanelMemorySource[],
  limit = CONTEXT_PANEL_MEMORY_LIMIT,
): ContextMemoryNote[] {
  return items.slice(0, limit).map((item) => ({
    id: item.id,
    kind: item.kind ?? null,
    content: item.content,
  }));
}

export function mapIssuesToContextItems(
  items: ContextPanelIssueSource[],
  limit = CONTEXT_PANEL_ISSUE_LIMIT,
): ContextIssueItem[] {
  return items.slice(0, limit).map((item) => ({
    id: item.id,
    title: item.title,
    status: item.status ?? null,
  }));
}

/** Count connected/active integrations; treat missing status as active. */
export function countIntegrations(items: ContextPanelIntegrationSource[]): number {
  return items.filter((item) => {
    const status = (item.status ?? "active").toLowerCase();
    return status !== "revoked" && status !== "disabled" && status !== "deleted";
  }).length;
}

export function assembleAgentContextPanelData(input: {
  memoryItems?: ContextPanelMemorySource[] | null;
  issueItems?: ContextPanelIssueSource[] | null;
  integrations?: ContextPanelIntegrationSource[] | null;
}): AgentContextPanelData {
  return {
    memoryNotes: mapMemoryToContextNotes(input.memoryItems ?? []),
    recentIssues: mapIssuesToContextItems(input.issueItems ?? []),
    integrationsCount: countIntegrations(input.integrations ?? []),
  };
}

export const EMPTY_AGENT_CONTEXT_PANEL_DATA: AgentContextPanelData = {
  memoryNotes: [],
  recentIssues: [],
  integrationsCount: 0,
};

export interface ContextPanelFetchDeps {
  listMemory: (
    workspaceId: string,
    opts?: { agentId?: string; kind?: string; limit?: number },
  ) => Promise<{ items: ContextPanelMemorySource[] }>;
  listIssues: (
    workspaceId: string,
    opts?: { agentId?: string; status?: string; terminal?: boolean },
  ) => Promise<ContextPanelIssueSource[]>;
  listAgentIntegrations: (
    agentId: string,
    workspaceId: string,
  ) => Promise<{ integrations: ContextPanelIntegrationSource[] }>;
}

/**
 * Workspace-scoped live fetch for the context panel.
 * workspaceId is always the primary argument to listMemory/listIssues.
 */
export async function fetchAgentContextPanelData(
  scope: { workspaceId: string; agentId: string },
  deps: ContextPanelFetchDeps,
): Promise<AgentContextPanelData> {
  const memoryScope = buildMemoryListOpts(scope);
  const issueScope = buildIssueListOpts(scope);
  const integrationScope = buildIntegrationsScope(scope);

  const [memoryRes, issueRes, integrationRes] = await Promise.all([
    deps.listMemory(memoryScope.workspaceId, memoryScope.opts),
    deps.listIssues(issueScope.workspaceId, issueScope.opts),
    deps.listAgentIntegrations(integrationScope.agentId, integrationScope.workspaceId),
  ]);

  return assembleAgentContextPanelData({
    memoryItems: memoryRes.items,
    issueItems: issueRes,
    integrations: integrationRes.integrations,
  });
}
