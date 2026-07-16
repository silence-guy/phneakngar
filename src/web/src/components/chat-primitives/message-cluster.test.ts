import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { MessageCluster, AVATAR_SIZE, type ClusterPosition } from "./message-cluster";
import {
  TIMELINE_EVENT_CLASS,
  TIMELINE_CONTENT_CLASS,
  TIMELINE_GUTTER_CLASS,
  TIMELINE_NAME_CLASS,
  timelineChromeAttrs,
  toTimelineActor,
  type TimelineActor,
} from "./timeline-chrome";

// Test the cluster logic: which positions show the avatar header vs spacer,
// and that human/AI/system share the same event chrome classes (B4).

function isClusterHead(position: ClusterPosition): boolean {
  return position === "first" || position === "solo";
}

function renderCluster(
  actor: TimelineActor | "user" | "agent",
  position: ClusterPosition = "solo",
) {
  return renderToStaticMarkup(
    createElement(
      MessageCluster,
      {
        actor,
        avatar: createElement("span", { "data-avatar": "true" }, "A"),
        name: "Ada",
        position,
      },
      createElement("div", { "data-body": "true" }, "body"),
    ),
  );
}

describe("MessageCluster position logic", () => {
  it("'first' position shows avatar and name (cluster head)", () => {
    expect(isClusterHead("first")).toBe(true);
    const markup = renderCluster("ai", "first");
    expect(markup).toContain('data-avatar="true"');
    expect(markup).toContain("Ada");
  });

  it("'solo' position shows avatar and name (cluster head)", () => {
    expect(isClusterHead("solo")).toBe(true);
    const markup = renderCluster("human", "solo");
    expect(markup).toContain('data-avatar="true"');
    expect(markup).toContain("Ada");
  });

  it("'middle' position hides avatar and name", () => {
    expect(isClusterHead("middle")).toBe(false);
    const markup = renderCluster("ai", "middle");
    expect(markup).not.toContain('data-avatar="true"');
    expect(markup).not.toContain("Ada");
    expect(markup).toContain('data-body="true"');
  });

  it("'last' position hides avatar and name", () => {
    expect(isClusterHead("last")).toBe(false);
    const markup = renderCluster("human", "last");
    expect(markup).not.toContain('data-avatar="true"');
    expect(markup).not.toContain("Ada");
  });

  describe("AVATAR_SIZE constant", () => {
    it("exports a 30px avatar size matching the gutter column", () => {
      expect(AVATAR_SIZE).toBe(30);
      expect(TIMELINE_GUTTER_CLASS).toBe("w-[30px]");
    });
  });

  describe("shared timeline chrome (B4)", () => {
    it("event chrome class is used for every actor", () => {
      expect(TIMELINE_EVENT_CLASS).toContain("timeline-event");
      for (const actor of ["human", "ai", "system"] as const) {
        const attrs = timelineChromeAttrs(actor);
        expect(attrs["data-timeline-chrome"]).toBe("true");
        expect(attrs["data-timeline-actor"]).toBe(actor);

        const markup = renderCluster(actor, "solo");
        expect(markup).toContain('data-timeline-chrome="true"');
        expect(markup).toContain(`data-timeline-actor="${actor}"`);
        expect(markup).toContain("timeline-event");
        expect(markup).toContain("justify-start");
        // No right-aligned chatbot row.
        expect(markup).not.toContain("justify-end");
        expect(markup).not.toContain("ml-auto");
      }
    });

    it("human / ai / system share structural event + content classes", () => {
      const human = renderCluster("human");
      const ai = renderCluster("ai");
      const system = renderCluster("system");

      for (const markup of [human, ai, system]) {
        expect(markup).toContain(TIMELINE_EVENT_CLASS.split(" ")[0]!); // timeline-event
        expect(markup).toContain("justify-start");
        // Content column class family
        for (const token of TIMELINE_CONTENT_CLASS.split(" ")) {
          if (token) expect(markup).toContain(token);
        }
        // Name line only on head (solo)
        expect(markup).toContain(TIMELINE_NAME_CLASS.split(" ")[0]!);
      }

      // Strip actor-specific attrs and compare structure equality signal:
      // class attributes on the outer event row must match across actors.
      const outerClass = (markup: string) =>
        markup.match(/class="([^"]*timeline-event[^"]*)"/)?.[1] ?? "";
      expect(outerClass(human)).toBe(outerClass(ai));
      expect(outerClass(ai)).toBe(outerClass(system));
    });

    it("user/agent aliases normalize to human/ai data attrs", () => {
      expect(toTimelineActor("user")).toBe("human");
      expect(toTimelineActor("agent")).toBe("ai");
      expect(renderCluster("user")).toContain('data-timeline-actor="human"');
      expect(renderCluster("agent")).toContain('data-timeline-actor="ai"');
    });
  });
});
