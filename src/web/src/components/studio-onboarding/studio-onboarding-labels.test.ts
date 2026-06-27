import { describe, expect, it } from "vitest";
import {
  STUDIO_ONBOARDING_LABELS,
  studioRoleLabel,
  studioAgentCountLabel,
} from "./studio-onboarding-labels";

const isKhmer = (s: string) => /[ក-៿]/.test(s);

describe("studio onboarding labels", () => {
  it("localizes nav, scenario, build, and team strings to Khmer", () => {
    const groups = [
      STUDIO_ONBOARDING_LABELS.nav,
      STUDIO_ONBOARDING_LABELS.scenario,
      STUDIO_ONBOARDING_LABELS.build,
      STUDIO_ONBOARDING_LABELS.team,
    ];
    for (const group of groups) {
      for (const value of Object.values(group)) {
        expect(isKhmer(value)).toBe(true);
      }
    }
  });

  it("maps stable role ids to Khmer display labels", () => {
    expect(studioRoleLabel("leader")).toBe("ប្រធាន");
    expect(studioRoleLabel("researcher")).toBe("អ្នកស្រាវជ្រាវ");
    expect(studioRoleLabel("engineer")).toBe("វិស្វករ");
    expect(studioRoleLabel("assistant")).toBe("ជំនួយការ");
  });

  it("formats agent counts with the Khmer agent noun", () => {
    expect(studioAgentCountLabel(3)).toBe("3 ភ្នាក់ងារ");
    expect(isKhmer(studioAgentCountLabel(1))).toBe(true);
  });
});
