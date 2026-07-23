import { describe, it, expect } from "vitest";
import { diffLines, summarizeHunks, webDiff, diffCacheEntries, } from "../src/diff.js";
import { createHash } from "node:crypto";
function hash(s) {
    return createHash("sha256").update(s).digest("hex");
}
describe("diffLines", () => {
    it("detects added and removed lines", () => {
        const hunks = diffLines("a\nb\nc\n", "a\nx\nc\n");
        const types = hunks.map((h) => h.type);
        expect(types).toContain("remove");
        expect(types).toContain("add");
        const summary = summarizeHunks(hunks, hash("a\nb\nc\n"), hash("a\nx\nc\n"));
        expect(summary.changed).toBe(true);
        expect(summary.addedLines).toBeGreaterThanOrEqual(1);
        expect(summary.removedLines).toBeGreaterThanOrEqual(1);
        expect(summary.unified).toMatch(/^[+-]/m);
    });
    it("unchanged when equal", () => {
        const text = "same\nlines\n";
        const hunks = diffLines(text, text);
        const summary = summarizeHunks(hunks, hash(text), hash(text));
        expect(summary.changed).toBe(false);
        expect(summary.addedLines).toBe(0);
        expect(summary.removedLines).toBe(0);
    });
});
describe("webDiff", () => {
    it("diffs explicit markdown without network", async () => {
        const res = await webDiff({
            oldMarkdown: "version 1\nstable\n",
            newMarkdown: "version 2\nstable\n",
            oldTitle: "old",
            newTitle: "new",
        });
        expect(res.ok).toBe(true);
        if (!res.ok)
            return;
        expect(res.summary.changed).toBe(true);
        expect(res.summary.unified).toContain("-version 1");
        expect(res.summary.unified).toContain("+version 2");
    });
    it("reports unchanged for identical bodies", async () => {
        const res = await webDiff({
            oldMarkdown: "x\n",
            newMarkdown: "x\n",
        });
        expect(res.ok).toBe(true);
        if (!res.ok)
            return;
        expect(res.summary.changed).toBe(false);
    });
    it("diffCacheEntries uses entry hashes", () => {
        const a = {
            url: "https://example.com",
            finalUrl: "https://example.com",
            title: "A",
            markdown: "one\n",
            contentType: "text/html",
            httpStatus: 200,
            fetchedAt: "t1",
            contentHash: hash("one\n"),
        };
        const b = {
            ...a,
            markdown: "two\n",
            contentHash: hash("two\n"),
        };
        const s = diffCacheEntries(a, b);
        expect(s.changed).toBe(true);
    });
});
