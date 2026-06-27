import { describe, it, expect } from "vitest";
import { WORKSPACE_PICKER_LABELS } from "./workspace-picker-labels";

const isKhmer = (s: string) => /[ក-៿]/.test(s);

describe("WORKSPACE_PICKER_LABELS", () => {
  it("localizes every label to Khmer", () => {
    for (const value of Object.values(WORKSPACE_PICKER_LABELS)) {
      expect(isKhmer(value)).toBe(true);
    }
  });
});
