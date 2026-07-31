import { Locale, defaultLocale, resolveLocale, type Locale as SharedLocale } from "@phneakngar/shared";
import { formatAgentCount } from "@/lib/locale";
import type { TemplateCategory, TemplateScenarioGroupId } from "@/lib/templates";

type TemplatesLabels = {
  nav: {
    templates: string;
    blog: string;
    app: string;
    getStarted: string;
  };
  list: {
    title: string;
    subheading: string;
    allCategory: string;
    scenariosFilter: string;
    emptyCategory: string;
  };
  groups: {
    "helio-scenarios": {
      title: string;
      blurb: string;
    };
  };
  categories: Record<TemplateCategory, string>;
  card: {
    use: string;
    scenarioBadge: string;
  };
  detail: {
    useThisTemplate: string;
    freeToDeploy: string;
    whatItDoes: string;
    useCases: string;
    yourCompany: string;
    readyToDeploy: string;
    readyToDeploySubtext: string;
  };
  roles: {
    leader: string;
    researcher: string;
    engineer: string;
    assistant: string;
  };
};

export const TEMPLATES_LABELS = {
  [Locale.KM]: {
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
    },
    categories: {
      Developer: "អ្នកអភិវឌ្ឍន៍",
      "Content Creator": "អ្នកបង្កើតមាតិកា",
      "Knowledge Worker": "អ្នកចំណេះដឹង",
      Freelancer: "អ្នកឯករាជ្យ",
    } satisfies Record<TemplateCategory, string>,
    card: {
      use: "ប្រើ",
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
  },
  [Locale.EN]: {
    nav: {
      templates: "Templates",
      blog: "Blog",
      app: "App",
      getStarted: "Get Started",
    },
    list: {
      title: "Start your company",
      subheading:
        "Everyday scenarios and pre-built AI companies. Pick a template, make it yours, and deploy in minutes.",
      allCategory: "All",
      scenariosFilter: "Scenarios",
      emptyCategory: "No templates in this category yet.",
    },
    groups: {
      "helio-scenarios": {
        title: "Everyday scenarios",
        blurb:
          "Day Planner, Task Digest, Inbox AI, Feedback Loop, Content Pipeline and Research Brief — for everyday work.",
      },
    },
    categories: {
      Developer: "Developer",
      "Content Creator": "Content Creator",
      "Knowledge Worker": "Knowledge Worker",
      Freelancer: "Freelancer",
    } satisfies Record<TemplateCategory, string>,
    card: {
      use: "Use",
      scenarioBadge: "Scenario",
    },
    detail: {
      useThisTemplate: "Use this template",
      freeToDeploy: "Free to deploy",
      whatItDoes: "What it does",
      useCases: "Use cases",
      yourCompany: "Your company",
      readyToDeploy: "Ready to deploy?",
      readyToDeploySubtext: "Customize agent instructions after setup.",
    },
    roles: {
      leader: "Leader",
      researcher: "Researcher",
      engineer: "Engineer",
      assistant: "Assistant",
    },
  },
} as const satisfies Record<SharedLocale, TemplatesLabels>;

export function getTemplatesLabels(locale?: string | null): TemplatesLabels {
  return TEMPLATES_LABELS[resolveLocale(locale)];
}

export function templateCategoryLabel(category: string, locale?: string | null): string {
  return getTemplatesLabels(locale).categories[category as TemplateCategory] ?? category;
}

/** Group heading for sectioned All-view (Helio + role categories). */
export function templateGroupLabel(groupId: TemplateScenarioGroupId | string, locale?: string | null): string {
  if (groupId === "helio-scenarios") {
    return getTemplatesLabels(locale).groups["helio-scenarios"].title;
  }
  return templateCategoryLabel(groupId, locale);
}

export function templateGroupBlurb(
  groupId: TemplateScenarioGroupId | string,
  locale?: string | null,
): string | undefined {
  if (groupId === "helio-scenarios") {
    return getTemplatesLabels(locale).groups["helio-scenarios"].blurb;
  }
  return undefined;
}

/** Filter chip display: All / Scenarios / role categories. */
export function templateFilterLabel(filter: string, locale?: string | null): string {
  const labels = getTemplatesLabels(locale);
  if (filter === "All") return labels.list.allCategory;
  if (filter === "Scenarios") return labels.list.scenariosFilter;
  return templateCategoryLabel(filter, locale);
}

export function templateRoleLabel(role: string, locale?: string | null): string {
  return getTemplatesLabels(locale).roles[role as keyof TemplatesLabels["roles"]] ?? role;
}

export function templateAgentCountLabel(count: number, locale?: string | null): string {
  return formatAgentCount(count, locale);
}

export function templateAgentsWorkingLabel(count: number, locale?: string | null): string {
  const resolved = resolveLocale(locale);
  const agents = formatAgentCount(count, resolved);
  return resolved === Locale.EN
    ? `${agents} working together.`
    : `${agents} ធ្វើការជាមួយគ្នា។`;
}

export { defaultLocale };
