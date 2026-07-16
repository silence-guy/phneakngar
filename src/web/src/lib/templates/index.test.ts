import { describe, expect, it } from "vitest";
import { Locale } from "@phneakngar/shared";
import {
  TEMPLATES,
  TEMPLATES_KM,
  HELIO_SCENARIO_TEMPLATE_IDS,
  getTemplateById,
  getTemplates,
} from "./index";

describe("template localization", () => {
  it("keeps the raw template registry in English", () => {
    expect(TEMPLATES[0]?.name).toBe("Day Planner");
    expect(getTemplates(Locale.EN)).toBe(TEMPLATES);
  });

  it("registers Helio scenario presets near the top of the registry", () => {
    expect(TEMPLATES.slice(0, HELIO_SCENARIO_TEMPLATE_IDS.length).map((t) => t.id)).toEqual([
      ...HELIO_SCENARIO_TEMPLATE_IDS,
    ]);

    for (const id of HELIO_SCENARIO_TEMPLATE_IDS) {
      const template = getTemplateById(id, Locale.EN);
      expect(template?.baseScenario).toBeTruthy();
      expect(template?.tags).toEqual(expect.arrayContaining(["helio", "scenario"]));
      expect(template?.members.length).toBeGreaterThan(0);
      expect(template?.members[0]?.instructions.length).toBeGreaterThan(80);
      // Studio deep-link ids remain the stable registry ids
      expect([...HELIO_SCENARIO_TEMPLATE_IDS]).toContain(template!.id);
    }
  });

  it("still loads Helio scenario presets after grouping exports exist", () => {
    // Grouping layer must not break getTemplates / getTemplateById resolution
    const list = getTemplates(Locale.EN);
    for (const id of HELIO_SCENARIO_TEMPLATE_IDS) {
      expect(list.some((t) => t.id === id)).toBe(true);
      const t = getTemplateById(id, Locale.EN);
      expect(t).toBeDefined();
      expect(t!.features.length).toBeGreaterThan(0);
      expect(t!.useCases.length).toBeGreaterThan(0);
      expect(t!.longDescription.length).toBeGreaterThan(40);
    }
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

  it("localizes Helio scenario names in Khmer", () => {
    expect(getTemplateById("day-planner")?.name).toBe("អ្នករៀបចំថ្ងៃ");
    expect(getTemplateById("task-digest")?.name).toBe("សង្ខេបភារកិច្ច");
    expect(getTemplateById("inbox-ai")?.name).toBe("Inbox AI");
    expect(getTemplateById("feedback-loop")?.name).toBe("រង្វិលជុំមតិ");
    expect(getTemplateById("content-pipeline")?.name).toBe("បំពង់ខ្លឹមសារ");
    expect(getTemplateById("research-brief")?.name).toBe("សង្ខេបស្រាវជ្រាវ");
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
