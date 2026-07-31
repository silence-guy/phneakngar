import { describe, it, expect } from "vitest";
import { Locale } from "@phneakngar/shared";
import { ERROR_PAGE_LABELS, getErrorPageLabels } from "./error-page-labels";

const isKhmer = (s: string) => /[ក-៿]/.test(s);

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

describe("ERROR_PAGE_LABELS", () => {
  it("provides matching en/km label groups with no empty strings", () => {
    const en = flatten(ERROR_PAGE_LABELS[Locale.EN] as unknown as Record<string, unknown>);
    const km = flatten(ERROR_PAGE_LABELS[Locale.KM] as unknown as Record<string, unknown>);

    expect(en.length).toBeGreaterThan(0);
    expect(en.length).toBe(km.length);
    for (const value of [...en, ...km]) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
    expect(km.some((s) => /[\uFFFD]/.test(s))).toBe(false);
  });

  it("localizes not-found copy to Khmer by default", () => {
    const labels = getErrorPageLabels();
    expect(isKhmer(labels.notFound.subject)).toBe(true);
    expect(isKhmer(labels.notFound.body)).toBe(true);
  });

  it("localizes error copy to Khmer by default", () => {
    const labels = getErrorPageLabels();
    expect(isKhmer(labels.error.subject)).toBe(true);
    expect(isKhmer(labels.error.body)).toBe(true);
    expect(isKhmer(labels.error.tryAgain)).toBe(true);
  });

  it("localizes shared email-mock and navigation labels to Khmer by default", () => {
    const labels = getErrorPageLabels();
    expect(isKhmer(labels.fromLabel)).toBe(true);
    expect(isKhmer(labels.toLabel)).toBe(true);
    expect(isKhmer(labels.subjectLabel)).toBe(true);
    expect(isKhmer(labels.toRecipient)).toBe(true);
    expect(isKhmer(labels.goHome)).toBe(true);
  });

  it("returns English copy for the en locale", () => {
    const labels = getErrorPageLabels(Locale.EN);
    expect(labels.notFound.subject).toBe("Undeliverable — Page Not Found");
    expect(labels.error.subject).toBe("Something went wrong");
    expect(labels.error.tryAgain).toBe("Try Again");
    expect(labels.goHome).toBe("Go Home");
    expect(labels.fromLabel).toBe("From:");
  });
});
