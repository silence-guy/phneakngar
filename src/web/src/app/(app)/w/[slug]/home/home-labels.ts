import type { LayoutType } from "@/components/canvas/auto-layout";

export const HOME_LABELS = {
  layout: "ប្លង់",
  star: "ផ្កាយ",
  tree: "មែកធាង",
  flow: "លំហូរ",
  dragHint: "អូសរវាងចំណុចភ្ជាប់ភ្នាក់ងារ ដើម្បីបង្កើតទំនាក់ទំនង។",
  createNewAgent: "បង្កើតភ្នាក់ងារថ្មី",
  buildYourCompany: "កសាងក្រុមហ៊ុន AI របស់អ្នក",
  getStarted: "ចាប់ផ្តើម",
  linkAlreadyExists: "ការតភ្ជាប់មានរួចហើយ",
  cannotLinkToSelf: "មិនអាចភ្ជាប់ភ្នាក់ងារទៅខ្លួនឯងបានទេ",
  createLinkFailed: "មិនអាចបង្កើតការតភ្ជាប់បានទេ",
  updateLinkFailed: "មិនអាចធ្វើបច្ចុប្បន្នភាពការតភ្ជាប់បានទេ",
  deleteLinkFailed: "មិនអាចលុបការតភ្ជាប់បានទេ",
  generateTokenFailed: "មិនអាចបង្កើតថូខឹនបានទេ",
  /** Member + no online machine: primary empty-state message */
  waitingForTeamComputer:
    "កន្លែងធ្វើការនេះត្រូវការកុំព្យូទ័ររបស់ក្រុមដែលភ្ជាប់ (ម្ចាស់ ឬសមាជិកផ្សេង)។ អ្នកអាចប្រើតាមគេហទំព័របានរួចហើយ—មិនចាំបាច់ដំឡើង CLI ដើម្បីចូលរួមទេ។",
  /** Member + machine online but no agents */
  waitingForAgents:
    "កុំព្យូទ័ររបស់ក្រុមបានភ្ជាប់ហើយ។ កំពុងរង់ចាំម្ចាស់បង្កើតភ្នាក់ងារ—អ្នកអាចរុករកតាមគេហទំព័របាន។",
  showOptionalConnect: "ភ្ជាប់កុំព្យូទ័រនេះ (ស្រេចចិត្ត)",
  hideOptionalConnect: "លាក់ការភ្ជាប់ស្រេចចិត្ត",
} as const;

export const HOME_LAYOUT_LABELS: Record<LayoutType, string> = {
  star: HOME_LABELS.star,
  tree: HOME_LABELS.tree,
  flow: HOME_LABELS.flow,
};

export function homeLayoutLabel(layout: LayoutType): string {
  return HOME_LAYOUT_LABELS[layout];
}
