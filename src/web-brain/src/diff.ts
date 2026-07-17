/**
 * Page / markdown diff for change detection (zero deps).
 * Compares cache snapshot vs fresh fetch, or two explicit bodies.
 */

import { webFetch } from "./fetch.js";
import type { CacheEntry, FetchOptions, WebCacheLike, WebError } from "./types.js";
import { toWebError } from "./ssrf.js";

export type DiffHunk = {
  type: "equal" | "add" | "remove";
  lines: string[];
};

export type DiffSummary = {
  changed: boolean;
  oldHash: string;
  newHash: string;
  addedLines: number;
  removedLines: number;
  /** Unified-ish patch (truncated for agent budgets). */
  unified: string;
  hunks: DiffHunk[];
};

export type WebDiffSuccess = {
  ok: true;
  url: string | null;
  summary: DiffSummary;
  old: { title: string; fetchedAt: string | null; fromCache: boolean };
  new: { title: string; fetchedAt: string; fromCache: boolean };
};

export type WebDiffResponse = WebDiffSuccess | WebError;

export type WebDiffOptions = {
  /** URL to re-fetch and compare against cache (or against oldMarkdown). */
  url?: string;
  /** Explicit old body (if not using cache). */
  oldMarkdown?: string;
  oldTitle?: string;
  /** Explicit new body (if not re-fetching). */
  newMarkdown?: string;
  newTitle?: string;
  cache?: WebCacheLike | null;
  fetchOpts?: FetchOptions;
  /** Max unified patch characters (default 12000). */
  maxUnifiedChars?: number;
  /** Max hunks to return (default 40). */
  maxHunks?: number;
};

/** Myers-lite line diff via LCS dynamic programming (fine for page-sized markdown). */
export function diffLines(oldText: string, newText: string): DiffHunk[] {
  const a = oldText.replace(/\r\n/g, "\n").split("\n");
  const b = newText.replace(/\r\n/g, "\n").split("\n");
  const n = a.length;
  const m = b.length;
  // Cap work for huge pages
  if (n * m > 2_000_000) {
    return roughDiff(a, b);
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    Array.from({ length: m + 1 }, () => 0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (a[i] === b[j]) dp[i]![j] = dp[i + 1]![j + 1]! + 1;
      else dp[i]![j] = Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }

  const ops: { t: "eq" | "add" | "del"; line: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ t: "eq", line: a[i]! });
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      ops.push({ t: "del", line: a[i]! });
      i++;
    } else {
      ops.push({ t: "add", line: b[j]! });
      j++;
    }
  }
  while (i < n) {
    ops.push({ t: "del", line: a[i++]! });
  }
  while (j < m) {
    ops.push({ t: "add", line: b[j++]! });
  }

  return coalesceOps(ops);
}

function roughDiff(a: string[], b: string[]): DiffHunk[] {
  // Fallback when LCS would be too large: line-set style summary
  const setA = new Set(a);
  const setB = new Set(b);
  const removed = a.filter((l) => !setB.has(l));
  const added = b.filter((l) => !setA.has(l));
  const hunks: DiffHunk[] = [];
  if (removed.length) hunks.push({ type: "remove", lines: removed });
  if (added.length) hunks.push({ type: "add", lines: added });
  return hunks;
}

function coalesceOps(
  ops: { t: "eq" | "add" | "del"; line: string }[],
): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  for (const op of ops) {
    const type = op.t === "eq" ? "equal" : op.t === "add" ? "add" : "remove";
    const last = hunks[hunks.length - 1];
    if (last && last.type === type) last.lines.push(op.line);
    else hunks.push({ type, lines: [op.line] });
  }
  return hunks;
}

export function summarizeHunks(
  hunks: DiffHunk[],
  oldHash: string,
  newHash: string,
  opts: { maxUnifiedChars?: number; maxHunks?: number } = {},
): DiffSummary {
  const maxUnifiedChars = opts.maxUnifiedChars ?? 12_000;
  const maxHunks = opts.maxHunks ?? 40;

  let addedLines = 0;
  let removedLines = 0;
  for (const h of hunks) {
    if (h.type === "add") addedLines += h.lines.length;
    if (h.type === "remove") removedLines += h.lines.length;
  }

  const changed = oldHash !== newHash;

  const outHunks = hunks
    .filter((h) => h.type !== "equal")
    .slice(0, maxHunks);

  const unifiedParts: string[] = [];
  for (const h of hunks) {
    if (h.type === "equal") {
      // context: keep at most 1 line markers for compactness — skip pure equals in unified
      continue;
    }
    const prefix = h.type === "add" ? "+" : "-";
    for (const line of h.lines) {
      unifiedParts.push(`${prefix}${line}`);
    }
  }
  let unified = unifiedParts.join("\n");
  if (unified.length > maxUnifiedChars) {
    unified =
      unified.slice(0, maxUnifiedChars) + "\n… [unified diff truncated]";
  }

  return {
    changed: changed || addedLines > 0 || removedLines > 0,
    oldHash,
    newHash,
    addedLines,
    removedLines,
    unified,
    hunks: outHunks,
  };
}

