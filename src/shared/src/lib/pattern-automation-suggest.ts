/**
 * Pure detector: after N similar completed tasks, suggest promoting a pattern → automation.
 * Deterministic, no I/O, no LLM.
 */

export type PatternTaskInput = {
  id: string;
  agentId: string;
  prompt: string;
  type?: string | null;
  completedAt?: string | null;
};

export type AutomationPatternSuggestion = {
  /** Stable grouping key for the pattern (normalized prompt fingerprint). */
  patternKey: string;
  agentId: string;
  count: number;
  samplePrompt: string;
  suggestedTitle: string;
  suggestedSopMarkdown: string;
  /** Default schedule hint for create-automation form. */
  suggestedSchedule: string;
  taskIds: string[];
  latestCompletedAt: string | null;
};

export type DetectAutomationPatternsOptions = {
  /** Minimum similar completed tasks to emit a suggestion (default: 3). */
  minCount?: number;
  /** Existing automation titles (workspace) — matching patterns are suppressed. */
  existingAutomationTitles?: string[];
  /** Task types to ignore (e.g. already-automated runs). */
  excludeTypes?: string[];
  /** Max suggestions to return after ranking (default: 20). */
  limit?: number;
};

export const DEFAULT_PATTERN_MIN_COUNT = 3;
export const DEFAULT_SUGGESTED_SCHEDULE = "daily";

const MAX_TITLE = 72;
const MAX_KEY = 160;

/**
 * Normalize a task prompt into a fingerprint used to group "similar" work.
 * Strips volatile tokens (dates, numbers, URLs, extra punctuation) so near-duplicates merge.
 */
export function normalizeTaskPatternKey(prompt: string): string {
  let s = (prompt ?? "").toLowerCase();
  s = s.replace(/https?:\/\/\S+/g, " ");
  s = s.replace(/\b\d{4}-\d{2}-\d{2}(?:[t\s]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?z?)?\b/gi, " ");
  s = s.replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, " ");
  s = s.replace(/\b\d+(?:\.\d+)?\b/g, "#");
  s = s.replace(/[^a-z0-9#\s]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  if (!s) return "";
  return s.slice(0, MAX_KEY).trim();
}

function firstNonEmpty(...values: Array<string | null | undefined>): string {
  for (const v of values) {
    if (typeof v === "string") {
      const t = v.replace(/\s+/g, " ").trim();
      if (t) return t;
    }
  }
  return "";
}

function titleFromPrompt(prompt: string): string {
  const cleaned = firstNonEmpty(prompt)
    .replace(/\s+/g, " ")
    .replace(/[.!?\s]+$/g, "");
  if (!cleaned) return "Recurring task";
  if (cleaned.length <= MAX_TITLE) return cleaned;
  return `${cleaned.slice(0, MAX_TITLE - 1).trimEnd()}…`;
}

function normalizeTitleKey(title: string): string {
  return normalizeTaskPatternKey(title);
}

function isExcludedType(type: string | null | undefined, excludeTypes: Set<string>): boolean {
  if (!type) return false;
  return excludeTypes.has(type);
}

/**
 * Detect automation suggestions from completed task history.
 *
 * Rules:
 * - Groups by (agentId, normalized pattern key)
 * - Emits when group size >= minCount (default 3)
 * - Skips empty prompts / excluded types
 * - Suppresses patterns whose suggested title key matches an existing automation title
 * - Ranks by count desc, then latestCompletedAt desc, then patternKey
 */
export function detectAutomationPatterns(
  tasks: PatternTaskInput[],
  options: DetectAutomationPatternsOptions = {},
): AutomationPatternSuggestion[] {
  const minCount = options.minCount ?? DEFAULT_PATTERN_MIN_COUNT;
  const limit = options.limit ?? 20;
  const excludeTypes = new Set(
    (options.excludeTypes ?? ["automation_event", "kill_task"]).map((t) => t.trim()).filter(Boolean),
  );
  const existingTitleKeys = new Set(
    (options.existingAutomationTitles ?? [])
      .map((t) => normalizeTitleKey(t))
      .filter(Boolean),
  );

  type Bucket = {
    patternKey: string;
    agentId: string;
    taskIds: string[];
    samplePrompt: string;
    latestCompletedAt: string | null;
  };

  const buckets = new Map<string, Bucket>();

  for (const task of tasks) {
    if (!task?.id || !task.agentId) continue;
    if (isExcludedType(task.type, excludeTypes)) continue;
    const prompt = firstNonEmpty(task.prompt);
    if (!prompt) continue;
    const patternKey = normalizeTaskPatternKey(prompt);
    if (!patternKey) continue;

    const mapKey = `${task.agentId}\0${patternKey}`;
    const existing = buckets.get(mapKey);
    if (!existing) {
      buckets.set(mapKey, {
        patternKey,
        agentId: task.agentId,
        taskIds: [task.id],
        samplePrompt: prompt,
        latestCompletedAt: task.completedAt ?? null,
      });
      continue;
    }

    existing.taskIds.push(task.id);
    // Prefer the most recent prompt wording as the sample.
    const prevAt = existing.latestCompletedAt ?? "";
    const nextAt = task.completedAt ?? "";
    if (nextAt >= prevAt) {
      existing.latestCompletedAt = task.completedAt ?? existing.latestCompletedAt;
      existing.samplePrompt = prompt;
    }
  }

  const suggestions: AutomationPatternSuggestion[] = [];

  for (const bucket of buckets.values()) {
    if (bucket.taskIds.length < minCount) continue;

    const suggestedTitle = titleFromPrompt(bucket.samplePrompt);
    const titleKey = normalizeTitleKey(suggestedTitle);
    if (titleKey && existingTitleKeys.has(titleKey)) continue;
    // Also suppress when an existing automation title fingerprints to the same pattern.
    if (existingTitleKeys.has(bucket.patternKey)) continue;

    suggestions.push({
      patternKey: bucket.patternKey,
      agentId: bucket.agentId,
      count: bucket.taskIds.length,
      samplePrompt: bucket.samplePrompt,
      suggestedTitle,
      suggestedSopMarkdown: bucket.samplePrompt,
      suggestedSchedule: DEFAULT_SUGGESTED_SCHEDULE,
      taskIds: bucket.taskIds.slice(0, 50),
      latestCompletedAt: bucket.latestCompletedAt,
    });
  }

  suggestions.sort((a, b) => {
    if (a.count !== b.count) return b.count - a.count;
    const atA = a.latestCompletedAt ?? "";
    const atB = b.latestCompletedAt ?? "";
    if (atA !== atB) return atB < atA ? -1 : atB > atA ? 1 : 0;
    if (a.patternKey !== b.patternKey) return a.patternKey < b.patternKey ? -1 : 1;
    return a.agentId < b.agentId ? -1 : a.agentId > b.agentId ? 1 : 0;
  });

  return suggestions.slice(0, Math.max(0, limit));
}
