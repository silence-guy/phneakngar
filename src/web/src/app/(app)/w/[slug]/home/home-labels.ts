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
} as const;

export const HOME_LAYOUT_LABELS: Record<LayoutType, string> = {
  star: HOME_LABELS.star,
  tree: HOME_LABELS.tree,
  flow: HOME_LABELS.flow,
};

export function homeLayoutLabel(layout: LayoutType): string {
  return HOME_LAYOUT_LABELS[layout];
}
