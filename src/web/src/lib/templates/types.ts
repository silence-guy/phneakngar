import type { ScenarioMemberPreset, ScenarioId } from "@/components/studio-onboarding/scenario-presets";

export type TemplateCategory = "Developer" | "Content Creator" | "Knowledge Worker" | "Freelancer";

/** Orthogonal list/group id — does not replace TemplateCategory role chips. */
export type TemplateScenarioGroupId = "helio-scenarios" | TemplateCategory;

/** Stable English filter key for analytics; display is localized separately. */
export type TemplateFilterId = "All" | "Scenarios" | TemplateCategory;

export const HELIO_SCENARIO_TEMPLATE_IDS = [
  "day-planner",
  "task-digest",
  "inbox-ai",
  "feedback-loop",
  "content-pipeline",
  "research-brief",
] as const;

export type HelioScenarioTemplateId = (typeof HELIO_SCENARIO_TEMPLATE_IDS)[number];

export interface TemplatePreset {
  id: string;
  name: string;
  description: string;
  longDescription: string;
  category: TemplateCategory;
  icon: string;
  tags: string[];
  features: string[];
  useCases: { title: string; description: string }[];
  baseScenario: ScenarioId;
  members: ScenarioMemberPreset[];
}

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  "Developer",
  "Content Creator",
  "Knowledge Worker",
  "Freelancer",
];

/** Ordered sections for All-view browsing (Helio scenarios first, then role categories). */
export const TEMPLATE_SCENARIO_GROUP_ORDER: TemplateScenarioGroupId[] = [
  "helio-scenarios",
  ...TEMPLATE_CATEGORIES,
];
