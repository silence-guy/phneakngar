/**
 * Shared timeline chrome tokens for human / AI / system events.
 *
 * Helio-style parity: one stream, no chatbot bubbles, no bot-as-second-class
 * styling. Actor is exposed via `data-timeline-actor` for tests/a11y only —
 * visual structure classes are intentionally identical across actors.
 */

export type TimelineActor = "human" | "ai" | "system";

/** Structural chrome class shared by every timeline event row. */
export const TIMELINE_EVENT_CLASS =
  "timeline-event flex justify-start items-start gap-2 min-w-0";

/** Shared body surface for human + AI prose (flat — not a colored bubble). */
export const TIMELINE_BODY_CLASS =
  "timeline-body min-w-0 max-w-full text-base text-foreground";

/**
 * Quiet body for system/lifecycle lines. Same chrome family (`timeline-body`),
 * softer type — still part of the stream, not a separate second-class layout.
 */
export const TIMELINE_BODY_QUIET_CLASS =
  "timeline-body timeline-body-quiet min-w-0 max-w-full text-xs text-muted-foreground/70";

/** Author name line above a cluster head. */
export const TIMELINE_NAME_CLASS =
  "text-[0.85rem] font-semibold text-foreground leading-[1.15] pt-0.5 mb-1";

/** Content column next to the avatar gutter. */
export const TIMELINE_CONTENT_CLASS =
  "min-w-0 max-w-[86%] flex flex-col items-start gap-0.5";

/** Avatar gutter width token (matches MessageCluster). */
export const TIMELINE_GUTTER_CLASS = "w-[30px]";

/**
 * Map legacy bubble variants onto timeline actors so callers can migrate
 * without a hard break (`user` → human, `agent` → ai).
 */
export function toTimelineActor(
  variant: TimelineActor | "user" | "agent",
): TimelineActor {
  if (variant === "user") return "human";
  if (variant === "agent") return "ai";
  return variant;
}

/** Shared data attributes for tests: human/AI/system share the chrome marker. */
export function timelineChromeAttrs(actor: TimelineActor): {
  "data-timeline-chrome": "true";
  "data-timeline-actor": TimelineActor;
} {
  return {
    "data-timeline-chrome": "true",
    "data-timeline-actor": actor,
  };
}
