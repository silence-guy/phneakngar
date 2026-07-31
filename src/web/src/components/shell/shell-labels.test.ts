import { describe, expect, it } from "vitest";
import { Locale } from "@phneakngar/shared";
import { SHELL_LABELS, getShellLabels, shellLabel } from "./shell-labels";

describe("shell labels bilingual support", () => {
  it("every key has both EN and KM labels and no empty strings", () => {
    for (const [group, labels] of Object.entries(SHELL_LABELS)) {
      for (const [key, label] of Object.entries(labels)) {
        expect(label[Locale.EN], `${group}.${key}.en`).toBeTruthy();
        expect(label[Locale.KM], `${group}.${key}.km`).toBeTruthy();
        expect(label[Locale.EN], `${group}.${key}.en`).not.toBe("");
        expect(label[Locale.KM], `${group}.${key}.km`).not.toBe("");
      }
    }
  });

  it("Khmer labels contain no U+FFFD replacement characters", () => {
    for (const [group, labels] of Object.entries(SHELL_LABELS)) {
      for (const [key, label] of Object.entries(labels)) {
        expect(label[Locale.KM], `${group}.${key}`).not.toContain("\uFFFD");
      }
    }
  });

  it("getShellLabels(Locale.EN) returns English strings for every key", () => {
    const labels = getShellLabels(Locale.EN);
    for (const [group, entries] of Object.entries(SHELL_LABELS)) {
      for (const key of Object.keys(entries)) {
        expect(labels[group][key], `${group}.${key}`).toBeTruthy();
      }
    }
    expect(labels.nav.home).toBe("Home");
    expect(labels.nav.settings).toBe("Settings");
    expect(labels.user.logOut).toBe("Log out");
    expect(labels.agent.pinTop).toBe("Pin to top");
  });

  it("getShellLabels(Locale.KM) returns Khmer strings for every key", () => {
    const labels = getShellLabels(Locale.KM);
    for (const [group, entries] of Object.entries(SHELL_LABELS)) {
      for (const key of Object.keys(entries)) {
        expect(labels[group][key], `${group}.${key}`).toBeTruthy();
      }
    }
    expect(labels.nav.home).toBe("ទំព័រដើម");
    expect(labels.nav.settings).toBe("ការកំណត់");
    expect(labels.user.logOut).toBe("ចាកចេញ");
    expect(labels.agent.pinTop).toBe("ខ្ទាស់ទៅលើ");
  });

  it("shellLabel resolves a single label for the given locale", () => {
    expect(shellLabel("nav", "home", Locale.EN)).toBe("Home");
    expect(shellLabel("nav", "home", Locale.KM)).toBe("ទំព័រដើម");
    expect(shellLabel("actions", "newAgent", Locale.EN)).toBe("New agent");
    expect(shellLabel("actions", "newAgent", Locale.KM)).toBe("ភ្នាក់ងារថ្មី");
  });
});
