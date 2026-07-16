import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { shouldRenderAssistantBody, AgentRow, HumanRow } from "./message-list";
import {
  TIMELINE_EVENT_CLASS,
  TIMELINE_BODY_CLASS,
  TIMELINE_BODY_QUIET_CLASS,
} from "@/components/chat-primitives";

// AC4 regression guard: a send-dm reply that is ALSO the message carrying the
// live error stream must still render its own text bubble (error is additive),
// while a runtime-error message stays surfaced by the stream alone when live.
describe("shouldRenderAssistantBody", () => {
  it("renders a normal text reply that carries the error stream (the AC4 fix)", () => {
    // designated last send-dm message + an error stream attached
    expect(
      shouldRenderAssistantBody({ hasTaskStream: true, isRuntimeError: false }),
    ).toBe(true);
  });

  it("renders a normal text reply with no stream (unchanged clean case)", () => {
    expect(
      shouldRenderAssistantBody({ hasTaskStream: false, isRuntimeError: false }),
    ).toBe(true);
  });

  it("suppresses a runtime-error message's own block while the stream owns it", () => {
    // The stream surfaces the error; rendering the block too would double it.
    expect(
      shouldRenderAssistantBody({ hasTaskStream: true, isRuntimeError: true }),
    ).toBe(false);
  });

  it("renders a runtime-error message's block when no stream owns it", () => {
    expect(
      shouldRenderAssistantBody({ hasTaskStream: false, isRuntimeError: true }),
    ).toBe(true);
  });
});

describe("AgentRow / HumanRow shared timeline chrome (B4)", () => {
  it("AgentRow and HumanRow both render left-stream MessageCluster chrome", () => {
    const agent = renderToStaticMarkup(
      createElement(
        AgentRow,
        {
          groupPosition: "solo",
          agentName: "Ada",
          config: null,
        },
        createElement("span", null, "ai body"),
      ),
    );
    const human = renderToStaticMarkup(
      createElement(
        HumanRow,
        {
          groupPosition: "solo",
        },
        createElement("span", null, "human body"),
      ),
    );

    for (const markup of [agent, human]) {
      expect(markup).toContain('data-timeline-chrome="true"');
      expect(markup).toContain("timeline-event");
      expect(markup).toContain("justify-start");
      // Chatbot anti-patterns must not reappear on either side.
      expect(markup).not.toContain("justify-end");
      expect(markup).not.toContain("ml-auto");
      expect(markup).not.toContain("bg-primary");
    }

    expect(agent).toContain('data-timeline-actor="ai"');
    expect(agent).toContain("Ada");
    expect(agent).toContain("ai body");

    expect(human).toContain('data-timeline-actor="human"');
    expect(human).toContain("human body");
    // Human name label (Khmer "អ្នក") is present on cluster head.
    expect(human).toContain("អ្នក");
  });

  it("forceSpacer collapses cluster head for both human and ai", () => {
    const agent = renderToStaticMarkup(
      createElement(
        AgentRow,
        {
          groupPosition: "solo",
          agentName: "Ada",
          config: null,
          forceSpacer: true,
        },
        createElement("span", null, "body"),
      ),
    );
    const human = renderToStaticMarkup(
      createElement(
        HumanRow,
        {
          groupPosition: "solo",
          forceSpacer: true,
        },
        createElement("span", null, "body"),
      ),
    );

    // forceSpacer → middle: no name header
    expect(agent).not.toContain("Ada");
    expect(human).not.toContain("អ្នក");
    // Still shared chrome.
    expect(agent).toContain('data-timeline-actor="ai"');
    expect(human).toContain('data-timeline-actor="human"');
    expect(agent).toContain("timeline-event");
    expect(human).toContain("timeline-event");
  });

  it("exports the same event class token used by system lifecycle rows", () => {
    // System lifecycle notes in message-list use TIMELINE_EVENT_CLASS + quiet body
    // directly; human/AI rows get the same event class via MessageCluster.
    expect(TIMELINE_EVENT_CLASS).toContain("timeline-event");
    expect(TIMELINE_EVENT_CLASS).toContain("justify-start");
    expect(TIMELINE_BODY_CLASS).toContain("timeline-body");
    expect(TIMELINE_BODY_QUIET_CLASS).toContain("timeline-body-quiet");
    // Body tokens stay flat (no role-colored fills).
    expect(TIMELINE_BODY_CLASS).not.toContain("bg-primary");
    expect(TIMELINE_BODY_CLASS).not.toMatch(/\bbg-muted\b/);
  });
});
