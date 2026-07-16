import { coreEntityLabels, Locale } from "@phneakngar/shared";
import type { TemplateCategory, TemplateScenarioGroupId } from "@/lib/templates";

export const TEMPLATES_LABELS = {
  nav: {
    templates: "គំរូ",
    blog: "ប្លុក",
    app: "កម្មវិធី",
    getStarted: "ចាប់ផ្តើម",
  },
  list: {
    title: "ចាប់ផ្តើមក្រុមហ៊ុនរបស់អ្នក",
    subheading:
      "សេណារីយ៉ូប្រចាំថ្ងៃ និងក្រុមហ៊ុន AI ដែលបានកំណត់ជាមុន។ ជ្រើសគំរូមួយ កែវាឱ្យសមនឹងអ្នក ហើយដាក់ឱ្យដំណើរការក្នុងពេលប៉ុន្មាននាទី។",
    allCategory: "ទាំងអស់",
    /** Chip key is English "Scenarios" for analytics; this is KM display. */
    scenariosFilter: "សេណារីយ៉ូ",
    emptyCategory: "មិនទាន់មានគំរូក្នុងប្រភេទនេះទេ។",
  },
  groups: {
    "helio-scenarios": {
      title: "សេណារីយ៉ូប្រចាំថ្ងៃ",
      blurb:
        "Day Planner, Task Digest, Inbox AI, Feedback Loop, Content Pipeline និង Research Brief — សម្រាប់ការងារប្រចាំថ្ងៃ។",
    },
  } as const,
  categories: {
    Developer: "អ្នកអភិវឌ្ឍន៍",
    "Content Creator": "អ្នកបង្កើតមាតិកា",
    "Knowledge Worker": "អ្នកចំណេះដឹង",
    Freelancer: "អ្នកឯករាជ្យ",
  } satisfies Record<TemplateCategory, string>,
  card: {
    use: "ប្រើ",
    /** Thin badge on Helio scenario cards */
    scenarioBadge: "សេណារីយ៉ូ",
  },
  detail: {
    useThisTemplate: "ប្រើគំរូនេះ",
    freeToDeploy: "ឥតគិតថ្លៃក្នុងការដាក់ឱ្យដំណើរការ",
    whatItDoes: "តើវាធ្វើអ្វីខ្លះ",
    useCases: "ករណីប្រើប្រាស់",
    yourCompany: "ក្រុមហ៊ុនរបស់អ្នក",
    readyToDeploy: "ត្រៀមដាក់ឱ្យដំណើរការហើយឬនៅ?",
    readyToDeploySubtext: "កែសម្រួលសេចក្តីណែនាំរបស់ភ្នាក់ងារបន្ទាប់ពីការដំឡើង។",
  },
  roles: {
    leader: "ប្រធាន",
    researcher: "អ្នកស្រាវជ្រាវ",
    engineer: "វិស្វករ",
    assistant: "ជំនួយការ",
  },
} as const;

export function templateCategoryLabel(category: string): string {
  return (
    TEMPLATES_LABELS.categories[category as TemplateCategory] ?? category
  );
}

/** Group heading for sectioned All-view (Helio + role categories). */
export function templateGroupLabel(groupId: TemplateScenarioGroupId | string): string {
  if (groupId === "helio-scenarios") {
    return TEMPLATES_LABELS.groups["helio-scenarios"].title;
  }
  return templateCategoryLabel(groupId);
}

export function templateGroupBlurb(groupId: TemplateScenarioGroupId | string): string | undefined {
  if (groupId === "helio-scenarios") {
    return TEMPLATES_LABELS.groups["helio-scenarios"].blurb;
  }
  return undefined;
}

/** Filter chip display: All / Scenarios / role categories. */
export function templateFilterLabel(filter: string): string {
  if (filter === "All") return TEMPLATES_LABELS.list.allCategory;
  if (filter === "Scenarios") return TEMPLATES_LABELS.list.scenariosFilter;
  return templateCategoryLabel(filter);
}

export function templateRoleLabel(role: string): string {
  return (
    TEMPLATES_LABELS.roles[role as keyof typeof TEMPLATES_LABELS.roles] ?? role
  );
}

export function templateAgentCountLabel(count: number): string {
  return `${count} ${coreEntityLabels.agent[Locale.KM]}`;
}

export function templateAgentsWorkingLabel(count: number): string {
  return `${count} ${coreEntityLabels.agent[Locale.KM]} ធ្វើការជាមួយគ្នា។`;
}
