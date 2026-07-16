import type {
  HelioScenarioTemplateId,
  TemplateCategory,
  TemplateFilterId,
  TemplatePreset,
  TemplateScenarioGroupId,
} from "./types";
import {
  HELIO_SCENARIO_TEMPLATE_IDS,
  TEMPLATE_CATEGORIES,
  TEMPLATE_SCENARIO_GROUP_ORDER,
} from "./types";

const HELIO_ID_SET = new Set<string>(HELIO_SCENARIO_TEMPLATE_IDS);

export interface TemplateGroup {
  id: TemplateScenarioGroupId;
  templates: TemplatePreset[];
}

/** True for Helio scenario presets (day-planner … research-brief). */
export function isHelioScenario(template: Pick<TemplatePreset, "id" | "tags">): boolean {
  if (HELIO_ID_SET.has(template.id)) return true;
  return template.tags.includes("helio") && template.tags.includes("scenario");
}

/**
 * Partition templates into exclusive groups for All-view sections.
 * Helio scenarios appear only under `helio-scenarios`; remaining templates
 * are bucketed by role `category` in TEMPLATE_CATEGORIES order.
 * Each input template appears in exactly one returned group (when non-empty groups only).
 */
export function getTemplateGroups(templates: TemplatePreset[]): TemplateGroup[] {
  const helio: TemplatePreset[] = [];
  const byCategory = new Map<TemplateCategory, TemplatePreset[]>();
  for (const category of TEMPLATE_CATEGORIES) {
    byCategory.set(category, []);
  }

  for (const template of templates) {
    if (isHelioScenario(template)) {
      helio.push(template);
      continue;
    }
    byCategory.get(template.category)?.push(template);
  }

  // Preserve registry order within Helio via HELIO_SCENARIO_TEMPLATE_IDS when possible
  const helioOrder = new Map(
    HELIO_SCENARIO_TEMPLATE_IDS.map((id, index) => [id, index] as const),
  );
  helio.sort((a, b) => {
    const ai = helioOrder.get(a.id as HelioScenarioTemplateId) ?? Number.MAX_SAFE_INTEGER;
    const bi = helioOrder.get(b.id as HelioScenarioTemplateId) ?? Number.MAX_SAFE_INTEGER;
    return ai - bi;
  });

  const groups: TemplateGroup[] = [];
  for (const id of TEMPLATE_SCENARIO_GROUP_ORDER) {
    if (id === "helio-scenarios") {
      if (helio.length > 0) {
        groups.push({ id, templates: helio });
      }
      continue;
    }
    const items = byCategory.get(id) ?? [];
    if (items.length > 0) {
      groups.push({ id, templates: items });
    }
  }
  return groups;
}

/**
 * Flat filter for chips.
 * - All: full list (UI uses sections separately)
 * - Scenarios: Helio scenario set only
 * - Role categories: match template.category (Helio Knowledge Worker items remain)
 */
export function filterTemplatesByChip(
  templates: TemplatePreset[],
  filter: TemplateFilterId,
): TemplatePreset[] {
  if (filter === "All") return templates;
  if (filter === "Scenarios") {
    return templates.filter(isHelioScenario);
  }
  return templates.filter((t) => t.category === filter);
}

export { HELIO_SCENARIO_TEMPLATE_IDS, TEMPLATE_SCENARIO_GROUP_ORDER };
