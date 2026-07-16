"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listIssues, listMemory, listAgentIntegrations } from "@/lib/api";
import {
  EMPTY_AGENT_CONTEXT_PANEL_DATA,
  fetchAgentContextPanelData,
  isContextPanelScopeReady,
  type AgentContextPanelData,
} from "@/lib/agent-context-panel-data";

const DEFAULT_REFRESH_MS = 45_000;

export interface UseAgentContextPanelDataOptions {
  workspaceId: string | null | undefined;
  agentId: string | null | undefined;
  /** Soft poll interval; set 0 to disable. Default 45s. */
  refreshMs?: number;
  enabled?: boolean;
}

export interface UseAgentContextPanelDataResult extends AgentContextPanelData {
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Live feeds for the unified context panel: memory notes, recent issues,
 * and integration count. Always scopes by workspaceId first.
 */
export function useAgentContextPanelData({
  workspaceId,
  agentId,
  refreshMs = DEFAULT_REFRESH_MS,
  enabled = true,
}: UseAgentContextPanelDataOptions): UseAgentContextPanelDataResult {
  const [data, setData] = useState<AgentContextPanelData>(EMPTY_AGENT_CONTEXT_PANEL_DATA);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    // Missing/disabled scope: clear and invalidate any in-flight response so a
    // late resolve from a previous agent/workspace cannot overwrite empty state.
    if (!isContextPanelScopeReady(workspaceId, agentId, enabled)) {
      requestIdRef.current += 1;
      setData(EMPTY_AGENT_CONTEXT_PANEL_DATA);
      setLoading(false);
      setError(null);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);

    try {
      const next = await fetchAgentContextPanelData(
        { workspaceId: workspaceId!, agentId: agentId! },
        { listMemory, listIssues, listAgentIntegrations },
      );
      if (requestId !== requestIdRef.current) return;
      setData(next);
      setError(null);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to load context");
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [workspaceId, agentId, enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isContextPanelScopeReady(workspaceId, agentId, enabled) || !refreshMs || refreshMs <= 0) {
      return;
    }
    const id = window.setInterval(() => {
      void refresh();
    }, refreshMs);
    return () => window.clearInterval(id);
  }, [enabled, workspaceId, agentId, refreshMs, refresh]);

  return {
    ...data,
    loading,
    error,
    refresh,
  };
}
