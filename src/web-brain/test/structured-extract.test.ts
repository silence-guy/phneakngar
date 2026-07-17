import { describe, it, expect } from "vitest";
import {
  extractMetadata,
  extractTables,
  extractJsonLd,
  structuredExtract,
} from "../src/structured-extract.js";

const fixture = `
<html lang="en">
<head>
  <title>Product Page</title>
  <meta name="description" content="A fine product" />
  <meta property="og:title" content="OG Product" />
  <link rel="canonical" href="https://example.com/product" />
  <script type="application/ld+json">{"@type":"Product","name":"Widget"}</script>
</head>
<body>
  <table>
    <tr><th>Plan</th><th>Price</th></tr>
    <tr><td>Free</td><td>$0</td></tr>
    <tr><td>Pro</td><td>$10</td></tr>
  </table>
</body>
</html>
`;

describe("structured extract", () => {
  it("extracts metadata", () => {
    const m = extractMetadata(fixture);
    expect(m.title).toBe("Product Page");
    expect(m.description).toContain("fine product");
    expect(m.canonical).toContain("example.com/product");
    expect(m.og["og:title"]).toBe("OG Product");
    expect(m.lang).toBe("en");
  });

  it("extracts tables", () => {
    const tables = extractTables(fixture);
    expect(tables.length).toBe(1);
    expect(tables[0]!.headers).toEqual(["Plan", "Price"]);
    expect(tables[0]!.rows).toEqual([
      ["Free", "$0"],
      ["Pro", "$10"],
    ]);
  });

  it("extracts jsonld", () => {
    const j = extractJsonLd(fixture);
    expect(j.length).toBe(1);
    expect((j[0] as { name: string }).name).toBe("Widget");
  });

  it("structuredExtract all from html (no network)", async () => {
    const res = await structuredExtract({ html: fixture, mode: "all" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.metadata?.title).toBe("Product Page");
    expect(res.tables?.length).toBe(1);
    expect(res.jsonld?.length).toBe(1);
  });

  it("requires url or html", async () => {
    const res = await structuredExtract({});
    expect(res.ok).toBe(false);
  });
});
