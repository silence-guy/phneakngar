import { describe, expect, it } from "vitest";
import { Locale } from "@alook/shared";
import {
  SCENARIO_PRESETS,
  SCENARIO_PRESETS_KM,
  getScenarioPresetById,
  getScenarioPresets,
} from "./scenario-presets";

describe("scenario preset localization", () => {
  it("keeps the raw scenario registry in English", () => {
    expect(SCENARIO_PRESETS[0]?.label).toBe("Software Development");
    expect(getScenarioPresets(Locale.EN)).toBe(SCENARIO_PRESETS);
  });

  it("returns Khmer scenarios by default", () => {
    const presets = getScenarioPresets();

    expect(presets[0]?.label).toBe("អភិវឌ្ឍន៍កម្មវិធី");
    expect(presets[0]?.members[0]?.instructions).toContain("Default user-facing language: Khmer (km-KH)");
    expect(presets[0]?.members[0]?.instructions).toContain("CLI commands");
    expect(presets[0]?.members[0]?.instructions).toContain("JSON keys");
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

  it("adds Khmer relationship policy without removing original acceptance guidance", () => {
    const preset = getScenarioPresetById("software-dev");
    const engineer = preset?.members.find((member) => member.role === "engineer");

    expect(engineer?.relationship).toContain("Brief and report in Khmer by default");
    expect(engineer?.relationship).toContain("acceptance criteria");
    expect(engineer?.relationship).toContain("status values exact");
  });
});
