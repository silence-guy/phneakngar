/**
 * Judgment policy: when a DM request is ambiguous (no clear owner/outcome),
 * optionally create an owned issue instead of freeform chat only.
 *
 * Pure helpers only — no I/O. Callers (chhlat prompt, agent settings UI, issue
 * create path) decide whether to persist or instruct the agent.
 */

export type JudgmentPolicySettings = {
  /** When true, ambiguous DMs should become owned issues rather than chat-only thrash. */
  ambiguousToIssue: boolean;
};

export const DEFAULT_JUDGMENT_POLICY: JudgmentPolicySettings = {
  ambiguousToIssue: false,
};

export type AmbiguousIssueDraft = {
  agent_id: string;
  title: string;
  description: string;
};

export type AmbiguousJudgmentResult =
  | {
      action: "create_issue";
      issue: AmbiguousIssueDraft;
      reason: string;
    }
  | {
      action: "continue";
      reason: string;
    };

const MAX_TITLE = 200;
const MAX_DESCRIPTION = 20_000;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstLine(text: string): string {
  return text.split(/\r?\n/)[0]?.trim() ?? "";
}

function clamp(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Read judgment settings from agent `runtime_config.judgment`.
 * Missing / invalid config defaults to policy off (opt-in).
 */
export function readJudgmentPolicy(runtimeConfig: unknown): JudgmentPolicySettings {
  const config = asRecord(runtimeConfig);
  const judgment = asRecord(config?.judgment);
  return {
    ambiguousToIssue: judgment?.ambiguousToIssue === true || judgment?.ambiguous_to_issue === true,
  };
}

/**
 * Merge judgment settings into a runtime_config object (no other keys dropped).
 * When disabled, removes the `judgment` key for a clean config (mirrors headroom).
 */
export function applyJudgmentPolicyToRuntimeConfig(
  baseRuntimeConfig: unknown,
  settings: JudgmentPolicySettings,
): Record<string, unknown> {
  const base = asRecord(baseRuntimeConfig) ?? {};
  const next: Record<string, unknown> = { ...base };

  if (settings.ambiguousToIssue) {
    const existing = asRecord(base.judgment) ?? {};
    next.judgment = {
      ...existing,
      ambiguousToIssue: true,
    };
  } else {
    delete next.judgment;
  }

  return next;
}

/** Signals the request already has a concrete deliverable / target. */
const CONCRETE_SIGNAL =
  /\b(create|implement|deploy|refactor|rename|merge|delete|schedule|send|email|file|open pr|pull request|pr\s*#?\d+|issue\s*#?\d+|fix\s+\S+|write\s+\S+|add\s+\S+\s+to)\b/i;

/** Path / code-ish tokens imply a concrete target. */
const PATH_OR_CODE = /`[^`]+`|\b[\w.-]+\.[a-z]{1,5}\b|\/[\w./-]+/i;

/** Classic ambiguity / missing-owner phrasing. */
const AMBIGUOUS_PHRASES =
  /\b(not sure|unclear|ambiguous|someone|anyone|whoever|whoever owns|figure (it|this) out|look into (this|it)|handle this|can you help|help me(?: with this)?|what (should|do) we|what do you think|idk|tbd|maybe|or whatever)\b/i;

const VAGUE_SHORT =
  /^(?:pls|please)?\s*(?:help|fix|check|review|look(?:\s+at)?|handle|do)\s*(?:this|it|please)?[.!?…]*$/i;

/**
 * Heuristic: is this request too vague / ownerless to execute safely as freeform chat?
 * Prefer precision over recall — clear imperatives with objects return false.
 */
export function isAmbiguousRequest(prompt: string): boolean {
  const text = prompt.replace(/\s+/g, " ").trim();
  if (!text) return true;

  const hasConcrete = CONCRETE_SIGNAL.test(text) || PATH_OR_CODE.test(text);
  const hasAmbiguousPhrase = AMBIGUOUS_PHRASES.test(text);
  const endsWithQuestion = /\?\s*$/.test(text);
  const isVagueShort = text.length <= 48 && VAGUE_SHORT.test(text);

  if (hasConcrete && !hasAmbiguousPhrase) return false;
  if (hasAmbiguousPhrase) return true;
  if (isVagueShort) return true;
  if (endsWithQuestion && text.length < 100 && !hasConcrete) return true;
  // Very short with no verb/object signal
  if (text.length < 28 && !hasConcrete) return true;
  return false;
}

/**
 * Build a CreateIssue-compatible draft for an ambiguous DM.
 */
export function buildAmbiguousIssueDraft(input: {
  prompt: string;
  agentId: string;
  senderName?: string | null;
  conversationId?: string | null;
}): AmbiguousIssueDraft {
  // Prefer the original first line for the title, then normalize body whitespace.
  const headline =
    firstLine(input.prompt) || input.prompt.replace(/\s+/g, " ").trim() || "(empty request)";
  const prompt = input.prompt.replace(/\s+/g, " ").trim() || "(empty request)";
  const title = clamp(
    /^clarify:/i.test(headline) ? headline : `Clarify: ${headline}`,
    MAX_TITLE,
  );

  const parts = [
    "Escalated from an ambiguous DM under judgment policy (ambiguous → create issue).",
    input.senderName ? `Requester: ${input.senderName}` : null,
    input.conversationId ? `Conversation: ${input.conversationId}` : null,
    "",
    "Original request:",
    prompt,
    "",
    "Next step: clarify owner, desired outcome, and acceptance criteria before executing.",
  ].filter((p): p is string => p !== null);

  return {
    agent_id: input.agentId,
    title,
    description: clamp(parts.join("\n"), MAX_DESCRIPTION),
  };
}

/**
 * Core policy decision for DMs.
 * - policy off → always continue
 * - policy on + ambiguous → create_issue draft (agent owner = agentId)
 * - policy on + clear → continue
 */
export function resolveAmbiguousDmJudgment(input: {
  policy?: JudgmentPolicySettings | null;
  runtimeConfig?: unknown;
  prompt: string;
  agentId: string;
  senderName?: string | null;
  conversationId?: string | null;
}): AmbiguousJudgmentResult {
  const policy =
    input.policy ??
    (input.runtimeConfig !== undefined
      ? readJudgmentPolicy(input.runtimeConfig)
      : DEFAULT_JUDGMENT_POLICY);

  if (!policy.ambiguousToIssue) {
    return {
      action: "continue",
      reason: "judgment policy ambiguousToIssue is disabled",
    };
  }

  if (!input.agentId.trim()) {
    return {
      action: "continue",
      reason: "missing agent id for issue ownership",
    };
  }

  if (!isAmbiguousRequest(input.prompt)) {
    return {
      action: "continue",
      reason: "request has a clear enough outcome or target",
    };
  }

  return {
    action: "create_issue",
    issue: buildAmbiguousIssueDraft({
      prompt: input.prompt,
      agentId: input.agentId,
      senderName: input.senderName,
      conversationId: input.conversationId,
    }),
    reason: "request is ambiguous; create owned issue instead of freeform chat only",
  };
}

/** Prompt notice for chhlat task JSON when policy is enabled. */
export function buildJudgmentPolicyNotice(settings: JudgmentPolicySettings): string | null {
  if (!settings.ambiguousToIssue) return null;
  return (
    "Judgment policy ENABLED: ambiguous → create issue. " +
    "If the user's request lacks a clear owner, deliverable, or outcome, " +
    "do NOT spin freeform chat. Create an owned issue with " +
    "`phneakngar issue create --title \"…\" --description \"…\"` " +
    "(defaults to you as the agent owner), then `phneakngar sync send-dm` " +
    "to tell the user you filed it and what you need clarified. " +
    "When the request is already clear, execute normally."
  );
}

/**
 * Longer AGENTS.md / context block when policy is enabled.
 * Returns null when disabled so callers can omit the section.
 */
export function buildJudgmentPolicyContextBlock(
  settings: JudgmentPolicySettings,
  cmdPrefix = "phneakngar",
): string | null {
  if (!settings.ambiguousToIssue) return null;
  return `### Judgment policy (ambiguous → issue)
This agent has **ambiguous → create issue** enabled.

When a user DM is vague, missing an owner, or has no clear outcome:
1. Create an owned issue: \`${cmdPrefix} issue create --title "<short clarify title>" --description "<original request + what is unclear>"\`
2. You are the default owner — track it with \`${cmdPrefix} issue update\` / \`${cmdPrefix} issue comment\` as work progresses.
3. Tell the user via \`${cmdPrefix} sync send-dm\` that you filed the issue and what you need from them.
4. Prefer one owned issue over a long freeform chat loop when the ask is ambiguous.

When the request already names a clear deliverable or target, skip issue creation and execute normally.
`;
}
