import { describe, expect, it } from "vitest";
import { Locale } from "@phneakngar/shared";
import {
  SCENARIO_PRESETS,
  SCENARIO_PRESETS_KM,
  getScenarioPresetById,
  getScenarioPresets,
  shuffleMembers,
} from "./scenario-presets";

describe("scenario preset localization", () => {
  it("keeps the raw scenario registry in English", () => {
    expect(SCENARIO_PRESETS[0]?.label).toBe("Software Development");
    expect(getScenarioPresets(Locale.EN)).toBe(SCENARIO_PRESETS);
  });

  it("returns Khmer scenarios by default with Khmer instruction bodies", () => {
    const presets = getScenarioPresets();

    expect(presets[0]?.label).toBe("អភិវឌ្ឍន៍កម្មវិធី");
    expect(presets[0]?.members[0]?.instructions).toContain("ភាសាលំនាំសម្រាប់អ្នកប្រើ");
    expect(presets[0]?.members[0]?.instructions).toContain("អ្នកជាអ្នកដឹកនាំ");
    expect(presets[0]?.members[0]?.instructions).toContain("CLI commands");
    expect(presets[0]?.members[0]?.instructions).toContain("JSON keys");
    expect(presets[0]?.members[0]?.instructions).not.toContain("You are the lead coordinator");
    expect(presets[0]?.members[0]?.instructions).not.toMatch(/match that recipient/i);
  });

  it("preserves stable scenario ids, icons, roles, and member counts", () => {
    expect(SCENARIO_PRESETS_KM).toHaveLength(SCENARIO_PRESETS.length);

    for (const [index, preset] of SCENARIO_PRESETS.entries()) {
      const khmerPreset = SCENARIO_PRESETS_KM[index];
      expect(khmerPreset?.id).toBe(preset.id);
      expect(khmerPreset?.icon).toBe(preset.icon);
      expect(khmerPreset?.members.map((member) => member.role)).toEqual(
        preset.members.map((member) => member.role),
      );
    }
  });

  it("preserves English scenario access for compatibility", () => {
    const preset = getScenarioPresetById("software-dev", Locale.EN);

    expect(preset?.label).toBe("Software Development");
    expect(preset?.members[0]?.instructions).not.toContain("km-KH");
  });

  it("uses full Khmer relationship and instruction text for engineer", () => {
    const preset = getScenarioPresetById("software-dev");
    const engineer = preset?.members.find((member) => member.role === "engineer");

    expect(engineer?.relationship).toContain("ជាភាសាខ្មែរ");
    expect(engineer?.relationship).toContain("acceptance criteria");
    expect(engineer?.instructions).toContain("អ្នកជាវិស្វករអនុវត្ត");
    expect(engineer?.instructions).not.toContain("You are the engineering specialist");
  });

  it("localizes all default scenarios with Khmer instruction bodies", () => {
    for (const preset of getScenarioPresets()) {
      for (const member of preset.members) {
        expect(member.instructions).toContain("ភាសាលំនាំសម្រាប់អ្នកប្រើ");
        expect(member.instructions).not.toMatch(/^You are /m);
        expect(member.description).toMatch(/[\u1780-\u17ff]/);
      }
    }
  });

  it("generates Khmer member names with valid ASCII email handles", () => {
    const members = shuffleMembers(4);

    expect(members).toHaveLength(4);
    expect(members.every((member) => /[\u1780-\u17ff]/.test(member.name))).toBe(true);
    expect(members.every((member) => /^[a-z0-9-]+$/.test(member.emailHandle))).toBe(true);
  });
});
