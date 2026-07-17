import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { extractFromHtml, htmlToMarkdown, extractTitle } from "../src/extract.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(here, "fixtures/sample.html"), "utf-8");

describe("HTML extract", () => {
  it("extracts title from fixture", () => {
    expect(extractTitle(fixture)).toBe("Sample Article Title");
  });

  it("produces non-empty markdown without scripts", () => {
    const { title, markdown } = extractFromHtml(fixture);
    expect(title).toBe("Sample Article Title");
    expect(markdown.length).toBeGreaterThan(40);
    expect(markdown).toContain("first");
    expect(markdown).toContain("Section Two");
    expect(markdown).toContain("Alpha item");
    expect(markdown).toContain("[link to more](https://example.com/more)");
    expect(markdown.toLowerCase()).not.toContain("alert(");
    expect(markdown.toLowerCase()).not.toContain("color: red");
  });

  it("respects maxChars truncation marker", () => {
    const long = `<html><body><p>${"word ".repeat(5000)}</p></body></html>`;
    const md = htmlToMarkdown(long, 200);
    expect(md.length).toBeLessThan(400);
    expect(md).toContain("[... content truncated]");
  });
});
