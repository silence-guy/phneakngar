/**
 * Local on-disk page cache with simple FTS (no embeddings / sqlite-vec).
 * Uses Node fs + JSON index for zero native deps and small install size.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync, rmSync, } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
function hashUrl(url) {
    return createHash("sha256").update(url).digest("hex").slice(0, 32);
}
function tokenize(q) {
    return q
        .toLowerCase()
        .split(/[^a-z0-9\u1780-\u17ff]+/i)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2);
}
export class WebCache {
    dir;
    pagesDir;
    constructor(opts) {
        this.dir = opts.dir;
        this.pagesDir = join(this.dir, "pages");
        mkdirSync(this.pagesDir, { recursive: true, mode: 0o700 });
    }
    pathFor(url) {
        return join(this.pagesDir, `${hashUrl(url)}.json`);
    }
    get(url) {
        const p = this.pathFor(url);
        if (!existsSync(p))
            return null;
        try {
            const raw = readFileSync(p, "utf-8");
            const entry = JSON.parse(raw);
            if (!entry?.url || typeof entry.markdown !== "string")
                return null;
            return entry;
        }
        catch {
            return null;
        }
    }
    put(entry) {
        const p = this.pathFor(entry.url);
        writeFileSync(p, JSON.stringify(entry), { mode: 0o600 });
        // Also key by finalUrl when different so lookups by redirect work
        if (entry.finalUrl && entry.finalUrl !== entry.url) {
            const p2 = this.pathFor(entry.finalUrl);
            writeFileSync(p2, JSON.stringify(entry), { mode: 0o600 });
        }
    }
    search(query, limit = 20) {
        const tokens = tokenize(query);
        if (!tokens.length)
            return [];
        const out = [];
        let names;
        try {
            names = readdirSync(this.pagesDir).filter((n) => n.endsWith(".json"));
        }
        catch {
            return [];
        }
        const seen = new Set();
        for (const name of names) {
            try {
                const entry = JSON.parse(readFileSync(join(this.pagesDir, name), "utf-8"));
                if (!entry?.url || seen.has(entry.url))
                    continue;
                seen.add(entry.url);
                const hay = `${entry.title}\n${entry.markdown}`.toLowerCase();
                let score = 0;
                for (const t of tokens) {
                    if (hay.includes(t))
                        score += 1;
                }
                if (score > 0)
                    out.push({ entry, score });
            }
            catch {
                // skip corrupt
            }
        }
        out.sort((a, b) => b.score - a.score);
        return out.slice(0, limit).map((x) => x.entry);
    }
    stats() {
        let entries = 0;
        try {
            const names = readdirSync(this.pagesDir).filter((n) => n.endsWith(".json"));
            // Approximate unique by counting files (redirects may double)
            entries = names.length;
        }
        catch {
            entries = 0;
        }
        return { entries, path: this.dir };
    }
    clear() {
        try {
            rmSync(this.pagesDir, { recursive: true, force: true });
        }
        catch {
            // ignore
        }
        mkdirSync(this.pagesDir, { recursive: true, mode: 0o700 });
    }
    /** Delete one URL entry if present. */
    delete(url) {
        const p = this.pathFor(url);
        if (existsSync(p))
            unlinkSync(p);
    }
}
export function defaultCacheDir(configRoot) {
    return join(configRoot, "web-cache");
}
