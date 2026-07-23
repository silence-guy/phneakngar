/**
 * Cross-page boilerplate / nav dedup for crawl results.
 * Algorithm inspired by agent crawlers; JSON/sqlite domain hash store (no better-sqlite3).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
export function splitIntoBlocks(markdown) {
    if (!markdown.trim())
        return [];
    const lines = markdown.split("\n");
    const headingIndices = [];
    for (let i = 0; i < lines.length; i++) {
        if (/^#{1,6}\s+/.test(lines[i])) {
            headingIndices.push({ lineIdx: i });
        }
    }
    if (headingIndices.length === 0) {
        return markdown
            .split(/\n\n+/)
            .map((b) => b.trim())
            .filter(Boolean);
    }
    const blocks = [];
    for (let i = 0; i < headingIndices.length; i++) {
        const start = headingIndices[i].lineIdx;
        const end = i + 1 < headingIndices.length
            ? headingIndices[i + 1].lineIdx
            : lines.length;
        blocks.push(lines.slice(start, end).join("\n").trim());
    }
    return blocks.filter(Boolean);
}
export function normalizeBlockText(text) {
    return text.toLowerCase().replace(/\s+/g, " ").trim();
}
function hashBlock(text) {
    return createHash("sha256").update(normalizeBlockText(text)).digest("hex");
}
function lineHash(line) {
    return createHash("sha1").update(line.trim().toLowerCase()).digest("hex");
}
const NAV_DEDUPE_THRESHOLD = 0.6;
const MAX_LEADING_LINES = 30;
const MAX_TRAILING_LINES = 20;
const MIN_CORPUS = 4;
/** Strip leading/trailing lines that appear on ≥60% of pages (shared nav chrome). */
export function stripRepeatedNavigationLines(pages) {
    if (pages.length < MIN_CORPUS)
        return pages;
    const lineSets = pages.map((p) => p.markdown.split("\n"));
    const countLeading = new Map();
    const countTrailing = new Map();
    for (const lines of lineSets) {
        const seenL = new Set();
        for (let i = 0; i < Math.min(MAX_LEADING_LINES, lines.length); i++) {
            const h = lineHash(lines[i]);
            if (!seenL.has(h)) {
                seenL.add(h);
                countLeading.set(h, (countLeading.get(h) ?? 0) + 1);
            }
        }
        const seenT = new Set();
        for (let i = lines.length - 1; i >= Math.max(lines.length - MAX_TRAILING_LINES, 0); i--) {
            const h = lineHash(lines[i]);
            if (!seenT.has(h)) {
                seenT.add(h);
                countTrailing.set(h, (countTrailing.get(h) ?? 0) + 1);
            }
        }
    }
    const threshold = pages.length * NAV_DEDUPE_THRESHOLD;
    const navLeading = new Set([...countLeading].filter(([, c]) => c >= threshold).map(([h]) => h));
    const navTrailing = new Set([...countTrailing].filter(([, c]) => c >= threshold).map(([h]) => h));
    return pages.map((page, i) => {
        const lines = lineSets[i];
        let head = 0;
        while (head < lines.length &&
            (lines[head].trim() === "" || navLeading.has(lineHash(lines[head])))) {
            head++;
        }
        let tail = lines.length;
        while (tail > head &&
            (lines[tail - 1].trim() === "" ||
                navTrailing.has(lineHash(lines[tail - 1])))) {
            tail--;
        }
        return { url: page.url, markdown: lines.slice(head, tail).join("\n") };
    });
}
function defaultBoilerplatePath() {
    return join(process.env.PHNEAKNGAR_WEB_CACHE_DIR ||
        join(homedir(), ".phneakngar", "web-cache"), "boilerplate");
}
export function getStoredBoilerplate(domain, storeDir = defaultBoilerplatePath()) {
    const p = join(storeDir, `${domain.replace(/[^a-z0-9.-]/gi, "_")}.json`);
    if (!existsSync(p))
        return [];
    try {
        const raw = JSON.parse(readFileSync(p, "utf-8"));
        return Array.isArray(raw.hashes) ? raw.hashes : [];
    }
    catch {
        return [];
    }
}
export function storeBoilerplate(domain, hashes, storeDir = defaultBoilerplatePath()) {
    mkdirSync(storeDir, { recursive: true, mode: 0o700 });
    const p = join(storeDir, `${domain.replace(/[^a-z0-9.-]/gi, "_")}.json`);
    writeFileSync(p, JSON.stringify({ domain, hashes, updatedAt: new Date().toISOString() }), { mode: 0o600 });
}
/**
 * Remove blocks that appear on >50% of pages (+ stored domain boilerplate).
 * Persists new boilerplate hashes per domain when `domain` is set.
 */
export function deduplicatePages(pages, domain, storeDir) {
    if (pages.length <= 1) {
        return pages.map((p) => ({ url: p.url, markdown: p.markdown }));
    }
    const stripped = stripRepeatedNavigationLines(pages);
    const dir = storeDir ?? defaultBoilerplatePath();
    const boilerplateHashes = new Set(domain ? getStoredBoilerplate(domain, dir) : []);
    const pageBlocks = stripped.map((page) => ({
        url: page.url,
        blocks: splitIntoBlocks(page.markdown),
    }));
    const hashPageCount = new Map();
    for (const page of pageBlocks) {
        const seenHashes = new Set();
        for (const block of page.blocks) {
            const h = hashBlock(block);
            if (!seenHashes.has(h)) {
                seenHashes.add(h);
                hashPageCount.set(h, (hashPageCount.get(h) ?? 0) + 1);
            }
        }
    }
    const threshold = pages.length / 2;
    for (const [hash, count] of hashPageCount) {
        if (count > threshold)
            boilerplateHashes.add(hash);
    }
    if (domain) {
        storeBoilerplate(domain, [...boilerplateHashes], dir);
    }
    return pageBlocks.map((page) => {
        const filtered = page.blocks.filter((block) => !boilerplateHashes.has(hashBlock(block)));
        return {
            url: page.url,
            markdown: filtered.join("\n\n"),
        };
    });
}
