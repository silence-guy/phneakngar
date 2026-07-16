/**
 * Deterministic skill proposal stub from successful task metadata (no LLM, no I/O).
 * Human approval / install happens elsewhere.
 */

export type TaskSuccessMetadata = {
  /** Trace / task id used as source_trace_id. */
  taskId?: string | null;
  /** Alternate explicit trace id. */
  traceId?: string | null;
  title?: string | null;
  summary?: string | null;
  description?: string | null;
  /** Optional tool / skill hints used during the successful run. */
  toolsUsed?: string[] | null;
  tags?: string[] | null;
};

export type SkillProposal = {
  name: string;
  description: string;
  source_trace_id: string;
};

const MAX_NAME = 64;
const MAX_DESCRIPTION = 280;

function slugifyName(raw: string): string {
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_NAME)
    .replace(/-+$/g, "");
  return slug || "untitled-skill";
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

/**
 * Propose a skill install candidate from successful task metadata.
 * Returns null when there is no usable title/summary and no source trace id.
 */
export function proposeSkillFromSuccess(
  meta: TaskSuccessMetadata,
): SkillProposal | null {
  const source_trace_id = firstNonEmpty(meta.traceId, meta.taskId);
  const title = firstNonEmpty(meta.title);
  const body = firstNonEmpty(meta.summary, meta.description, title);

  if (!source_trace_id || (!title && !body)) return null;

  const name = slugifyName(title || body);
  const tools =
    meta.toolsUsed
      ?.map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 6) ?? [];
  const tags =
    meta.tags
      ?.map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 6) ?? [];

  let description = body || title;
  if (tools.length > 0) {
    description = `${description} (tools: ${tools.join(", ")})`;
  } else if (tags.length > 0) {
    description = `${description} (tags: ${tags.join(", ")})`;
  }
  if (description.length > MAX_DESCRIPTION) {
    description = `${description.slice(0, MAX_DESCRIPTION - 1).trimEnd()}…`;
  }

  return { name, description, source_trace_id };
}
