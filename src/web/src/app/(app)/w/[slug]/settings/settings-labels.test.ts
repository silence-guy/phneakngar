import { describe, expect, it } from "vitest";
import { Locale } from "@phneakngar/shared";

// Test that settings-labels exports bilingual-ready labels
describe("settings labels bilingual support", () => {
  it("should export settings labels that support bilingual lookup", async () => {
    const { SETTINGS_LABELS } = await import("./settings-labels");

    // Title should exist
    expect(SETTINGS_LABELS).toHaveProperty("title");

    // Tabs should have labels
    expect(SETTINGS_LABELS.tabs).toBeDefined();
    expect(SETTINGS_LABELS.tabs.general).toBeDefined();
    expect(SETTINGS_LABELS.tabs.pet).toBeDefined();
    expect(SETTINGS_LABELS.tabs.instruction).toBeDefined();
    expect(SETTINGS_LABELS.tabs.notifications).toBeDefined();
    expect(SETTINGS_LABELS.tabs.members).toBeDefined();
    expect(SETTINGS_LABELS.tabs.gateway).toBeDefined();
    expect(SETTINGS_LABELS.tabs.usages).toBeDefined();
  });

  it("should export a function to get labels in current locale", async () => {
    const mod = await import("./settings-labels");

    // Should export a function that returns labels for given locale
    expect(mod).toHaveProperty("getSettingsLabels");
    expect(typeof mod.getSettingsLabels).toBe("function");
  });

  it("should return EN labels when locale is EN", async () => {
    const { getSettingsLabels } = await import("./settings-labels");

    const labels = getSettingsLabels(Locale.EN);
    expect(labels.title).toBe("Settings");
    expect(labels.tabs.general).toBe("General");
  });

  it("should return KM labels when locale is KM", async () => {
    const { getSettingsLabels } = await import("./settings-labels");

    const labels = getSettingsLabels(Locale.KM);
    expect(labels.title).toBe("ការកំណត់");
    expect(labels.tabs.general).toBe("ទូទៅ");
  });

  it("should export language settings labels in getSettingsLabels", async () => {
    const { getSettingsLabels } = await import("./settings-labels");

    const labels = getSettingsLabels(Locale.EN);
    // Should have a language section with labels for both settings
    expect(labels).toHaveProperty("language");
    expect(labels.language).toHaveProperty("sectionTitle");
    expect(labels.language).toHaveProperty("uiLocaleLabel");
    expect(labels.language).toHaveProperty("agentLanguageLabel");
    expect(labels.language).toHaveProperty("uiLocaleDescription");
    expect(labels.language).toHaveProperty("agentLanguageDescription");
  });

  it("should repair the corrupted Khmer pendingInvites string (no U+FFFD)", async () => {
    const { getSettingsLabels } = await import("./settings-labels");

    const labels = getSettingsLabels(Locale.KM);
    expect(labels.members.pendingInvites).not.toContain("\uFFFD");
    expect(labels.members.pendingInvites).toBe("តំណអញ្ជើញដែលកំពុងរង់ចាំ");
  });

  it("should return bilingual slugUrlHint prefixes", async () => {
    const { slugUrlHint } = await import("./settings-labels");

    expect(slugUrlHint("demo", Locale.EN)).toBe("Used in URL: /w/demo/");
    expect(slugUrlHint("demo", Locale.KM)).toBe("ប្រើក្នុង URL: /w/demo/");
  });

  it("should return bilingual expiresLabel", async () => {
    const { expiresLabel } = await import("./settings-labels");

    expect(expiresLabel("2026-08-01", Locale.EN)).toBe("Expired 2026-08-01");
    expect(expiresLabel("2026-08-01", Locale.KM)).toBe("ផុតកំណត់ 2026-08-01");
  });
});
