import { coreEntityLabels, Locale } from "@phneakngar/shared";

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
