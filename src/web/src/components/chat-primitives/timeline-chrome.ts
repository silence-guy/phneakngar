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

// ---------------------------------------------------------------------------
// Thin chat system-event helpers (WP17–18)
// No activity_event table — durable chat messages only (role=event / lifecycle).
// ---------------------------------------------------------------------------

export type ChatSystemEventKind =
  | "lifecycle"
  | "email_sent"
  | "email_approved"
  | "email_rejected";

export type EmailSystemEventInput = {
  emailId: string;
  subject: string;
  from: string;
  to: string;
  targetConversationId?: string;
  targetAgentId?: string;
};

export type ChatSystemMessageDraft = {
  /** Deterministic id for createMessageIfAbsent retry safety (optional). */
  idempotencyId?: string;
  role: "event" | "assistant";
  content: string;
  metadata: Record<string, unknown>;
  metadataJson: string;
};

/** Quiet system lines (approve/reject/lifecycle) use assistant + kind stamp. */
export function isQuietSystemNote(input: {
  role: string;
  content: string;
  metadata?: Record<string, unknown> | null;
}): boolean {
  if (input.role !== "assistant") return false;
  const kind = input.metadata?.kind;
  if (kind === "lifecycle" || kind === "email_approved" || kind === "email_rejected") {
    return true;
  }
  // Legacy cancelled rows without metadata.kind
  return (
    input.content === "Task cancelled by you" ||
    input.content === "Task cancelled by user"
  );
}

/**
 * Outbound email *sent* card in the chat stream (role=event → EmailCard).
 * Idempotent message id: `email-sent-event-${emailId}`.
 */
export function buildEmailSentSystemEvent(
  input: EmailSystemEventInput,
): ChatSystemMessageDraft {
  const metadata: Record<string, unknown> = {
    kind: "email_sent" satisfies ChatSystemEventKind,
    emailId: input.emailId,
    subject: input.subject,
    from: input.from,
    to: input.to,
    direction: "outbound",
    ...(input.targetConversationId
      ? {
          targetConversationId: input.targetConversationId,
          targetAgentId: input.targetAgentId,
        }
      : {}),
  };
  return {
    idempotencyId: `email-sent-event-${input.emailId}`,
    role: "event",
    content: `Email sent to ${input.to}: ${input.subject}`,
    metadata,
    metadataJson: JSON.stringify(metadata),
  };
}

/**
 * Approval decide system line for outbound_email (quiet timeline chrome).
 * Idempotent message id: `email-decision-${approvalId}`.
 */
export function buildEmailDecisionSystemEvent(input: {
  decision: "approved" | "rejected";
  approvalId: string;
  emailId: string;
  subject: string;
  to: string;
}): ChatSystemMessageDraft {
  const kind: ChatSystemEventKind =
    input.decision === "approved" ? "email_approved" : "email_rejected";
  const verb = input.decision === "approved" ? "approved" : "rejected";
  const metadata: Record<string, unknown> = {
    kind,
    systemEvent: kind,
    // Also stamp lifecycle so existing quiet-note paths keep working.
    // Prefer kind=email_* for new clients; isQuietSystemNote accepts both.
    emailId: input.emailId,
    subject: input.subject,
    to: input.to,
    approvalId: input.approvalId,
    decision: input.decision,
  };
  return {
    idempotencyId: `email-decision-${input.approvalId}`,
    role: "assistant",
    content: `Outbound email ${verb}: ${input.subject}`,
    metadata,
    metadataJson: JSON.stringify(metadata),
  };
}
