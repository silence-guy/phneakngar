import { describe, expect, it } from "vitest";
import { Locale } from "@phneakngar/shared";
import { PRIVACY_LABELS, getPrivacyLabels } from "./privacy-labels";

function collectStrings(node: unknown, out: string[]): void {
  if (typeof node === "string") {
    out.push(node);
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) collectStrings(item, out);
    return;
  }
  if (node && typeof node === "object") {
    for (const value of Object.values(node)) collectStrings(value, out);
  }
}

describe("privacy labels", () => {
  it("provides matching en/km section structure", () => {
    const en = getPrivacyLabels(Locale.EN);
    const km = getPrivacyLabels(Locale.KM);

    expect(en.title.trim().length).toBeGreaterThan(0);
    expect(km.title.trim().length).toBeGreaterThan(0);
    expect(en.sections.length).toBe(km.sections.length);

    for (let i = 0; i < en.sections.length; i++) {
      expect(en.sections[i].heading.trim().length).toBeGreaterThan(0);
      expect(km.sections[i].heading.trim().length).toBeGreaterThan(0);
      expect(en.sections[i].blocks.length).toBe(km.sections[i].blocks.length);
    }
  });

  it("has no empty strings or replacement characters in either locale", () => {
    const enStrings: string[] = [];
    const kmStrings: string[] = [];
    collectStrings(getPrivacyLabels(Locale.EN), enStrings);
    collectStrings(getPrivacyLabels(Locale.KM), kmStrings);

    expect(enStrings.length).toBeGreaterThan(0);
    expect(kmStrings.length).toBeGreaterThan(0);

    for (const value of [...enStrings, ...kmStrings]) {
      expect(value.trim().length).toBeGreaterThan(0);
      expect(value).not.toMatch(/[\uFFFD]/);
    }
  });

  it("keeps legal copy Khmer by default and English on request", () => {
    expect(getPrivacyLabels().title).toBe("គោលការណ៍ឯកជនភាព");
    expect(getPrivacyLabels(Locale.EN).title).toBe("Privacy Policy");
    expect(getPrivacyLabels(Locale.EN).sections[0].heading).toBe("Interpretation and Definitions");
  });
});
