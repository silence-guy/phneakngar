import { describe, expect, it } from "vitest";
import {
  TEMPLATES_LABELS,
  templateCategoryLabel,
  templateRoleLabel,
  templateAgentCountLabel,
  templateAgentsWorkingLabel,
  templateGroupLabel,
  templateGroupBlurb,
  templateFilterLabel,
} from "./templates-labels";

const isKhmer = (s: string) => /[ក-៿]/.test(s);

describe("templates labels", () => {
  it("localizes nav, list, card, categories, groups, and detail strings to Khmer", () => {
    const groups = [
      TEMPLATES_LABELS.nav,
      TEMPLATES_LABELS.list,
      TEMPLATES_LABELS.card,
      TEMPLATES_LABELS.categories,
      TEMPLATES_LABELS.detail,
    ];
    for (const group of groups) {
      for (const value of Object.values(group)) {
        expect(isKhmer(value)).toBe(true);
      }
    }
    expect(isKhmer(TEMPLATES_LABELS.groups["helio-scenarios"].title)).toBe(true);
    expect(isKhmer(TEMPLATES_LABELS.groups["helio-scenarios"].blurb)).toBe(true);
  });

  it("maps stable role ids to Khmer display labels and falls back to the raw id", () => {
    expect(templateRoleLabel("leader")).toBe("ប្រធាន");
    expect(templateRoleLabel("researcher")).toBe("អ្នកស្រាវជ្រាវ");
    expect(templateRoleLabel("engineer")).toBe("វិស្វករ");
    expect(templateRoleLabel("assistant")).toBe("ជំនួយការ");
    expect(templateRoleLabel("unknown")).toBe("unknown");
  });

  it("maps category filter keys to Khmer display labels and falls back", () => {
    expect(templateCategoryLabel("Developer")).toBe("អ្នកអភិវឌ្ឍន៍");
    expect(templateCategoryLabel("Content Creator")).toBe("អ្នកបង្កើតមាតិកា");
    expect(templateCategoryLabel("Knowledge Worker")).toBe("អ្នកចំណេះដឹង");
    expect(templateCategoryLabel("Freelancer")).toBe("អ្នកឯករាជ្យ");
    expect(templateCategoryLabel("Unknown Cat")).toBe("Unknown Cat");
  });

  it("maps scenario group and filter labels with Khmer display and English fallbacks", () => {
    expect(templateGroupLabel("helio-scenarios")).toBe("សេណារីយ៉ូប្រចាំថ្ងៃ");
    expect(templateGroupLabel("Developer")).toBe("អ្នកអភិវឌ្ឍន៍");
    expect(templateGroupLabel("unknown-group")).toBe("unknown-group");
    expect(templateGroupBlurb("helio-scenarios")).toContain("Day Planner");
    expect(templateGroupBlurb("helio-scenarios")).toMatch(/Task Digest|Inbox AI/);
    expect(templateGroupBlurb("Developer")).toBeUndefined();
    expect(templateGroupBlurb("unknown-group")).toBeUndefined();

    // Filter chip keys stay English ("All" / "Scenarios" / role); display is Khmer
    expect(templateFilterLabel("All")).toBe(TEMPLATES_LABELS.list.allCategory);
    expect(templateFilterLabel("Scenarios")).toBe(TEMPLATES_LABELS.list.scenariosFilter);
    expect(templateFilterLabel("Scenarios")).toBe("សេណារីយ៉ូ");
    expect(templateFilterLabel("Freelancer")).toBe("អ្នកឯករាជ្យ");
    expect(templateFilterLabel("Unknown")).toBe("Unknown");

    // Thin card badge for Helio scenarios
    expect(TEMPLATES_LABELS.card.scenarioBadge).toBe("សេណារីយ៉ូ");
    expect(isKhmer(TEMPLATES_LABELS.card.scenarioBadge)).toBe(true);
  });

  it("formats agent counts with the Khmer agent noun", () => {
    expect(templateAgentCountLabel(4)).toBe("4 ភ្នាក់ងារ");
    expect(templateAgentsWorkingLabel(4)).toBe("4 ភ្នាក់ងារ ធ្វើការជាមួយគ្នា។");
    expect(isKhmer(templateAgentsWorkingLabel(1))).toBe(true);
  });
});
