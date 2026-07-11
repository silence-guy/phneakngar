import { coreEntityLabels, Locale } from "@phneakngar/shared";
import type { TemplateCategory } from "@/lib/templates";

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
      "ក្រុមហ៊ុន AI ដែលបានកំណត់ជាមុន រួចរាល់ដើម្បីធ្វើការ។ ជ្រើសគំរូមួយ កែវាឱ្យសមនឹងអ្នក ហើយដាក់ឱ្យដំណើរការក្នុងពេលប៉ុន្មាននាទី។",
    allCategory: "ទាំងអស់",
    emptyCategory: "មិនទាន់មានគំរូក្នុងប្រភេទនេះទេ។",
  },
  categories: {
    Developer: "អ្នកអភិវឌ្ឍន៍",
    "Content Creator": "អ្នកបង្កើតមាតិកា",
    "Knowledge Worker": "អ្នកចំណេះដឹង",
    Freelancer: "អ្នកឯករាជ្យ",
  } satisfies Record<TemplateCategory, string>,
  card: {
    use: "ប្រើ",
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
