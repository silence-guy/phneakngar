/**
 * Lean vector index for crawled pages — deterministic hash embeddings (no ONNX).
 * Enable indexing with PHNEAKNGAR_CRAWL_INDEX=1.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync, } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
export const EMBED_DIM = 384;
const SUMMARY_CHARS = 500;
const MIN_TEXT_LEN = 20;
export function isIndexingEnabled() {
    return (process.env.PHNEAKNGAR_CRAWL_INDEX === "1" ||
        process.env.PHNEAKNGAR_CRAWL_INDEX === "true");
}
function tokenize(text) {
    return text
        .toLowerCase()
        .split(/[^a-z0-9\u1780-\u17ff]+/i)
        .filter((t) => t.length >= 2);
}
/**
 * Feature-hash embedding: stable, offline, zero model download.
 * Quality is below neural models but enables local find-similar after crawl.
 */
export function hashEmbed(text, dim = EMBED_DIM) {
    const vec = new Float32Array(dim);
    const tokens = tokenize(text);
    if (!tokens.length)
        return vec;
    const tf = new Map();
    for (const t of tokens)
        tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const [tok, count] of tf) {
        const h = createHash("sha256").update(tok).digest();
        const idx = h.readUInt32BE(0) % dim;
        const sign = h[4] & 1 ? 1 : -1;
        vec[idx] += sign * (1 + Math.log(count));
    }
    // L2 normalize
    let norm = 0;
    for (let i = 0; i < dim; i++)
        norm += vec[i] * vec[i];
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < dim; i++)
        vec[i] /= norm;
    return vec;
}
export function cosineSimilarity(a, b) {
    const n = Math.min(a.length, b.length);
    let dot = 0;
    for (let i = 0; i < n; i++)
        dot += a[i] * b[i];
    return dot;
}
export class VectorStore {
    dir;
    constructor(dir) {
        this.dir =
            dir ??
                join(process.env.PHNEAKNGAR_WEB_CACHE_DIR ||
                    join(homedir(), ".phneakngar", "web-cache"), "vectors");
        mkdirSync(this.dir, { recursive: true, mode: 0o700 });
    }
    pathFor(url) {
        const id = createHash("sha256").update(url).digest("hex").slice(0, 32);
        return join(this.dir, `${id}.json`);
    }
    upsert(rec) {
        writeFileSync(this.pathFor(rec.url), JSON.stringify(rec), { mode: 0o600 });
    }
    get(url) {
        const p = this.pathFor(url);
        if (!existsSync(p))
            return null;
        try {
            return JSON.parse(readFileSync(p, "utf-8"));
        }
        catch {
            return null;
        }
    }
    list() {
        const out = [];
        for (const name of readdirSync(this.dir).filter((n) => n.endsWith(".json"))) {
            try {
                out.push(JSON.parse(readFileSync(join(this.dir, name), "utf-8")));
            }
            catch {
                /* skip */
            }
        }
        return out;
    }
    clear() {
        for (const name of readdirSync(this.dir).filter((n) => n.endsWith(".json"))) {
            unlinkSync(join(this.dir, name));
        }
    }
    size() {
        try {
            return readdirSync(this.dir).filter((n) => n.endsWith(".json")).length;
        }
        catch {
            return 0;
        }
    }
}
export async function indexCrawlResult(item, store) {
    if (!isIndexingEnabled())
        return false;
    try {
        const summary = (item.markdown ?? "").slice(0, SUMMARY_CHARS);
        const text = `${item.title ?? ""}\n${summary}`.trim();
        if (text.length < MIN_TEXT_LEN)
            return false;
        const vector = hashEmbed(text);
        const contentHash = createHash("sha256")
            .update(item.markdown ?? "")
            .digest("hex");
        const vs = store ?? new VectorStore();
        vs.upsert({
            url: item.url,
            contentHash,
            modelId: "hash-embed-v1",
            dims: EMBED_DIM,
            vector: Array.from(vector),
            textPreview: text.slice(0, 200),
            updatedAt: new Date().toISOString(),
        });
        return true;
    }
    catch {
        return false;
    }
}
export function findSimilar(queryOrUrl, opts = {}) {
    const store = opts.store ?? new VectorStore();
    const limit = opts.limit ?? 5;
    const minScore = opts.minScore ?? 0.05;
    let queryVec;
    const existing = store.get(queryOrUrl);
    if (existing) {
        queryVec = Float32Array.from(existing.vector);
    }
    else {
        queryVec = hashEmbed(queryOrUrl);
    }
    const hits = [];
    for (const rec of store.list()) {
        if (rec.url === queryOrUrl)
            continue;
        const score = cosineSimilarity(queryVec, Float32Array.from(rec.vector));
        if (score >= minScore) {
            hits.push({ url: rec.url, score, textPreview: rec.textPreview });
        }
    }
    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, limit);
}
