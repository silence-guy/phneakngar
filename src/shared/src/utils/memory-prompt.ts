/**
 * Format agent/workspace memory notes for injection into task prompts/context.
 * Durable notes live in D1; this helper only shapes them for the runtime.
 */

export const DEFAULT_AGENT_MEMORY_PROMPT_LIMIT = 12;

export type MemoryPromptItem = {
  kind: string;
  content: string;
};

/**
 * Build a compact, human-readable memory block for agent task prompts.
 * Returns "" when there is nothing useful to inject.
 */
export function formatMemoryForPrompt(
  memories: MemoryPromptItem[],
  opts?: { limit?: number },
): string {
  const limit = opts?.limit ?? DEFAULT_AGENT_MEMORY_PROMPT_LIMIT;
  const items = memories
    .filter((m) => typeof m.content === "string" && m.content.trim().length > 0)
    .slice(0, Math.max(0, limit));
  if (items.length === 0) return "";

  const lines = items.map((m) => {
    const kind = (m.kind || "fact").trim() || "fact";
    return `- [${kind}] ${m.content.trim()}`;
  });
  return ["Agent memory (apply when relevant):", ...lines].join("\n");
}

/**
 * Normalize DB/API memory rows into prompt items (kind + content only).
 */
export function toMemoryPromptItems(
  memories: Array<{ kind?: string | null; content?: string | null }>,
  limit = DEFAULT_AGENT_MEMORY_PROMPT_LIMIT,
): MemoryPromptItem[] {
  return memories
    .filter((m) => typeof m.content === "string" && m.content.trim().length > 0)
    .slice(0, Math.max(0, limit))
    .map((m) => ({
      kind: (m.kind || "fact").trim() || "fact",
      content: m.content!.trim(),
    }));
}
