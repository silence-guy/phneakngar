import { describe, it, expect } from "vitest";
import {
  TIMELINE_EVENT_CLASS,
  TIMELINE_BODY_CLASS,
  TIMELINE_BODY_QUIET_CLASS,
  TIMELINE_NAME_CLASS,
  TIMELINE_CONTENT_CLASS,
  TIMELINE_GUTTER_CLASS,
  toTimelineActor,
  timelineChromeAttrs,
  isQuietSystemNote,
  buildEmailSentSystemEvent,
  buildEmailDecisionSystemEvent,
  type TimelineActor,
} from "./timeline-chrome";

const ACTORS: TimelineActor[] = ["human", "ai", "system"];

/** Chatbot anti-patterns banned by B4 / DESIGN.md */
const CHATBOT_ANTIPATTERNS = [
  "bg-primary",
  "text-primary-foreground",
  "bg-muted",
  "justify-end",
  "ml-auto",
  "rounded-2xl",
  "rounded-3xl",
];

describe("timeline chrome tokens (B4)", () => {
  it("human / ai / system all share the event chrome class marker", () => {
    for (const actor of ACTORS) {
      const attrs = timelineChromeAttrs(actor);
      expect(attrs["data-timeline-chrome"]).toBe("true");
      expect(attrs["data-timeline-actor"]).toBe(actor);
    }
  });

  it("event chrome class is left-stream and identifiable", () => {
    expect(TIMELINE_EVENT_CLASS).toContain("timeline-event");
    expect(TIMELINE_EVENT_CLASS).toContain("justify-start");
    expect(TIMELINE_EVENT_CLASS).toContain("min-w-0");
    for (const bad of CHATBOT_ANTIPATTERNS) {
      expect(TIMELINE_EVENT_CLASS).not.toContain(bad);
    }
  });

  it("human and ai share the same body chrome class (no second-class bot fill)", () => {
    // Both roles use TIMELINE_BODY_CLASS — no bg-primary / bg-muted split.
    expect(TIMELINE_BODY_CLASS).toContain("timeline-body");
    expect(TIMELINE_BODY_CLASS).toContain("text-foreground");
    for (const bad of CHATBOT_ANTIPATTERNS) {
      expect(TIMELINE_BODY_CLASS).not.toContain(bad);
    }
  });

  it("system quiet body still belongs to the timeline-body family", () => {
    expect(TIMELINE_BODY_QUIET_CLASS).toContain("timeline-body");
    expect(TIMELINE_BODY_QUIET_CLASS).toContain("timeline-body-quiet");
    expect(TIMELINE_BODY_QUIET_CLASS).toContain("text-muted-foreground");
    // Quiet body softens type but must not paint a second-class bubble fill.
    expect(TIMELINE_BODY_QUIET_CLASS).not.toContain("bg-primary");
    expect(TIMELINE_BODY_QUIET_CLASS).not.toMatch(/\bbg-muted\b/);
  });

  it("content + gutter + name tokens stay left-aligned and non-bubble", () => {
    expect(TIMELINE_CONTENT_CLASS).toContain("items-start");
    expect(TIMELINE_CONTENT_CLASS).toContain("max-w-[86%]");
    expect(TIMELINE_GUTTER_CLASS).toBe("w-[30px]");
    expect(TIMELINE_NAME_CLASS).toContain("font-semibold");
    for (const token of [TIMELINE_CONTENT_CLASS, TIMELINE_GUTTER_CLASS, TIMELINE_NAME_CLASS]) {
      expect(token).not.toContain("justify-end");
      expect(token).not.toContain("ml-auto");
      expect(token).not.toContain("bg-primary");
    }
  });

  it("maps legacy user/agent variants onto timeline actors", () => {
    expect(toTimelineActor("user")).toBe("human");
    expect(toTimelineActor("agent")).toBe("ai");
    expect(toTimelineActor("human")).toBe("human");
    expect(toTimelineActor("ai")).toBe("ai");
    expect(toTimelineActor("system")).toBe("system");
  });

  it("chrome attrs only differ by data-timeline-actor (structure parity)", () => {
    const byActor = ACTORS.map((actor) => timelineChromeAttrs(actor));
    // Every actor shares the chrome marker — only the actor attribute differs.
    for (const attrs of byActor) {
      expect(attrs["data-timeline-chrome"]).toBe("true");
    }
    expect(new Set(byActor.map((a) => a["data-timeline-actor"]))).toEqual(
      new Set(ACTORS),
    );
  });
});

describe("thin chat system event helpers (WP17–18)", () => {
  it("isQuietSystemNote matches lifecycle + email decision kinds", () => {
    expect(
      isQuietSystemNote({
        role: "assistant",
        content: "x",
        metadata: { kind: "lifecycle" },
      }),
    ).toBe(true);
    expect(
      isQuietSystemNote({
        role: "assistant",
        content: "Outbound email approved: Hi",
        metadata: { kind: "email_approved" },
      }),
    ).toBe(true);
    expect(
      isQuietSystemNote({
        role: "assistant",
        content: "Outbound email rejected: Hi",
        metadata: { kind: "email_rejected" },
      }),
    ).toBe(true);
    expect(
      isQuietSystemNote({
        role: "assistant",
        content: "Task cancelled by you",
        metadata: null,
      }),
    ).toBe(true);
    expect(
      isQuietSystemNote({
        role: "event",
        content: "Email sent to a@b: Hi",
        metadata: { kind: "email_sent" },
      }),
    ).toBe(false);
    expect(
      isQuietSystemNote({
        role: "assistant",
        content: "Hello",
        metadata: {},
      }),
    ).toBe(false);
  });

  it("buildEmailSentSystemEvent is deterministic and role=event for EmailCard", () => {
    const draft = buildEmailSentSystemEvent({
      emailId: "e1",
      subject: "Hello",
      from: "a@x",
      to: "b@y",
    });
    expect(draft.role).toBe("event");
    expect(draft.idempotencyId).toBe("email-sent-event-e1");
    expect(draft.content).toBe("Email sent to b@y: Hello");
    expect(draft.metadata.kind).toBe("email_sent");
    expect(draft.metadata.direction).toBe("outbound");
    expect(draft.metadata.emailId).toBe("e1");
    expect(JSON.parse(draft.metadataJson)).toEqual(draft.metadata);
  });

  it("buildEmailDecisionSystemEvent is deterministic per approval id", () => {
    const approved = buildEmailDecisionSystemEvent({
      decision: "approved",
      approvalId: "ap_1",
      emailId: "e1",
      subject: "Hi",
      to: "b@y",
    });
    const rejected = buildEmailDecisionSystemEvent({
      decision: "rejected",
      approvalId: "ap_1",
      emailId: "e1",
      subject: "Hi",
      to: "b@y",
    });
    expect(approved.role).toBe("assistant");
    expect(approved.idempotencyId).toBe("email-decision-ap_1");
    expect(approved.content).toContain("approved");
    expect(approved.metadata.kind).toBe("email_approved");
    expect(rejected.metadata.kind).toBe("email_rejected");
    expect(rejected.content).toContain("rejected");
    // Same approval id → same idempotency key (retry-safe regardless of decision
    // string used only for content; decide path calls once per terminal decision).
    expect(rejected.idempotencyId).toBe("email-decision-ap_1");
  });
});
