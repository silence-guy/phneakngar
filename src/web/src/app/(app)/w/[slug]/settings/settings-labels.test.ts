import { describe, expect, it } from "vitest";
import {
  SETTINGS_LABELS,
  settingsTabLabel,
  slugUrlHint,
  expiresLabel,
} from "./settings-labels";

const isKhmer = (s: string) => /[ក-៿]/.test(s);

describe("settings labels", () => {
  it("exposes a Khmer page title", () => {
    expect(isKhmer(SETTINGS_LABELS.title)).toBe(true);
  });

  it("maps every tab id to a Khmer label", () => {
    for (const id of [
      "general",
      "pet",
      "instruction",
      "notifications",
      "members",
      "gateway",
      "usages",
    ]) {
      expect(isKhmer(settingsTabLabel(id))).toBe(true);
    }
  });

  it("falls back to the raw id for unknown tabs", () => {
    expect(settingsTabLabel("unknown")).toBe("unknown");
  });

  it("localizes general sub-object strings (technical tokens stay English)", () => {
    // slugLabel ("Slug") is an intentional technical URL-identifier token.
    const technicalTokens = new Set(["slugLabel"]);
    for (const [key, value] of Object.entries(SETTINGS_LABELS.general)) {
      if (technicalTokens.has(key)) continue;
      expect(isKhmer(value)).toBe(true);
    }
  });

  it("localizes every instruction sub-object string", () => {
    for (const value of Object.values(SETTINGS_LABELS.instruction)) {
      expect(isKhmer(value)).toBe(true);
    }
  });

  it("localizes every members sub-object string", () => {
    for (const value of Object.values(SETTINGS_LABELS.members)) {
      expect(isKhmer(value)).toBe(true);
    }
  });

  it("localizes every notification sub-object string", () => {
    for (const value of Object.values(SETTINGS_LABELS.notification)) {
      expect(isKhmer(value)).toBe(true);
    }
  });

  it("builds a Khmer slug URL hint while preserving the literal path", () => {
    const hint = slugUrlHint("my-workspace");
    expect(isKhmer(hint)).toBe(true);
    expect(hint).toContain("/w/my-workspace/");
  });

  it("builds a Khmer expires label while preserving the date value", () => {
    const label = expiresLabel("12/31/2026");
    expect(isKhmer(label)).toBe(true);
    expect(label).toContain("12/31/2026");
  });

  it("exposes gateway dry-config doctor labels without claiming full parity", () => {
    expect(SETTINGS_LABELS.gateway.doctorTitle).toMatch(/dry-config/i);
    expect(SETTINGS_LABELS.gateway.doctorHint).toMatch(/no live/i);
    expect(SETTINGS_LABELS.gateway.parityNote).toMatch(/not claimed/i);
    expect(SETTINGS_LABELS.gateway.doctorLiveRisk).toMatch(/risk/i);
    expect(SETTINGS_LABELS.gateway.doctorWebhookFailClosed).toMatch(/fail-closed|shared secret/i);
  });
});
