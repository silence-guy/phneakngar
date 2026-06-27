import { describe, expect, it } from "vitest";
import { SIDEBAR_LABELS } from "./sidebar-labels";

const isKhmer = (s: string) => /[ក-៿]/.test(s);

describe("sidebar labels", () => {
  it("localizes pin/unpin and group actions to Khmer", () => {
    expect(isKhmer(SIDEBAR_LABELS.unpin)).toBe(true);
    expect(isKhmer(SIDEBAR_LABELS.pinTop)).toBe(true);
    expect(isKhmer(SIDEBAR_LABELS.removeFromGroup)).toBe(true);
  });
});
