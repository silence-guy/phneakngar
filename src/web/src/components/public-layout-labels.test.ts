import { describe, expect, it } from "vitest";
import { Locale } from "@phneakngar/shared";
import { PUBLIC_LAYOUT_LABELS, getPublicLayoutLabels } from "./public-layout-labels";

function flatten(obj: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const value of Object.values(obj)) {
    if (typeof value === "string") {
      out.push(value);
    } else if (value && typeof value === "object") {
      out.push(...flatten(value as Record<string, unknown>));
    }
  }
  return out;
}

describe("public layout labels", () => {
  it("provides matching en/km labels with no empty strings or replacement chars", () => {
    const en = flatten(PUBLIC_LAYOUT_LABELS[Locale.EN] as unknown as Record<string, unknown>);
    const km = flatten(PUBLIC_LAYOUT_LABELS[Locale.KM] as unknown as Record<string, unknown>);

    expect(en.length).toBeGreaterThan(0);
    expect(en.length).toBe(km.length);
    for (const value of [...en, ...km]) {
      expect(value.trim().length).toBeGreaterThan(0);
      expect(value).not.toMatch(/[\uFFFD]/);
    }
  });

  it("defaults to Khmer chrome", () => {
    const labels = getPublicLayoutLabels();
    expect(labels.blog).toBe("ប្លុក");
    expect(labels.templates).toBe("គំរូ");
    expect(labels.privacy).toBe("ឯកជនភាព");
  });

  it("returns English chrome for the en locale", () => {
    const labels = getPublicLayoutLabels(Locale.EN);
    expect(labels.blog).toBe("Blog");
    expect(labels.templates).toBe("Templates");
    expect(labels.privacy).toBe("Privacy");
    expect(labels.tagline).toBe("Your Agent. Always Working.");
  });
});
