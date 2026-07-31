import { describe, expect, it } from "vitest";
import { AgentLanguageMode, Locale } from "../src/locale";

// This test verifies agentLanguageModeLabels is exported from locale.ts
describe("agentLanguageModeLabels", () => {
  it("should be exported from locale.ts", async () => {
    const module = await import("../src/locale");
    expect(module).toHaveProperty("agentLanguageModeLabels");
  });

  it("exports labels for all supported agent language modes", async () => {
    const { agentLanguageModeLabels } = await import("../src/locale");
    const expectedModes = [AgentLanguageMode.AUTO, AgentLanguageMode.BILINGUAL, AgentLanguageMode.EN, AgentLanguageMode.KM];
    for (const mode of expectedModes) {
      expect(agentLanguageModeLabels).toHaveProperty(mode);
      expect(agentLanguageModeLabels[mode]).toHaveProperty(Locale.EN);
      expect(agentLanguageModeLabels[mode]).toHaveProperty(Locale.KM);
    }
  });

  it("provides non-empty labels in both locales", async () => {
    const { agentLanguageModeLabels } = await import("../src/locale");
    for (const mode of Object.values(AgentLanguageMode)) {
      expect(agentLanguageModeLabels[mode][Locale.EN].length).toBeGreaterThan(0);
      expect(agentLanguageModeLabels[mode][Locale.KM].length).toBeGreaterThan(0);
    }
  });

  it("has Khmer labels containing Khmer script", async () => {
    const { agentLanguageModeLabels } = await import("../src/locale");
    const isKhmer = (s: string) => /[ក-៿]/.test(s);
    expect(isKhmer(agentLanguageModeLabels[AgentLanguageMode.KM][Locale.KM])).toBe(true);
    expect(isKhmer(agentLanguageModeLabels[AgentLanguageMode.BILINGUAL][Locale.KM])).toBe(true);
  });
});
