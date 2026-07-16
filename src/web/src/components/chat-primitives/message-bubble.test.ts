import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { MessageBubble } from "./message-bubble";
import {
  TIMELINE_BODY_CLASS,
  TIMELINE_BODY_QUIET_CLASS,
  toTimelineActor,
} from "./timeline-chrome";

type BubbleVariant = "agent" | "user" | "human" | "ai" | "system";

function renderBubble(variant: BubbleVariant, position?: "first" | "middle" | "last" | "single") {
  return renderToStaticMarkup(
    createElement(
      MessageBubble,
      { variant, position: position ?? "single" },
      "hello",
    ),
  );
}

function getBodyClass(variant: BubbleVariant): string {
  const actor = toTimelineActor(variant);
  return actor === "system" ? TIMELINE_BODY_QUIET_CLASS : TIMELINE_BODY_CLASS;
}

describe("MessageBubble body chrome (B4 shared timeline)", () => {
  it("user and agent share the same flat body class", () => {
    expect(getBodyClass("user")).toBe(getBodyClass("agent"));
    expect(getBodyClass("human")).toBe(getBodyClass("ai"));
  });

  it("renders human and ai with identical flat body class and actor data attrs", () => {
    const human = renderBubble("human");
    const ai = renderBubble("ai");
    const user = renderBubble("user");
    const agent = renderBubble("agent");

    expect(human).toContain('data-timeline-body="human"');
    expect(ai).toContain('data-timeline-body="ai"');
    expect(user).toContain('data-timeline-body="human"');
    expect(agent).toContain('data-timeline-body="ai"');

    // Shared flat body token — not colored bubbles.
    for (const markup of [human, ai, user, agent]) {
      expect(markup).toContain("timeline-body");
      expect(markup).not.toContain("bg-primary");
      expect(markup).not.toContain("text-primary-foreground");
      expect(markup).not.toMatch(/\bbg-muted\b/);
      expect(markup).not.toContain("rounded-2xl");
      expect(markup).not.toContain("justify-end");
      expect(markup).toContain("hello");
    }

    // Class strings for human/ai must match (aside from data-timeline-body).
    const humanClass = human.match(/class="([^"]*)"/)?.[1] ?? "";
    const aiClass = ai.match(/class="([^"]*)"/)?.[1] ?? "";
    expect(humanClass).toBe(aiClass);
    expect(humanClass).toContain("timeline-body");
    expect(humanClass).not.toContain("timeline-body-quiet");
  });

  it("does not use primary-fill chatbot bubble colors for user", () => {
    const markup = renderBubble("user");
    expect(markup).not.toContain("bg-primary");
    expect(markup).not.toContain("text-primary-foreground");
    expect(getBodyClass("user")).not.toContain("bg-primary");
  });

  it("does not use muted-fill second-class colors for agent", () => {
    const markup = renderBubble("agent");
    expect(getBodyClass("agent")).toBe(TIMELINE_BODY_CLASS);
    expect(markup).not.toMatch(/\bbg-muted\b/);
  });

  it("system uses quiet body still in the timeline-body family", () => {
    const markup = renderBubble("system");
    expect(markup).toContain('data-timeline-body="system"');
    expect(markup).toContain("timeline-body");
    expect(markup).toContain("timeline-body-quiet");
    expect(markup).not.toContain("bg-primary");
  });

  it("position prop does not reintroduce asymmetric bubble radii", () => {
    const positions = ["first", "middle", "last", "single"] as const;
    const classes = positions.map((position) => {
      const markup = renderBubble("human", position);
      return markup.match(/class="([^"]*)"/)?.[1] ?? "";
    });
    // All positions share the same class — position is API-compat only.
    expect(new Set(classes).size).toBe(1);
    for (const cls of classes) {
      expect(cls).not.toMatch(/rounded-(tl|tr|bl|br)/);
      expect(cls).not.toContain("rounded-2xl");
    }
  });

  it("legacy user/agent aliases map to human/ai actors", () => {
    expect(toTimelineActor("user")).toBe("human");
    expect(toTimelineActor("agent")).toBe("ai");
  });
});
