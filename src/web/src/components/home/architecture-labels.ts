import { Locale } from "@phneakngar/shared";

export const LANDING_ARCH_LABELS = {
  sectionLabel: {
    [Locale.KM]: "របៀបដំណើរការ",
    [Locale.EN]: "How it works",
  },
  heading: {
    [Locale.KM]: "ភ្នាក់ងារមូលដ្ឋាន ឈានទៅពិភពខាងក្រៅ",
    [Locale.EN]: "Agents go beyond the terminal",
  },
  description: {
    [Locale.KM]:
      "ភ្នាក់ងាររត់លើម៉ាស៊ីនរបស់អ្នក និងមានសិទ្ធិប្រើឧបករណ៍របស់អ្នក។ ភ្នាក់ងារ ភ្ជាប់វាទៅអ៊ីមែល ផ្ទាំងគ្រប់គ្រង និងពិភពខាងក្រៅ។",
    [Locale.EN]:
      "Agents run on your machine and have access to your tools. Phneakngar connects them to email, the dashboard, and the outside world.",
  },
  desktopWindow: {
    [Locale.KM]: "ភ្នាក់ងារ Desktop",
    [Locale.EN]: "Phneakngar Desktop",
  },
  mobileWindow: {
    [Locale.KM]: "ភ្នាក់ងារ Mobile",
    [Locale.EN]: "Phneakngar Mobile",
  },
  terminalWindow: {
    [Locale.KM]: "ម៉ាស៊ីនរបស់អ្នក",
    [Locale.EN]: "Your Machine",
  },
} as const;
