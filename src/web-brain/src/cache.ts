/**
 * Local on-disk page cache with simple FTS (no embeddings / sqlite-vec).
 * Uses Node fs + JSON index for zero native deps and small install size.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  unlinkSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { CacheEntry, WebCacheLike } from "./types.js";

function hashUrl(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 32);
}

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^a-z0-9\u1780-\u17ff]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

export type WebCacheOptions = {
  /** Directory for cache files (created if missing). */
  dir: string;
};

export class WebCache implements WebCacheLike {
  readonly dir: string;
  private readonly pagesDir: string;

  constructor(opts: WebCacheOptions) {
    this.dir = opts.dir;
    this.pagesDir = join(this.dir, "pages");
    mkdirSync(this.pagesDir, { recursive: true, mode: 0o700 });
  }

  private pathFor(url: string): string {
    return join(this.pagesDir, `${hashUrl(url)}.json`);
  }

  get(url: string): CacheEntry | null {
    const p = this.pathFor(url);
    if (!existsSync(p)) return null;
    try {
      const raw = readFileSync(p, "utf-8");
      const entry = JSON.parse(raw) as CacheEntry;
      if (!entry?.url || typeof entry.markdown !== "string") return null;
      return entry;
    } catch {
      return null;
    }
  }

  put(entry: CacheEntry): void {
    const p = this.pathFor(entry.url);
    writeFileSync(p, JSON.stringify(entry), { mode: 0o600 });
    // Also key by finalUrl when different so lookups by redirect work
    if (entry.finalUrl && entry.finalUrl !== entry.url) {
      const p2 = this.pathFor(entry.finalUrl);
      writeFileSync(p2, JSON.stringify(entry), { mode: 0o600 });
    }
  }

  search(query: string, limit = 20): CacheEntry[] {
    const tokens = tokenize(query);
    if (!tokens.length) return [];
    const out: { entry: CacheEntry; score: number }[] = [];
    let names: string[];
    try {
      names = readdirSync(this.pagesDir).filter((n) => n.endsWith(".json"));
    } catch {
      return [];
    }
    const seen = new Set<string>();
    for (const name of names) {
      try {
        const entry = JSON.parse(
          readFileSync(join(this.pagesDir, name), "utf-8"),
        ) as CacheEntry;
        if (!entry?.url || seen.has(entry.url)) continue;
        seen.add(entry.url);
        const hay = `${entry.title}\n${entry.markdown}`.toLowerCase();
        let score = 0;
        for (const t of tokens) {
          if (hay.includes(t)) score += 1;
        }
        if (score > 0) out.push({ entry, score });
      } catch {
        // skip corrupt
      }
    }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, limit).map((x) => x.entry);
  }

  stats(): { entries: number; path: string } {
    let entries = 0;
    try {
      const names = readdirSync(this.pagesDir).filter((n) => n.endsWith(".json"));
      // Approximate unique by counting files (redirects may double)
      entries = names.length;
    } catch {
      entries = 0;
    }
    return { entries, path: this.dir };
  }

  clear(): void {
    try {
      rmSync(this.pagesDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
    mkdirSync(this.pagesDir, { recursive: true, mode: 0o700 });
  }

  /** Delete one URL entry if present. */
  delete(url: string): void {
    const p = this.pathFor(url);
    if (existsSync(p)) unlinkSync(p);
  }
}

export function defaultCacheDir(configRoot: string): string {
  return join(configRoot, "web-cache");
}
