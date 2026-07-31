import { describe, expect, it } from "vitest";
import { Locale } from "@phneakngar/shared";
import {
  TEMPLATES_LABELS,
  getTemplatesLabels,
  templateCategoryLabel,
  templateRoleLabel,
  templateAgentCountLabel,
  templateAgentsWorkingLabel,
  templateGroupLabel,
  templateGroupBlurb,
  templateFilterLabel,
} from "./templates-labels";

const isKhmer = (s: string) => /[ក-៿]/.test(s);

function flatten(obj: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const value of Object.values(obj)) {
    if (typeof value === "string") {
      out.push(value);
    } else if (value && typeof value === "object") {
      out.push(...flatten(value as Record<string, unknown>));
    }
  }
  return out;
}

describe("templates labels", () => {
  it("provides matching en/km label groups with no empty strings", () => {
    const en = flatten(TEMPLATES_LABELS[Locale.EN] as unknown as Record<string, unknown>);
    const km = flatten(TEMPLATES_LABELS[Locale.KM] as unknown as Record<string, unknown>);

    expect(en.length).toBeGreaterThan(0);
    expect(en.length).toBe(km.length);
    for (const value of [...en, ...km]) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
    expect(en.some((s) => /[\uFFFD]/.test(s))).toBe(false);
    expect(km.some((s) => /[\uFFFD]/.test(s))).toBe(false);
  });

  it("localizes helper labels to Khmer by default", () => {
    expect(getTemplatesLabels().list.title).toBe("ចាប់ផ្តើមក្រុមហ៊ុនរបស់អ្នក");
    expect(templateRoleLabel("leader")).toBe("ប្រធាន");
    expect(templateRoleLabel("researcher")).toBe("អ្នកស្រាវជ្រាវ");
    expect(templateRoleLabel("engineer")).toBe("វិស្វករ");
    expect(templateRoleLabel("assistant")).toBe("ជំនួយការ");
    expect(templateRoleLabel("unknown")).toBe("unknown");
  });

  it("maps category filter keys to localized display labels and falls back", () => {
    expect(templateCategoryLabel("Developer")).toBe("អ្នកអភិវឌ្ឍន៍");
    expect(templateCategoryLabel("Content Creator")).toBe("អ្នកបង្កើតមាតិកា");
    expect(templateCategoryLabel("Knowledge Worker")).toBe("អ្នកចំណេះដឹង");
    expect(templateCategoryLabel("Freelancer")).toBe("អ្នកឯករាជ្យ");
    expect(templateCategoryLabel("Unknown Cat")).toBe("Unknown Cat");

    expect(templateCategoryLabel("Developer", Locale.EN)).toBe("Developer");
    expect(templateCategoryLabel("Content Creator", Locale.EN)).toBe("Content Creator");
  });

  it("maps scenario group and filter labels with localized display and English fallbacks", () => {
    expect(templateGroupLabel("helio-scenarios")).toBe("សេណារីយ៉ូប្រចាំថ្ងៃ");
    expect(templateGroupLabel("Developer")).toBe("អ្នកអភិវឌ្ឍន៍");
    expect(templateGroupLabel("unknown-group")).toBe("unknown-group");
    expect(templateGroupBlurb("helio-scenarios")).toContain("Day Planner");
    expect(templateGroupBlurb("helio-scenarios")).toMatch(/Task Digest|Inbox AI/);
    expect(templateGroupBlurb("Developer")).toBeUndefined();
    expect(templateGroupBlurb("unknown-group")).toBeUndefined();

    expect(templateGroupLabel("helio-scenarios", Locale.EN)).toBe("Everyday scenarios");
    expect(templateGroupLabel("Developer", Locale.EN)).toBe("Developer");

    // Filter chip keys stay English ("All" / "Scenarios" / role); display is localized
    expect(templateFilterLabel("All")).toBe(TEMPLATES_LABELS[Locale.KM].list.allCategory);
    expect(templateFilterLabel("Scenarios")).toBe("សេណារីយ៉ូ");
    expect(templateFilterLabel("Freelancer")).toBe("អ្នកឯករាជ្យ");
    expect(templateFilterLabel("Unknown")).toBe("Unknown");

    expect(templateFilterLabel("All", Locale.EN)).toBe("All");
    expect(templateFilterLabel("Scenarios", Locale.EN)).toBe("Scenarios");
  });

  it("formats agent counts per locale", () => {
    expect(templateAgentCountLabel(4)).toBe("4 ភ្នាក់ងារ");
    expect(templateAgentCountLabel(4, Locale.EN)).toBe("4 agents");
    expect(templateAgentCountLabel(1, Locale.EN)).toBe("1 agent");

    expect(templateAgentsWorkingLabel(4)).toBe("4 ភ្នាក់ងារ ធ្វើការជាមួយគ្នា។");
    expect(isKhmer(templateAgentsWorkingLabel(1))).toBe(true);
    expect(templateAgentsWorkingLabel(2, Locale.EN)).toBe("2 agents working together.");
    expect(templateAgentsWorkingLabel(1, Locale.EN)).toBe("1 agent working together.");
  });
});