/**
 * Diff a URL's cached snapshot against a fresh fetch, or two explicit markdown bodies.
 */
export async function webDiff(opts: WebDiffOptions): Promise<WebDiffResponse> {
  let oldMd = opts.oldMarkdown;
  let oldTitle = opts.oldTitle ?? "";
  let oldFetchedAt: string | null = null;
  let oldFromCache = false;
  let newMd = opts.newMarkdown;
  let newTitle = opts.newTitle ?? "";
  let newFetchedAt = new Date().toISOString();
  let newFromCache = false;
  let url: string | null = opts.url ?? null;

  if (opts.url && oldMd == null) {
    const cached = opts.cache?.get(opts.url) ?? null;
    if (!cached) {
      // Seed cache with current fetch then report "no previous snapshot"
      const first = await webFetch(opts.url, {
        ...opts.fetchOpts,
        cache: opts.cache ?? opts.fetchOpts?.cache,
        forceRefresh: true,
      });
      if (!first.ok) return first;
      return {
        ok: true,
        url: opts.url,
        summary: {
          changed: false,
          oldHash: "",
          newHash: first.contentHash,
          addedLines: 0,
          removedLines: 0,
          unified: "",
          hunks: [],
        },
        old: { title: "", fetchedAt: null, fromCache: false },
        new: {
          title: first.title,
          fetchedAt: first.fetchedAt,
          fromCache: false,
        },
      };
    }
    oldMd = cached.markdown;
    oldTitle = cached.title;
    oldFetchedAt = cached.fetchedAt;
    oldFromCache = true;
    url = cached.url;
  }

  if (opts.url && newMd == null) {
    const fresh = await webFetch(opts.url, {
      ...opts.fetchOpts,
      cache: opts.cache ?? opts.fetchOpts?.cache,
      forceRefresh: true,
    });
    if (!fresh.ok) return fresh;
    newMd = fresh.markdown;
    newTitle = fresh.title;
    newFetchedAt = fresh.fetchedAt;
    newFromCache = false;
    url = fresh.url;
  }

  if (oldMd == null || newMd == null) {
    return toWebError(
      "invalid_url",
      "Provide url (with cache) or both oldMarkdown and newMarkdown",
    );
  }

  const { createHash } = await import("node:crypto");
  const oldHash = createHash("sha256").update(oldMd).digest("hex");
  const newHash = createHash("sha256").update(newMd).digest("hex");

  if (oldHash === newHash) {
    return {
      ok: true,
      url,
      summary: {
        changed: false,
        oldHash,
        newHash,
        addedLines: 0,
        removedLines: 0,
        unified: "",
        hunks: [],
      },
      old: { title: oldTitle, fetchedAt: oldFetchedAt, fromCache: oldFromCache },
      new: { title: newTitle, fetchedAt: newFetchedAt, fromCache: newFromCache },
    };
  }

  const hunks = diffLines(oldMd, newMd);
  const summary = summarizeHunks(hunks, oldHash, newHash, {
    maxUnifiedChars: opts.maxUnifiedChars,
    maxHunks: opts.maxHunks,
  });

  return {
    ok: true,
    url,
    summary,
    old: { title: oldTitle, fetchedAt: oldFetchedAt, fromCache: oldFromCache },
    new: { title: newTitle, fetchedAt: newFetchedAt, fromCache: newFromCache },
  };
}

/** Pure helper for tests: diff two cache entries without network. */
export function diffCacheEntries(
  oldEntry: CacheEntry,
  newEntry: CacheEntry,
  opts?: { maxUnifiedChars?: number; maxHunks?: number },
): DiffSummary {
  const hunks = diffLines(oldEntry.markdown, newEntry.markdown);
  return summarizeHunks(hunks, oldEntry.contentHash, newEntry.contentHash, opts);
}
