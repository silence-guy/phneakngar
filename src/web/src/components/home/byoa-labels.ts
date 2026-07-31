import { Locale } from "@phneakngar/shared";

export const LANDING_BYOA_LABELS = {
  sectionLabel: {
    [Locale.KM]: "មិនជាប់នឹងភ្នាក់ងារតែមួយ",
    [Locale.EN]: "Not locked into a single agent",
  },
  heading: {
    [Locale.KM]: "យកភ្នាក់ងារដែលអ្នកទុកចិត្តមកប្រើ",
    [Locale.EN]: "Bring your own agent",
  },
  description: {
    [Locale.KM]:
      "ភ្នាក់ងារ គឺជាស្រទាប់សម្របសម្រួល។ ជ្រើសភ្នាក់ងារដែលអ្នកទុកចិត្ត — យើងផ្តល់តួនាទី ប្រអប់សំបុត្រ និងដំណើរការបើកដំណើរការជានិច្ច។",
    [Locale.EN]:
      "Phneakngar is a coordination layer. Pick the agent you trust — we provide the roles, the mailbox, and the always-on infrastructure.",
  },
  comingSoon: {
    [Locale.KM]: "ឆាប់ៗ",
    [Locale.EN]: "Soon",
  },
} as const;

export const BYOA_AGENT_LABELS = {
  claude: {
    [Locale.KM]: "ភ្នាក់ងារ CLI របស់ Anthropic",
    [Locale.EN]: "Anthropic's CLI agent",
  },
  codex: {
    [Locale.KM]: "ភ្នាក់ងារសរសេរកូដរបស់ OpenAI",
    [Locale.EN]: "OpenAI's coding agent",
  },
  opencode: {
    [Locale.KM]: "ភ្នាក់ងារសរសេរកូដបើកចំហ",
    [Locale.EN]: "Open-source coding agent",
  },
  grok: {
    [Locale.KM]: "ភ្នាក់ងារ CLI របស់ xAI",
    [Locale.EN]: "xAI's CLI agent",
  },
  cursor: {
    [Locale.KM]: "កម្មវិធីកែសម្រួលកូដដោយ AI",
    [Locale.EN]: "AI-powered code editor",
  },
  hermes: {
    [Locale.KM]: "ភ្នាក់ងារសរសេរកូដស្វ័យប្រវត្តិ",
    [Locale.EN]: "Autonomous coding agent",
  },
  "claude-code": {
    [Locale.KM]: "ភ្នាក់ងារ AI បើកចំហ",
    [Locale.EN]: "Open AI agent",
  },
} as const;
