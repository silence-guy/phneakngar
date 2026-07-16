"use client";

import { AgentContextPanel } from "@/components/agent-context-panel";
import { useAgentContextPanelData } from "@/hooks/use-agent-context-panel-data";
import { cn } from "@/lib/utils";

export interface LiveAgentContextPanelProps {
  workspaceId: string;
  agentId: string;
  className?: string;
  defaultCollapsed?: boolean;
  /** Soft poll interval for live refresh; default handled by hook. */
  refreshMs?: number;
}

/**
 * Live-wired context rail for agent + channel surfaces.
 * Fetches workspace-scoped memory, recent issues, and integration count.
 */
export function LiveAgentContextPanel({
  workspaceId,
  agentId,
  className,
  defaultCollapsed = true,
  refreshMs,
}: LiveAgentContextPanelProps) {
  const { memoryNotes, recentIssues, integrationsCount } = useAgentContextPanelData({
    workspaceId,
    agentId,
    refreshMs,
  });

  return (
    <AgentContextPanel
      className={cn(className)}
      memoryNotes={memoryNotes}
      recentIssues={recentIssues}
      integrationsCount={integrationsCount}
      defaultCollapsed={defaultCollapsed}
    />
  );
}
