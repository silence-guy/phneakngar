import { Locale } from "@phneakngar/shared";

export const LANDING_QUICKSTART_LABELS = {
  sectionLabel: {
    [Locale.KM]: "បើកចំហ និង host ដោយខ្លួនឯង",
    [Locale.EN]: "Open source, self-hosted",
  },
  heading: {
    [Locale.KM]: "គ្រប់គ្រងហេដ្ឋារចនាសម្ព័ន្ធរបស់អ្នក",
    [Locale.EN]: "Own your infrastructure",
  },
  description: {
    [Locale.KM]:
      "ភ្នាក់ងារ is fully open source. Self-host the entire platform, keep your data private, and run your AI company on hardware you control.",
    [Locale.EN]:
      "Phneakngar is fully open source. Self-host the entire platform, keep your data private, and run your AI company on hardware you control.",
  },
  points: {
    [Locale.KM]: [
      "ម៉ាស៊ីនរបស់អ្នក ច្បាប់របស់អ្នក",
      "មិនជាប់អ្នកផ្គត់ផ្គង់ណាមួយ",
      "ពាក្យបញ្ជាមួយដើម្បីចាប់ផ្តើម",
    ],
    [Locale.EN]: [
      "Your machine, your rules",
      "No vendor lock-in",
      "One command to get started",
    ],
  },
  cta: {
    [Locale.KM]: "ចាប់ផ្តើមក្រុមហ៊ុនរបស់អ្នក",
    [Locale.EN]: "Start your company",
  },
} as const;
