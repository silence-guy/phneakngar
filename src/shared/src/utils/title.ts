/**
 * Grapheme-cluster-aware text truncation utilities.
 *
 * Khmer (and other complex scripts) compose a single visible character from a
 * base plus combining marks (subscript COENG consonants, dependent vowel signs)
 * that span multiple UTF-16 code units. Cutting with `slice`/`substr` on a code
 * unit boundary can orphan a combining mark, producing a broken "dotted circle"
 * glyph. Khmer also has no spaces between words, so word-boundary trimming via
 * `lastIndexOf(" ")` is a no-op. These helpers cut on grapheme-cluster
 * boundaries instead.
 */

// Cache the segmenter — constructing one per call is measurably expensive.
const graphemeSegmenter: Intl.Segmenter | null =
  typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

/**
 * Split text into grapheme clusters. Falls back to code points (Array.from)
 * when Intl.Segmenter is unavailable — still far safer than UTF-16 code units.
 */
export function toGraphemes(text: string): string[] {
  if (graphemeSegmenter) {
    return Array.from(graphemeSegmenter.segment(text), (s) => s.segment);
  }
  return Array.from(text);
}

/**
 * Take at most `maxGraphemes` grapheme clusters from the start of `text`,
 * without splitting a cluster. Returns the original string when it is already
 * short enough.
 */
export function sliceGraphemes(text: string, maxGraphemes: number): string {
  if (maxGraphemes <= 0) return "";
  const graphemes = toGraphemes(text);
  if (graphemes.length <= maxGraphemes) return text;
  return graphemes.slice(0, maxGraphemes).join("");
}

/**
 * Truncate to at most `maxGraphemes` clusters, appending `ellipsis` when the
 * text was actually shortened. The ellipsis is NOT counted toward the limit
 * (matching the previous behaviour of `truncateTitle`).
 */
export function truncateGraphemes(
  text: string,
  maxGraphemes: number,
  ellipsis = "…",
): string {
  const graphemes = toGraphemes(text);
  if (graphemes.length <= maxGraphemes) return text;
  return graphemes.slice(0, maxGraphemes).join("") + ellipsis;
}

/**
 * Derive a conversation title from the first message body: collapse whitespace,
 * trim, and cap length at a word boundary when possible — without splitting a
 * grapheme cluster (safe for Khmer and other combining-mark scripts).
 *
 * Lifted from the user-send route so the agent-DM route can reuse the exact
 * same auto-title behaviour (both set a conversation's title on first message).
 */
export function truncateTitle(text: string, maxLen = 50): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  const graphemes = toGraphemes(trimmed);
  if (graphemes.length <= maxLen) return trimmed;

  const cut = graphemes.slice(0, maxLen).join("");
  // Prefer a word boundary when one exists late enough in the cut. For
  // space-less scripts (e.g. Khmer) there is no space, so we keep the
  // grapheme-safe hard cut rather than splitting a cluster.
  const lastSpace = cut.lastIndexOf(" ");
  const title = lastSpace > 20 ? cut.slice(0, lastSpace) : cut;
  return title + "...";
}
