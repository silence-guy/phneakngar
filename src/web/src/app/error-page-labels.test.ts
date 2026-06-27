import { describe, it, expect } from "vitest";
import { ERROR_PAGE_LABELS } from "./error-page-labels";

const isKhmer = (s: string) => /[ក-៿]/.test(s);

describe("ERROR_PAGE_LABELS", () => {
  it("localizes not-found copy to Khmer", () => {
    expect(isKhmer(ERROR_PAGE_LABELS.notFound.subject)).toBe(true);
    expect(isKhmer(ERROR_PAGE_LABELS.notFound.body)).toBe(true);
  });

  it("localizes error copy to Khmer", () => {
    expect(isKhmer(ERROR_PAGE_LABELS.error.subject)).toBe(true);
    expect(isKhmer(ERROR_PAGE_LABELS.error.body)).toBe(true);
    expect(isKhmer(ERROR_PAGE_LABELS.error.tryAgain)).toBe(true);
  });

  it("localizes shared email-mock and navigation labels to Khmer", () => {
    expect(isKhmer(ERROR_PAGE_LABELS.fromLabel)).toBe(true);
    expect(isKhmer(ERROR_PAGE_LABELS.toLabel)).toBe(true);
    expect(isKhmer(ERROR_PAGE_LABELS.subjectLabel)).toBe(true);
    expect(isKhmer(ERROR_PAGE_LABELS.toRecipient)).toBe(true);
    expect(isKhmer(ERROR_PAGE_LABELS.goHome)).toBe(true);
  });
});
