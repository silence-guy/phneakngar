import { describe, expect, it } from "vitest";
import { Locale } from "@phneakngar/shared";
import { PUBLIC_META_LABELS, getPublicMetaLabels } from "./public-meta-labels";

describe("public meta labels", () => {
  it("provides matching en/km labels with no empty strings or replacement chars", () => {
    const en = PUBLIC_META_LABELS[Locale.EN];
    const km = PUBLIC_META_LABELS[Locale.KM];

    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(km[key]).toBeDefined();
      expect(en[key].trim().length).toBeGreaterThan(0);
      expect(km[key].trim().length).toBeGreaterThan(0);
      expect(en[key]).not.toMatch(/[\uFFFD]/);
      expect(km[key]).not.toMatch(/[\uFFFD]/);
    }
  });

  it("defaults to Khmer metadata copy", () => {
    const labels = getPublicMetaLabels();
    expect(labels.siteTitle).toContain("ភ្នាក់ងារ");
  });

  it("returns English metadata copy for the en locale", () => {
    const labels = getPublicMetaLabels(Locale.EN);
    expect(labels.siteTitle).toBe("Phneakngar — Your Agent. Always Working.");
    expect(labels.siteDescription).toContain("24/7");
  });
});
