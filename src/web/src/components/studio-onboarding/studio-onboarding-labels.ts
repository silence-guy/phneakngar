import { coreEntityLabels, Locale } from "@phneakngar/shared";
import type { MemberRole } from "./scenario-presets";

export const STUDIO_ONBOARDING_LABELS = {
  nav: {
    workspaces: "កន្លែងការងារ",
    signOut: "ចេញ",
    back: "ត្រឡប់ក្រោយ",
  },
  scenario: {
    question: "តើក្រុមហ៊ុនរបស់អ្នកនឹងធ្វើអ្វី?",
    subheading: "ជ្រើសផ្នែកផ្តោតមួយ។ អ្នកអាចបន្ថែមភ្នាក់ងារបន្ថែមនៅពេលក្រោយបាន។",
    skipForNow: "រំលងសិន",
  },
  build: {
    title: "បង្កើតក្រុមហ៊ុនរបស់អ្នក",
    connectComputer: "ភ្ជាប់កុំព្យូទ័រ",
    computerConnected: "កុំព្យូទ័របានភ្ជាប់",
    needsComputer: "ក្រុមហ៊ុនរបស់អ្នកត្រូវការកុំព្យូទ័រដែលបានភ្ជាប់ ដើម្បីដំណើរការភារកិច្ច។",
    needsComputerMember:
      "កន្លែងធ្វើការនេះត្រូវការកុំព្យូទ័រក្រុមនៅបណ្តាញ។ សុំម្ចាស់ភ្ជាប់ ម៉ាស៊ីន ឬភ្ជាប់ម៉ាស៊ីននេះ (ស្រេចចិត្ត)។",
    launching: "កំពុងបើកដំណើរការ...",
    launchCompany: "បើកដំណើរការក្រុមហ៊ុន",
  },
  team: {
    yourCompany: "ក្រុមហ៊ុនរបស់អ្នក",
    shuffle: "បង្កើតឡើងវិញ",
    selectFallback: "ជ្រើសរើស",
  },
  roles: {
    leader: "ប្រធាន",
    researcher: "អ្នកស្រាវជ្រាវ",
    engineer: "វិស្វករ",
    assistant: "ជំនួយការ",
  },
} as const;

export function studioRoleLabel(role: MemberRole): string {
  return STUDIO_ONBOARDING_LABELS.roles[role];
}

export function studioAgentCountLabel(count: number): string {
  return `${count} ${coreEntityLabels.agent[Locale.KM]}`;
}
