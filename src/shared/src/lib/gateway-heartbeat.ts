/**
 * Heartbeat ambient check helpers (OpenClaw-class contract, pure / no I/O).
 * Quiet-by-default: HEARTBEAT_OK responses should not notify users.
 * Full commercial Helio/OpenClaw parity is still not claimed.
 */

export const HEARTBEAT_AUTOMATION_SKILL = "heartbeat";
export const HEARTBEAT_OK_TOKEN = "HEARTBEAT_OK";
export const DEFAULT_HEARTBEAT_ACK_MAX_CHARS = 300;

export type HeartbeatReplyDisposition =
  | { kind: "ack_suppress"; remainder: string }
  | { kind: "alert"; text: string }
  | { kind: "empty" };

/**
 * Detect heartbeat automation by skill_name / title convention.
 */
export function isHeartbeatAutomation(auto: {
  skillName?: string | null;
  title?: string | null;
}): boolean {
  const skill = (auto.skillName ?? "").trim().toLowerCase();
  if (skill === HEARTBEAT_AUTOMATION_SKILL) return true;
  const title = (auto.title ?? "").trim().toLowerCase();
  return title === "heartbeat" || title.startsWith("heartbeat ");
}

/**
 * Build the default heartbeat user prompt (verbatim body).
 */
export function buildHeartbeatPrompt(checklistMarkdown?: string | null): string {
  const checklist = checklistMarkdown?.trim();
  const body = checklist
    ? `Read HEARTBEAT checklist strictly:\n\n${checklist}\n\n`
    : "";
  return (
    body +
    "If nothing needs attention, reply with only HEARTBEAT_OK. " +
    "Do not rehash old chat tasks. If something needs a human, return only the alert text without HEARTBEAT_OK."
  );
}

/**
 * Classify model reply for quiet delivery (suppress pure OK acks).
 */
export function classifyHeartbeatReply(
  raw: string | null | undefined,
  ackMaxChars: number = DEFAULT_HEARTBEAT_ACK_MAX_CHARS,
): HeartbeatReplyDisposition {
  if (raw == null || !String(raw).trim()) return { kind: "empty" };
  const text = String(raw).trim();
  const token = HEARTBEAT_OK_TOKEN;
  const starts = text.startsWith(token);
  const ends = text.endsWith(token);
  if (!starts && !ends) {
    return { kind: "alert", text };
  }
  let remainder = text;
  if (starts) remainder = remainder.slice(token.length).trim();
  if (ends && remainder.endsWith(token)) {
    remainder = remainder.slice(0, -token.length).trim();
  } else if (ends && text === token) {
    remainder = "";
  }
  // Mid-message HEARTBEAT_OK is not special — only start/end.
  if (remainder.length <= ackMaxChars) {
    return { kind: "ack_suppress", remainder };
  }
  return { kind: "alert", text: remainder };
}

/**
 * Whether a delivery target should notify on this disposition.
 * Quiet-by-default: ack_suppress and empty never notify.
 */
export function shouldNotifyHeartbeat(
  disposition: HeartbeatReplyDisposition,
  target: "none" | "last" | string | null | undefined,
): boolean {
  if (!target || target === "none") return false;
  return disposition.kind === "alert";
}
