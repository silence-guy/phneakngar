import { describe, expect, it } from "vitest";
import { FLAGS_LABELS } from "./flags-labels";

const isKhmer = (s: string) => /[ក-៿]/.test(s);

describe("flags labels", () => {
  it("exposes Khmer strings for every user-facing field", () => {
    expect(isKhmer(FLAGS_LABELS.title)).toBe(true);
    expect(isKhmer(FLAGS_LABELS.subtitle)).toBe(true);
    expect(isKhmer(FLAGS_LABELS.unflag)).toBe(true);
    expect(isKhmer(FLAGS_LABELS.empty.noFlagged)).toBe(true);
  });
});
