import { describe, expect, it } from "vitest";
import { HERO_SECTION_LABELS } from "./hero-section-labels";

const isKhmer = (s: string) => /[ក-៿]/.test(s);

describe("hero section labels", () => {
  it("keeps the mobile experience hint Khmer-first", () => {
    expect(isKhmer(HERO_SECTION_LABELS.mobileExperienceHint)).toBe(true);
    expect(HERO_SECTION_LABELS.mobileExperienceHint).not.toMatch(/full experience|desktop browser/i);
  });
});
