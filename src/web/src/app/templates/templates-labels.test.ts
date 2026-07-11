import { describe, expect, it } from "vitest";
import {
  TEMPLATES_LABELS,
  templateCategoryLabel,
  templateRoleLabel,
  templateAgentCountLabel,
  templateAgentsWorkingLabel,
} from "./templates-labels";

const isKhmer = (s: string) => /[ក-៿]/.test(s);

describe("templates labels", () => {
  it("localizes nav, list, card, categories, and detail strings to Khmer", () => {
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

  it("formats agent counts with the Khmer agent noun", () => {
    expect(templateAgentCountLabel(4)).toBe("4 ភ្នាក់ងារ");
    expect(templateAgentsWorkingLabel(4)).toBe("4 ភ្នាក់ងារ ធ្វើការជាមួយគ្នា។");
    expect(isKhmer(templateAgentsWorkingLabel(1))).toBe(true);
  });
});
