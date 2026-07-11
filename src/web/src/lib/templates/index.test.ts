import { describe, expect, it } from "vitest";
import { Locale } from "@phneakngar/shared";
import {
  TEMPLATES,
  TEMPLATES_KM,
  getTemplateById,
  getTemplates,
} from "./index";

describe("template localization", () => {
  it("keeps the raw template registry in English", () => {
    expect(TEMPLATES[0]?.name).toBe("Open Source Maintainer");
    expect(getTemplates(Locale.EN)).toBe(TEMPLATES);
  });

  it("returns Khmer templates by default with Khmer instruction body", () => {
    const template = getTemplateById("open-source-maintainer");

    expect(template?.name).toBe("អ្នកថែទាំគម្រោង Open Source");
    expect(template?.description).toContain("PR");
    expect(template?.members[0]?.instructions).toContain("ភាសាលំនាំសម្រាប់អ្នកប្រើ");
    expect(template?.members[0]?.instructions).toContain("អ្នកជាអ្នកដឹកនាំ");
    expect(template?.members[0]?.instructions).toContain("CLI commands");
    expect(template?.members[0]?.instructions).toContain("JSON keys");
    // Must not keep English preset body as the main instructions
    expect(template?.members[0]?.instructions).not.toContain("You are the lead maintainer coordinator");
    expect(template?.members[0]?.instructions).not.toMatch(/match that recipient/i);
  });

  it("preserves stable template ids, scenarios, roles, and member counts", () => {
    expect(TEMPLATES_KM).toHaveLength(TEMPLATES.length);

    for (const [index, template] of TEMPLATES.entries()) {
      const khmerTemplate = TEMPLATES_KM[index];
      expect(khmerTemplate?.id).toBe(template.id);
      expect(khmerTemplate?.category).toBe(template.category);
      expect(khmerTemplate?.baseScenario).toBe(template.baseScenario);
      expect(khmerTemplate?.members.map((member) => member.role)).toEqual(
        template.members.map((member) => member.role),
      );
    }
  });

  it("preserves English template access for compatibility", () => {
    const template = getTemplateById("research-analyst", Locale.EN);

    expect(template?.name).toBe("Research Analyst");
    expect(template?.members[0]?.instructions).not.toContain("km-KH");
  });

  it("uses Khmer relationship guidance for engineer role", () => {
    const template = getTemplateById("open-source-maintainer");
    const engineer = template?.members.find((member) => member.role === "engineer");

    expect(engineer?.relationship).toContain("ជាភាសាខ្មែរ");
    expect(engineer?.relationship).toContain("acceptance criteria");
    expect(engineer?.relationship).toContain("files changed");
    expect(engineer?.instructions).toContain("អ្នកជាវិស្វករអនុវត្ត");
  });
});
