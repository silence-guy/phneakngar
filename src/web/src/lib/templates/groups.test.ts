import { describe, expect, it } from "vitest";
import { TEMPLATES, getTemplateById } from "./index";
import {
  filterTemplatesByChip,
  getTemplateGroups,
  HELIO_SCENARIO_TEMPLATE_IDS,
  isHelioScenario,
  TEMPLATE_SCENARIO_GROUP_ORDER,
} from "./groups";
import {
  TEMPLATE_CATEGORIES,
  type TemplatePreset,
  type TemplateCategory,
} from "./types";

function minimalTemplate(
  partial: Pick<TemplatePreset, "id" | "category" | "tags"> &
    Partial<TemplatePreset>,
): TemplatePreset {
  return {
    name: partial.name ?? partial.id,
    description: partial.description ?? "",
    longDescription: partial.longDescription ?? "",
    icon: partial.icon ?? "•",
    features: partial.features ?? [],
    useCases: partial.useCases ?? [],
    baseScenario: partial.baseScenario ?? "personal-assistant",
    members: partial.members ?? [
      {
        role: "leader",
        description: "leader",
        instructions: "x".repeat(90),
      },
    ],
    ...partial,
  };
}

describe("template groups", () => {
  it("identifies Helio scenarios by id and by helio+scenario tags", () => {
    for (const id of HELIO_SCENARIO_TEMPLATE_IDS) {
      const template = TEMPLATES.find((t) => t.id === id);
      expect(template).toBeDefined();
      expect(isHelioScenario(template!)).toBe(true);
    }
    expect(
      isHelioScenario({
        id: "custom-helio",
        tags: ["helio", "scenario"],
      }),
    ).toBe(true);
    // Id match without tags still counts (stable registry ids)
    expect(
      isHelioScenario({
        id: "day-planner",
        tags: [],
      }),
    ).toBe(true);
    expect(
      isHelioScenario({
        id: "open-source-maintainer",
        tags: ["github", "pr"],
      }),
    ).toBe(false);
  });

  it("rejects partial tags (only helio or only scenario) unless id is known", () => {
    expect(
      isHelioScenario({
        id: "maybe-helio",
        tags: ["helio"],
      }),
    ).toBe(false);
    expect(
      isHelioScenario({
        id: "maybe-scenario",
        tags: ["scenario"],
      }),
    ).toBe(false);
  });

  it("puts Helio ids only in helio-scenarios and partitions all TEMPLATES once", () => {
    const groups = getTemplateGroups(TEMPLATES);
    const helioGroup = groups.find((g) => g.id === "helio-scenarios");
    expect(helioGroup).toBeDefined();
    expect(helioGroup!.templates.map((t) => t.id)).toEqual([
      ...HELIO_SCENARIO_TEMPLATE_IDS,
    ]);

    const allIds = groups.flatMap((g) => g.templates.map((t) => t.id));
    expect(allIds).toHaveLength(TEMPLATES.length);
    expect(new Set(allIds).size).toBe(TEMPLATES.length);
    expect(allIds.sort()).toEqual(TEMPLATES.map((t) => t.id).sort());

    // Helio members must not reappear under Knowledge Worker in All-view sections
    const kw = groups.find((g) => g.id === "Knowledge Worker");
    for (const id of HELIO_SCENARIO_TEMPLATE_IDS) {
      expect(kw?.templates.some((t) => t.id === id) ?? false).toBe(false);
    }
  });

  it("renders All-view sections with expected Helio + role categories", () => {
    const groups = getTemplateGroups(TEMPLATES);
    const ids = groups.map((g) => g.id);

    // Helio scenario group first with registry order (HELIO_SCENARIO_TEMPLATE_IDS)
    expect(ids[0]).toBe("helio-scenarios");
    expect(groups[0]!.templates.map((t) => t.id)).toEqual([
      ...HELIO_SCENARIO_TEMPLATE_IDS,
    ]);

    // Remaining sections are role categories only (subset of TEMPLATE_CATEGORIES)
    const roleIds = ids.slice(1);
    expect(roleIds.every((id) => TEMPLATE_CATEGORIES.includes(id as TemplateCategory))).toBe(
      true,
    );
    // Every registered role that still has non-helio members appears
    for (const category of TEMPLATE_CATEGORIES) {
      const nonHelioInCategory = TEMPLATES.filter(
        (t) => t.category === category && !isHelioScenario(t),
      );
      if (nonHelioInCategory.length > 0) {
        expect(roleIds).toContain(category);
      }
    }

    // Group order constant stays helio-first then categories
    expect(TEMPLATE_SCENARIO_GROUP_ORDER[0]).toBe("helio-scenarios");
    expect(TEMPLATE_SCENARIO_GROUP_ORDER.slice(1)).toEqual([...TEMPLATE_CATEGORIES]);
  });

  it("keeps stable group order: helio first, then TEMPLATE_CATEGORIES", () => {
    const groups = getTemplateGroups(TEMPLATES);
    expect(groups[0]?.id).toBe("helio-scenarios");
    const roleIds = groups.slice(1).map((g) => g.id);
    // Role groups appear in TEMPLATE_CATEGORIES relative order
    for (let i = 1; i < roleIds.length; i++) {
      const prev = roleIds[i - 1]!;
      const cur = roleIds[i]!;
      const order = ["Developer", "Content Creator", "Knowledge Worker", "Freelancer"];
      expect(order.indexOf(prev as string)).toBeLessThan(order.indexOf(cur as string));
    }
  });

  it("reorders shuffled Helio input to HELIO_SCENARIO_TEMPLATE_IDS sequence", () => {
    const shuffled = [
      TEMPLATES.find((t) => t.id === "research-brief")!,
      TEMPLATES.find((t) => t.id === "inbox-ai")!,
      TEMPLATES.find((t) => t.id === "content-pipeline")!,
      TEMPLATES.find((t) => t.id === "day-planner")!,
      TEMPLATES.find((t) => t.id === "feedback-loop")!,
      TEMPLATES.find((t) => t.id === "task-digest")!,
    ];
    const groups = getTemplateGroups(shuffled);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.id).toBe("helio-scenarios");
    expect(groups[0]!.templates.map((t) => t.id)).toEqual([
      ...HELIO_SCENARIO_TEMPLATE_IDS,
    ]);
  });

  it("appends tag-only Helio scenarios after known registry ids", () => {
    const custom = minimalTemplate({
      id: "custom-helio-scenario",
      category: "Developer",
      tags: ["helio", "scenario"],
    });
    const groups = getTemplateGroups([
      custom,
      TEMPLATES.find((t) => t.id === "inbox-ai")!,
      TEMPLATES.find((t) => t.id === "day-planner")!,
    ]);
    const helio = groups.find((g) => g.id === "helio-scenarios");
    expect(helio?.templates.map((t) => t.id)).toEqual([
      "day-planner",
      "inbox-ai",
      "custom-helio-scenario",
    ]);
    // Tag-only Helio must not also appear under its role category
    expect(groups.some((g) => g.id === "Developer")).toBe(false);
  });

  it("filters Scenarios to the helio set only", () => {
    const filtered = filterTemplatesByChip(TEMPLATES, "Scenarios");
    expect(filtered.map((t) => t.id)).toEqual([...HELIO_SCENARIO_TEMPLATE_IDS]);
    expect(filtered.every(isHelioScenario)).toBe(true);
  });

  it("keeps role filters on category field (Helio appear under their own category chip)", () => {
    const kw = filterTemplatesByChip(TEMPLATES, "Knowledge Worker");
    expect(kw.every((t) => t.category === "Knowledge Worker")).toBe(true);
    // Core Knowledge Worker Helio scenarios remain on the KW chip
    for (const id of [
      "day-planner",
      "task-digest",
      "inbox-ai",
      "feedback-loop",
      "research-brief",
    ] as const) {
      expect(kw.some((t) => t.id === id)).toBe(true);
    }
    // Content-pipeline is Helio but categorized as Content Creator
    const content = filterTemplatesByChip(TEMPLATES, "Content Creator");
    expect(content.some((t) => t.id === "content-pipeline")).toBe(true);
    expect(content.every((t) => t.category === "Content Creator")).toBe(true);
  });

  it("keeps Developer and Freelancer chips free of Helio ids", () => {
    for (const category of ["Developer", "Freelancer"] as const) {
      const filtered = filterTemplatesByChip(TEMPLATES, category);
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every((t) => t.category === category)).toBe(true);
      for (const id of HELIO_SCENARIO_TEMPLATE_IDS) {
        expect(filtered.some((t) => t.id === id)).toBe(false);
      }
    }
  });

  it("returns full list for All filter without cloning", () => {
    expect(filterTemplatesByChip(TEMPLATES, "All")).toBe(TEMPLATES);
  });

  it("handles empty input", () => {
    expect(getTemplateGroups([])).toEqual([]);
    expect(filterTemplatesByChip([], "Scenarios")).toEqual([]);
  });

  it("does not drop non-helio templates when building groups", () => {
    const sample: TemplatePreset[] = TEMPLATES.filter(
      (t) => !HELIO_SCENARIO_TEMPLATE_IDS.includes(t.id as (typeof HELIO_SCENARIO_TEMPLATE_IDS)[number]),
    ).slice(0, 2);
    const groups = getTemplateGroups(sample);
    expect(groups.every((g) => g.id !== "helio-scenarios")).toBe(true);
    expect(groups.flatMap((g) => g.templates)).toHaveLength(sample.length);
  });

  it("keeps Helio studio template ids stable after grouping", () => {
    // Studio URLs use these ids: /studio/new?template=<id>
    expect([...HELIO_SCENARIO_TEMPLATE_IDS]).toEqual([
      "day-planner",
      "task-digest",
      "inbox-ai",
      "feedback-loop",
      "content-pipeline",
      "research-brief",
    ]);
    for (const id of HELIO_SCENARIO_TEMPLATE_IDS) {
      const byId = getTemplateById(id, "en");
      expect(byId?.id).toBe(id);
      expect(byId?.members.length).toBeGreaterThan(0);
      expect(byId?.baseScenario).toBeTruthy();
    }
    // Grouping does not rename or remove registry presets
    const groupedIds = getTemplateGroups(TEMPLATES)
      .find((g) => g.id === "helio-scenarios")!
      .templates.map((t) => t.id);
    expect(groupedIds).toEqual([
      "day-planner",
      "task-digest",
      "inbox-ai",
      "feedback-loop",
      "content-pipeline",
      "research-brief",
    ]);
  });
});
