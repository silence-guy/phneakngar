import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const useAgentContextPanelData = vi.fn();

vi.mock("@/hooks/use-agent-context-panel-data", () => ({
  useAgentContextPanelData: (args: unknown) => useAgentContextPanelData(args),
}));

import { LiveAgentContextPanel } from "./live-agent-context-panel";

describe("LiveAgentContextPanel", () => {
  it("wires workspaceId + agentId into the live data hook", () => {
    useAgentContextPanelData.mockReturnValue({
      memoryNotes: [],
      recentIssues: [],
      integrationsCount: 0,
      loading: false,
      error: null,
      refresh: async () => {},
    });

    renderToStaticMarkup(
      createElement(LiveAgentContextPanel, {
        workspaceId: "ws_channel",
        agentId: "ag_channel",
        refreshMs: 12_000,
        defaultCollapsed: true,
      }),
    );

    expect(useAgentContextPanelData).toHaveBeenCalledWith({
      workspaceId: "ws_channel",
      agentId: "ag_channel",
      refreshMs: 12_000,
    });
  });

  it("renders live data into the presentational panel when expanded", () => {
    useAgentContextPanelData.mockReturnValue({
      memoryNotes: [{ id: "m1", content: "live memory note", kind: "fact" }],
      recentIssues: [{ id: "i1", title: "Live issue", status: "todo" }],
      integrationsCount: 2,
      loading: false,
      error: null,
      refresh: async () => {},
    });

    const markup = renderToStaticMarkup(
      createElement(LiveAgentContextPanel, {
        workspaceId: "w1",
        agentId: "a1",
        defaultCollapsed: false,
      }),
    );

    expect(markup).toContain("live memory note");
    expect(markup).toContain("Live issue");
    expect(markup).toContain("អង្គចងចាំ");
    expect(markup).toContain("ភារកិច្ចថ្មីៗ");
    expect(markup).toContain("ការតភ្ជាប់");
    // integrationsCount surface
    expect(markup).toMatch(/2/);
    expect(markup).toContain("thin-scrollbar");
  });

  it("shows aggregate count when collapsed (agent + channel rail)", () => {
    useAgentContextPanelData.mockReturnValue({
      memoryNotes: [{ id: "m1", content: "hidden until expand", kind: "fact" }],
      recentIssues: [{ id: "i1", title: "hidden issue", status: "todo" }],
      integrationsCount: 1,
      loading: false,
      error: null,
      refresh: async () => {},
    });

    const markup = renderToStaticMarkup(
      createElement(LiveAgentContextPanel, {
        workspaceId: "w1",
        agentId: "a1",
        defaultCollapsed: true,
      }),
    );

    // 1 memory + 1 issue + 1 integration
    expect(markup).toContain("3");
    expect(markup).not.toContain("hidden until expand");
    expect(markup).toContain("បរិបទ");
  });
});
