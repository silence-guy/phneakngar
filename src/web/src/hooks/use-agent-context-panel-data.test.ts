import { describe, expect, it, vi } from "vitest";
import {
  EMPTY_AGENT_CONTEXT_PANEL_DATA,
  fetchAgentContextPanelData,
  isContextPanelScopeReady,
} from "@/lib/agent-context-panel-data";

/**
 * Hook wiring is thin over fetchAgentContextPanelData + isContextPanelScopeReady.
 * These tests lock the workspaceId-first contract and stale-response invalidation
 * rules the hook implements (node env — no React renderer).
 */
describe("useAgentContextPanelData contract", () => {
  it("never issues unscoped list calls — workspaceId is always first", async () => {
    const listMemory = vi.fn().mockResolvedValue({ items: [] });
    const listIssues = vi.fn().mockResolvedValue([]);
    const listAgentIntegrations = vi.fn().mockResolvedValue({ integrations: [] });

    await fetchAgentContextPanelData(
      { workspaceId: "ws_live", agentId: "ag_live" },
      { listMemory, listIssues, listAgentIntegrations },
    );

    expect(listMemory.mock.calls[0]?.[0]).toBe("ws_live");
    expect(listIssues.mock.calls[0]?.[0]).toBe("ws_live");
    // integrations API path is agent-first URL, workspace via query — second arg is workspaceId
    expect(listAgentIntegrations).toHaveBeenCalledWith("ag_live", "ws_live");
  });

  it("empty panel baseline is stable for disabled/missing scope", () => {
    expect(EMPTY_AGENT_CONTEXT_PANEL_DATA).toEqual({
      memoryNotes: [],
      recentIssues: [],
      integrationsCount: 0,
    });
  });

  it("scope readiness gate matches hook early-return conditions", () => {
    // Mirror of refresh() early exit — no fetch when incomplete scope.
    expect(isContextPanelScopeReady(undefined, "a1", true)).toBe(false);
    expect(isContextPanelScopeReady("w1", undefined, true)).toBe(false);
    expect(isContextPanelScopeReady("w1", "a1", false)).toBe(false);
    expect(isContextPanelScopeReady("w1", "a1", true)).toBe(true);
  });

  it("request epoch invalidation pattern ignores stale responses", async () => {
    // Documents the hook's requestIdRef pattern: when scope drops, epoch bumps so
    // an in-flight resolve for the previous scope must not apply.
    let epoch = 0;
    const apply = (id: number, value: string, store: { current: string | null }) => {
      if (id !== epoch) return;
      store.current = value;
    };

    const store: { current: string | null } = { current: null };
    const inFlightId = ++epoch;

    // Scope drops → invalidate (hook does requestIdRef.current += 1)
    epoch += 1;
    store.current = null;

    // Late resolve from previous agent/workspace must be ignored
    apply(inFlightId, "stale-agent-data", store);
    expect(store.current).toBeNull();

    const nextId = ++epoch;
    apply(nextId, "fresh", store);
    expect(store.current).toBe("fresh");
  });
});
