import { describe, it, expect } from "vitest";
import {
  deduplicatePages,
  stripRepeatedNavigationLines,
  splitIntoBlocks,
} from "../src/dedup.js";
import {
  hashEmbed,
  cosineSimilarity,
  VectorStore,
  indexCrawlResult,
  findSimilar,
} from "../src/embed.js";
import {
  countTokens,
  applyAggregateMarkdownBudget,
  truncateByTokens,
} from "../src/budget.js";
import {
  cookiesFromNetscape,
  cookiesFromStorageState,
  resolveAuth,
} from "../src/auth.js";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("dedup", () => {
  it("splits on headings", () => {
    const blocks = splitIntoBlocks("# A\nbody a\n# B\nbody b");
    expect(blocks.length).toBe(2);
  });

  it("strips repeated nav across corpus", () => {
    const nav = "Home | Docs | Blog";
    const pages = [1, 2, 3, 4].map((i) => ({
      url: `https://ex.com/p${i}`,
      markdown: `${nav}\n\n# Page ${i}\nUnique content for page ${i} with enough text.`,
    }));
    const stripped = stripRepeatedNavigationLines(pages);
    for (const p of stripped) {
      expect(p.markdown).not.toContain("Home | Docs | Blog");
      expect(p.markdown).toMatch(/Unique content/);
    }
  });

  it("removes boilerplate blocks shared by majority", () => {
    const dir = mkdtempSync(join(tmpdir(), "boil-"));
    try {
      const footer = "## Shared footer\nCopyright Acme Inc forever.";
      const pages = [1, 2, 3].map((i) => ({
        url: `https://ex.com/${i}`,
        markdown: `# Title ${i}\nContent number ${i} unique paragraph.\n\n${footer}`,
      }));
      const out = deduplicatePages(pages, "ex.com", dir);
      for (const p of out) {
        expect(p.markdown).not.toMatch(/Shared footer/);
        expect(p.markdown).toMatch(/unique paragraph/i);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("embed", () => {
  it("similar texts have higher cosine than unrelated", () => {
    const a = hashEmbed("digital privacy GDPR data protection regulation");
    const b = hashEmbed("GDPR privacy law European data protection");
    const c = hashEmbed("banana smoothie recipe tropical fruit");
    expect(cosineSimilarity(a, b)).toBeGreaterThan(cosineSimilarity(a, c));
  });

  it("indexes and finds similar", async () => {
    const dir = mkdtempSync(join(tmpdir(), "vec-"));
    try {
      const store = new VectorStore(dir);
      process.env.PHNEAKNGAR_CRAWL_INDEX = "1";
      await indexCrawlResult(
        {
          url: "https://ex.com/gdpr",
          title: "GDPR",
          markdown: "European data protection regulation privacy rights",
        },
        store,
      );
      await indexCrawlResult(
        {
          url: "https://ex.com/cooking",
          title: "Cooking",
          markdown: "Banana bread recipe oven flour sugar",
        },
        store,
      );
      const hits = findSimilar("privacy GDPR regulation", { store, limit: 2 });
      expect(hits[0]?.url).toBe("https://ex.com/gdpr");
    } finally {
      delete process.env.PHNEAKNGAR_CRAWL_INDEX;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("budget", () => {
  it("countTokens approximates length/4", () => {
    expect(countTokens("abcd")).toBe(1);
    expect(countTokens("a".repeat(40))).toBe(10);
  });

  it("applyAggregateMarkdownBudget truncates later items", () => {
    const items = [
      { markdown: "a".repeat(400) },
      { markdown: "b".repeat(400) },
    ];
    applyAggregateMarkdownBudget(
      items,
      (i) => i.markdown,
      (i, b) => {
        i.markdown = b;
      },
      { maxTokensOut: 50, minTokensPerItem: 10 },
    );
    expect(items[0]!.markdown.length).toBeLessThanOrEqual(400);
    expect(items.every((i) => i.markdown.length > 0)).toBe(true);
    expect(truncateByTokens("hello world. more text here.", 2).length).toBeLessThan(
      40,
    );
  });
});

describe("auth", () => {
  it("parses netscape cookies", () => {
    const txt = `# Netscape
.example.com	TRUE	/	FALSE	0	session	abc123
`;
    expect(cookiesFromNetscape(txt, "www.example.com")).toContain("session=abc123");
  });

  it("parses storageState JSON", () => {
    const c = cookiesFromStorageState(
      {
        cookies: [
          { name: "a", value: "1", domain: ".ex.com" },
          { name: "b", value: "2", domain: ".ex.com" },
        ],
      },
      "www.ex.com",
    );
    expect(c).toBe("a=1; b=2");
  });

  it("resolveAuth from cookie file", () => {
    const dir = mkdtempSync(join(tmpdir(), "auth-"));
    const p = join(dir, "cookies.txt");
    writeFileSync(
      p,
      `.ex.com	TRUE	/	FALSE	0	tok	xyz\n`,
    );
    const auth = resolveAuth({
      useAuth: true,
      authStatePath: p,
      host: "www.ex.com",
    });
    expect(auth?.cookieHeader).toContain("tok=xyz");
    rmSync(dir, { recursive: true, force: true });
  });
});
