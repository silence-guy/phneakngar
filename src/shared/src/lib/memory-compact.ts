/**
 * Deterministic memory compaction (no LLM).
 * Merges many short notes into a single summary string for durable storage.
 */

import { MemoryKind } from "../constants";

/** Durable kind written by the compaction job (not user-created via MemoryKindSchema). */
export const MEMORY_SUMMARY_KIND = MemoryKind.SUMMARY;

export type CompactableMemoryNote = {
  content: string;
  kind?: string | null;
  /** ISO timestamp; used only for stable ordering. */
  updatedAt?: string | null;
};

export type CompactMemoryOptions = {
  /** Max characters in the returned summary (default: unlimited). */
  maxLength?: number;
  /** Max distinct notes to include after dedupe (default: all). */
  maxNotes?: number;
};

function normalizeContent(content: string): string {
  return content.replace(/\s+/g, " ").trim();
}

function noteKey(note: CompactableMemoryNote): string {
  const kind = (note.kind ?? "fact").trim().toLowerCase() || "fact";
  return `${kind}\0${normalizeContent(note.content)}`;
}

/**
 * Compact many short memory notes into one deterministic summary.
 *
 * Rules:
 * - Trims/collapses whitespace; drops empty notes
 * - Dedupes by (kind, normalized content), keeping the latest updatedAt
 * - Sorts by kind, then updatedAt (asc), then content (asc)
 * - Formats as `• [kind] content` lines
 * - Optionally caps note count and total length (suffixes "…" when truncated)
 */
export function compactMemoryNotes(
  notes: CompactableMemoryNote[],
  options: CompactMemoryOptions = {},
): string {
  const byKey = new Map<string, CompactableMemoryNote>();

  for (const note of notes) {
    const content = normalizeContent(note.content ?? "");
    if (!content) continue;
    const kind = (note.kind ?? "fact").trim() || "fact";
    const key = noteKey({ content, kind });
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, { content, kind, updatedAt: note.updatedAt ?? null });
      continue;
    }
    const prevAt = prev.updatedAt ?? "";
    const nextAt = note.updatedAt ?? "";
    if (nextAt >= prevAt) {
      byKey.set(key, { content, kind, updatedAt: note.updatedAt ?? null });
    }
  }

  let ordered = [...byKey.values()].sort((a, b) => {
    const kindA = (a.kind ?? "fact").toLowerCase();
    const kindB = (b.kind ?? "fact").toLowerCase();
    if (kindA !== kindB) return kindA < kindB ? -1 : 1;
    const atA = a.updatedAt ?? "";
    const atB = b.updatedAt ?? "";
    if (atA !== atB) return atA < atB ? -1 : 1;
    return a.content < b.content ? -1 : a.content > b.content ? 1 : 0;
  });

  if (options.maxNotes !== undefined && options.maxNotes >= 0) {
    ordered = ordered.slice(0, options.maxNotes);
  }

  if (ordered.length === 0) return "";

  const lines = ordered.map((n) => {
    const kind = (n.kind ?? "fact").trim() || "fact";
    return `• [${kind}] ${n.content}`;
  });

  let summary = lines.join("\n");
  const maxLength = options.maxLength;
  if (maxLength !== undefined && maxLength >= 0 && summary.length > maxLength) {
    if (maxLength === 0) return "";
    if (maxLength === 1) return "…";
    summary = `${summary.slice(0, maxLength - 1).trimEnd()}…`;
  }
  return summary;
}
