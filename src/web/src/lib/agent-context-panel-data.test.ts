import { describe, expect, it, vi } from "vitest";
import {
  assembleAgentContextPanelData,
  buildIntegrationsScope,
  buildIssueListOpts,
  buildMemoryListOpts,
  countIntegrations,
  fetchAgentContextPanelData,
  isContextPanelScopeReady,
  mapIssuesToContextItems,
  mapMemoryToContextNotes,
  requireWorkspaceScope,
  CONTEXT_PANEL_ISSUE_LIMIT,
  CONTEXT_PANEL_MEMORY_LIMIT,
  EMPTY_AGENT_CONTEXT_PANEL_DATA,
} from "./agent-context-panel-data";

describe("agent-context-panel-data (workspaceId first)", () => {
  it("requireWorkspaceScope rejects empty workspaceId", () => {
    expect(() => requireWorkspaceScope({ workspaceId: "" })).toThrow(/workspaceId/i);
    expect(() => requireWorkspaceScope({ workspaceId: "   " })).toThrow(/workspaceId/i);
  });

  it("requireWorkspaceScope trims and returns workspaceId", () => {
    expect(requireWorkspaceScope({ workspaceId: "  w1  " })).toBe("w1");
  });

  it("isContextPanelScopeReady requires enabled + workspace + agent", () => {
    expect(isContextPanelScopeReady("w1", "a1")).toBe(true);
    expect(isContextPanelScopeReady("  w1  ", " a1 ")).toBe(true);
    expect(isContextPanelScopeReady("", "a1")).toBe(false);
    expect(isContextPanelScopeReady("w1", "")).toBe(false);
    expect(isContextPanelScopeReady(null, "a1")).toBe(false);
    expect(isContextPanelScopeReady("w1", null)).toBe(false);
    expect(isContextPanelScopeReady("w1", "a1", false)).toBe(false);
    expect(isContextPanelScopeReady("   ", "a1")).toBe(false);
  });

  it("buildMemoryListOpts scopes by workspaceId first then optional agentId", () => {
    const withAgent = buildMemoryListOpts({ workspaceId: "w1", agentId: "a1" });
    expect(withAgent.workspaceId).toBe("w1");
    expect(withAgent.opts).toEqual({ agentId: "a1", limit: CONTEXT_PANEL_MEMORY_LIMIT });

    const workspaceOnly = buildMemoryListOpts({ workspaceId: "w1" });
    expect(workspaceOnly.workspaceId).toBe("w1");
    expect(workspaceOnly.opts).toEqual({ limit: CONTEXT_PANEL_MEMORY_LIMIT });
    expect(workspaceOnly.opts).not.toHaveProperty("agentId");
  });

  it("buildMemoryListOpts rejects missing workspace before agent filter", () => {
    expect(() => buildMemoryListOpts({ workspaceId: "", agentId: "a1" })).toThrow(/workspaceId/i);
  });

  it("buildMemoryListOpts trims agentId and ignores blank agentId", () => {
    expect(buildMemoryListOpts({ workspaceId: "w1", agentId: "  a1  " }).opts.agentId).toBe("a1");
    expect(buildMemoryListOpts({ workspaceId: "w1", agentId: "   " }).opts).not.toHaveProperty(
      "agentId",
    );
  });

  it("buildIssueListOpts requests non-terminal issues under workspace", () => {
    const scoped = buildIssueListOpts({ workspaceId: "w1", agentId: "a9" });
    expect(scoped.workspaceId).toBe("w1");
    expect(scoped.opts).toEqual({ agentId: "a9", terminal: false });
  });

  it("buildIssueListOpts omits agentId when not provided", () => {
    const scoped = buildIssueListOpts({ workspaceId: "w1" });
    expect(scoped.workspaceId).toBe("w1");
    expect(scoped.opts).toEqual({ terminal: false });
    expect(scoped.opts).not.toHaveProperty("agentId");
  });

  it("buildIntegrationsScope requires both workspaceId and agentId", () => {
    expect(buildIntegrationsScope({ workspaceId: "w1", agentId: "a1" })).toEqual({
      workspaceId: "w1",
      agentId: "a1",
    });
    expect(() => buildIntegrationsScope({ workspaceId: "w1", agentId: "" })).toThrow(/agentId/i);
    expect(() => buildIntegrationsScope({ workspaceId: "", agentId: "a1" })).toThrow(/workspaceId/i);
  });
});

