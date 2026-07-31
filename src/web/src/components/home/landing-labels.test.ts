import { describe, expect, it } from "vitest";
import {
  LANDING_HERO_LABELS,
  LANDING_NAV_LABELS,
  LANDING_FOOTER_LABELS,
  LANDING_USE_CASES_LABELS,
  LANDING_FEATURE_LABELS,
  LANDING_BYOA_LABELS,
  LANDING_QUICKSTART_LABELS,
  LANDING_ARCH_LABELS,
} from "./landing-labels";

const LANDING_LABEL_GROUPS = {
  LANDING_HERO_LABELS,
  LANDING_NAV_LABELS,
  LANDING_FOOTER_LABELS,
  LANDING_USE_CASES_LABELS,
  LANDING_FEATURE_LABELS,
  LANDING_BYOA_LABELS,
  LANDING_QUICKSTART_LABELS,
  LANDING_ARCH_LABELS,
};

const LOCALE_KEYS = ["en", "km"] as const;

/**
 * Walks a label structure and asserts that every node that carries locale
 * entries has BOTH the `en` and `km` keys. Leaf values (strings) and
 * non-locale metadata (ids, hrefs) are ignored.
 */
function expectBilingualKeys(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => expectBilingualKeys(item, `${path}[${index}]`));
    return;
  }
  if (typeof value !== "object" || value === null) return;

  const keys = Object.keys(value);
  const isLocaleMap = LOCALE_KEYS.some((key) => keys.includes(key));
  if (isLocaleMap) {
    expect(keys, `${path} should include both locale keys`).toEqual(
      expect.arrayContaining([...LOCALE_KEYS]),
    );
  }
  for (const [key, child] of Object.entries(value)) {
    expectBilingualKeys(child, `${path}.${key}`);
  }
}

/**
 * Walks a label structure and asserts that every string leaf is non-empty.
 */
function expectNonEmptyStrings(value: unknown, path: string): void {
  if (typeof value === "string") {
    expect(value.trim(), `${path} should not be empty`).not.toBe("");
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => expectNonEmptyStrings(item, `${path}[${index}]`));
    return;
  }
  if (typeof value !== "object" || value === null) return;
  for (const [key, child] of Object.entries(value)) {
    expectNonEmptyStrings(child, `${path}.${key}`);
  }
}

describe("landing labels bilingual structure", () => {
  it("exports every label group with both en and km entries", () => {
    const groups = Object.entries(LANDING_LABEL_GROUPS);
    expect(groups.length).toBeGreaterThan(0);

    for (const [name, group] of groups) {
      expectBilingualKeys(group, name);
    }
  });

  it("has no empty label strings in any group", () => {
    for (const [name, group] of Object.entries(LANDING_LABEL_GROUPS)) {
      expectNonEmptyStrings(group, name);
    }
  });

  it("localizes every LANDING_FOOTER_LABELS km value (no English duplicates)", () => {
    const en = LANDING_FOOTER_LABELS.en;
    const km = LANDING_FOOTER_LABELS.km;

    const enKeys = Object.keys(en) as Array<keyof typeof en>;
    expect(enKeys.length).toBeGreaterThan(0);

    for (const key of enKeys) {
      const enValue = en[key];
      const kmValue = km[key];

      expect(typeof kmValue, `${key} should exist in km`).toBe("string");
      expect(kmValue.trim(), `${key} km should not be empty`).not.toBe("");
      expect(kmValue, `${key} km should not contain U+FFFD`).not.toMatch(/[\uFFFD]/);
      expect(kmValue, `${key} km should differ from en`).not.toBe(enValue);
    }
  });
});
