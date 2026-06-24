import { describe, expect, it } from "vitest";
import { Locale } from "@alook/shared";
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

  it("returns Khmer templates by default", () => {
    const template = getTemplateById("open-source-maintainer");

    expect(template?.name).toBe("អ្នកថែទាំគម្រោង Open Source");
    expect(template?.description).toContain("PR");
    expect(template?.members[0]?.instructions).toContain("Default user-facing language: Khmer (km-KH)");
    expect(template?.members[0]?.instructions).toContain("CLI commands");
    expect(template?.members[0]?.instructions).toContain("JSON keys");
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

  it("adds Khmer relationship policy without changing original technical guidance", () => {
    const template = getTemplateById("open-source-maintainer");
    const engineer = template?.members.find((member) => member.role === "engineer");

    expect(engineer?.relationship).toContain("Brief and report in Khmer by default");
    expect(engineer?.relationship).toContain("PR/issue link");
    expect(engineer?.relationship).toContain("status values exact");
  });
});
