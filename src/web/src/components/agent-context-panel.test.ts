import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AgentContextPanel } from "./agent-context-panel";

describe("AgentContextPanel", () => {
  it("renders collapsed summary with aggregate count by default", () => {
    const markup = renderToStaticMarkup(
      createElement(AgentContextPanel, {
        memoryNotes: [{ id: "m1", content: "prefers concise updates", kind: "preference" }],
        recentIssues: [{ id: "i1", title: "Ship release notes", status: "todo" }],
        integrationsCount: 2,
      }),
    );

    expect(markup).toContain("បរិបទ");
    expect(markup).toContain("3");
    expect(markup).toContain('aria-label="ពង្រីកបរិបទ"');
    expect(markup).not.toContain("prefers concise updates");
  });

  it("renders progressive sections and placeholders when expanded", () => {
    const markup = renderToStaticMarkup(
      createElement(AgentContextPanel, {
        defaultCollapsed: false,
        memoryNotes: [{ id: "m1", content: "prefers concise updates", kind: "preference" }],
        recentIssues: [],
        integrationsCount: 0,
      }),
    );

    expect(markup).toContain("អង្គចងចាំ");
    expect(markup).toContain("ភារកិច្ចថ្មីៗ");
    expect(markup).toContain("ការតភ្ជាប់");
    expect(markup).toContain("prefers concise updates");
    expect(markup).toContain("preference");
    expect(markup).toContain("មិនទាន់មានភារកិច្ច");
    expect(markup).toContain("មិនទាន់មានការតភ្ជាប់");
    expect(markup).toContain("thin-scrollbar");
  });
});