describe("context panel mappers", () => {
  it("maps memory notes and caps at limit", () => {
    const notes = mapMemoryToContextNotes(
      [
        { id: "m1", kind: "preference", content: "prefers brief" },
        { id: "m2", content: "second" },
      ],
      1,
    );
    expect(notes).toEqual([{ id: "m1", kind: "preference", content: "prefers brief" }]);
  });

  it("normalizes missing memory kind to null", () => {
    expect(mapMemoryToContextNotes([{ id: "m1", content: "x" }])).toEqual([
      { id: "m1", kind: null, content: "x" },
    ]);
  });

  it("maps issues and caps at limit", () => {
    const items = mapIssuesToContextItems(
      [
        { id: "i1", title: "Ship notes", status: "todo" },
        { id: "i2", title: "Other", status: "in_progress" },
      ],
      1,
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({ id: "i1", title: "Ship notes", status: "todo" });
    expect(CONTEXT_PANEL_ISSUE_LIMIT).toBeGreaterThan(0);
  });

  it("normalizes missing issue status to null", () => {
    expect(mapIssuesToContextItems([{ id: "i1", title: "T" }])).toEqual([
      { id: "i1", title: "T", status: null },
    ]);
  });

  it("countIntegrations ignores revoked/disabled/deleted (case-insensitive)", () => {
    expect(
      countIntegrations([
        { id: "1", status: "active" },
        { id: "2", status: "revoked" },
        { id: "3" },
        { id: "4", status: "disabled" },
        { id: "5", status: "DELETED" },
        { id: "6", status: "Revoked" },
      ]),
    ).toBe(2);
  });

  it("assembleAgentContextPanelData composes empty-safe props", () => {
    expect(assembleAgentContextPanelData({})).toEqual(EMPTY_AGENT_CONTEXT_PANEL_DATA);

    const data = assembleAgentContextPanelData({
      memoryItems: [{ id: "m1", content: "hello", kind: "fact" }],
      issueItems: [{ id: "i1", title: "T", status: "todo" }],
      integrations: [{ id: "g1", status: "active" }],
    });
    expect(data.memoryNotes[0]?.content).toBe("hello");
    expect(data.recentIssues[0]?.title).toBe("T");
    expect(data.integrationsCount).toBe(1);
  });

  it("assembleAgentContextPanelData applies default slice limits", () => {
    const memoryItems = Array.from({ length: CONTEXT_PANEL_MEMORY_LIMIT + 3 }, (_, i) => ({
      id: `m${i}`,
      content: `n${i}`,
    }));
    const issueItems = Array.from({ length: CONTEXT_PANEL_ISSUE_LIMIT + 2 }, (_, i) => ({
      id: `i${i}`,
      title: `t${i}`,
    }));
    const data = assembleAgentContextPanelData({ memoryItems, issueItems, integrations: [] });
    expect(data.memoryNotes).toHaveLength(CONTEXT_PANEL_MEMORY_LIMIT);
    expect(data.recentIssues).toHaveLength(CONTEXT_PANEL_ISSUE_LIMIT);
  });

  it("fetchAgentContextPanelData queries with workspaceId first", async () => {
    const listMemory = vi.fn().mockResolvedValue({
      items: [{ id: "m1", content: "note", kind: "fact" }],
    });
    const listIssues = vi.fn().mockResolvedValue([{ id: "i1", title: "Ship", status: "todo" }]);
    const listAgentIntegrations = vi.fn().mockResolvedValue({
      integrations: [{ id: "g1", status: "active" }],
    });

    const data = await fetchAgentContextPanelData(
      { workspaceId: "w1", agentId: "a1" },
      { listMemory, listIssues, listAgentIntegrations },
    );

    // Primary arg is always workspaceId for listMemory/listIssues (ownership-first).
    expect(listMemory.mock.calls[0]?.[0]).toBe("w1");
    expect(listMemory).toHaveBeenCalledWith("w1", { agentId: "a1", limit: CONTEXT_PANEL_MEMORY_LIMIT });
    expect(listIssues.mock.calls[0]?.[0]).toBe("w1");
    expect(listIssues).toHaveBeenCalledWith("w1", { agentId: "a1", terminal: false });
    // Agent integrations URL is agent-first; workspace is the second arg (query).
    expect(listAgentIntegrations).toHaveBeenCalledWith("a1", "w1");
    expect(data.memoryNotes).toHaveLength(1);
    expect(data.recentIssues[0]?.title).toBe("Ship");
    expect(data.integrationsCount).toBe(1);
  });

  it("fetchAgentContextPanelData rejects empty workspace before any fetch", async () => {
    const listMemory = vi.fn();
    const listIssues = vi.fn();
    const listAgentIntegrations = vi.fn();

    await expect(
      fetchAgentContextPanelData(
        { workspaceId: "", agentId: "a1" },
        { listMemory, listIssues, listAgentIntegrations },
      ),
    ).rejects.toThrow(/workspaceId/i);

    expect(listMemory).not.toHaveBeenCalled();
    expect(listIssues).not.toHaveBeenCalled();
    expect(listAgentIntegrations).not.toHaveBeenCalled();
  });

  it("fetchAgentContextPanelData propagates dependency failures", async () => {
    const listMemory = vi.fn().mockRejectedValue(new Error("memory down"));
    const listIssues = vi.fn().mockResolvedValue([]);
    const listAgentIntegrations = vi.fn().mockResolvedValue({ integrations: [] });

    await expect(
      fetchAgentContextPanelData(
        { workspaceId: "w1", agentId: "a1" },
        { listMemory, listIssues, listAgentIntegrations },
      ),
    ).rejects.toThrow(/memory down/);
  });

  it("fetchAgentContextPanelData handles empty remote payloads", async () => {
    const data = await fetchAgentContextPanelData(
      { workspaceId: "w1", agentId: "a1" },
      {
        listMemory: vi.fn().mockResolvedValue({ items: [] }),
        listIssues: vi.fn().mockResolvedValue([]),
        listAgentIntegrations: vi.fn().mockResolvedValue({ integrations: [] }),
      },
    );
    expect(data).toEqual(EMPTY_AGENT_CONTEXT_PANEL_DATA);
  });
});
