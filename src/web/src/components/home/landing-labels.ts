import { Locale } from "@phneakngar/shared";
import type { LandingLocale } from "./use-landing-locale";

/* ─────────────────────────────────────────────
   Hero Section Labels
   ───────────────────────────────────────────── */

export const LANDING_HERO_LABELS = {
  en: {
    brand: "Phneakngar",
    heading: "Your Agent. Always Working.",
    subline: "Give them a job. Let them handle it. Phneakngar agents work while you rest.",
    clipboardBadge: "Copy to your agent chat to get started",
    clipboardText: "Read {origin}/onboard.md and follow the guide to set up Phneakngar",
    ctaGetStarted: "Get Started",
    ctaOpenApp: "Open App",
    ctaTemplates: "Templates",
    mobileHint: "For the best experience, open on a desktop browser.",
  },
  km: {
    brand: "ភ្នាក់ងារ",
    heading: "ភ្នាក់ងាររបស់អ្នក តែងតែដំណើរការ",
    subline: "ផ្តល់ការងារឲ្យ ឲ្យពួកគេដោះស្រាយ ភ្នាក់ងារ Phneakngar ដំណើរការពេលអ្នកសម្រាក",
    clipboardBadge: "ចម្លងទៅជជែកភ្នាក់ងារ ដើម្បីចាប់ផ្តើម",
    clipboardText: "Read {origin}/onboard.md and follow the guide to set up Phneakngar",
    ctaGetStarted: "ចាប់ផ្តើម",
    ctaOpenApp: "បើកកម្មវិធី",
    ctaTemplates: "គំរូ",
    mobileHint: "សម្រាប់បទពិសោធន៍ពេញលេញ សូមបើកលើកម្មវិធីរុករកកុំព្យូទ័រ",
  },
} as const satisfies Record<LandingLocale, {
  brand: string;
  heading: string;
  subline: string;
  clipboardBadge: string;
  clipboardText: string;
  ctaGetStarted: string;
  ctaOpenApp: string;
  ctaTemplates: string;
  mobileHint: string;
}>;

/* ─────────────────────────────────────────────
   Nav Labels
   ───────────────────────────────────────────── */

export const LANDING_NAV_LABELS = {
  en: {
    templates: "Templates",
    blog: "Blog",
    app: "App",
    getStarted: "Get Started",
    toggleEn: "EN",
    toggleKh: "KH",
  },
  km: {
    templates: "Templates",
    blog: "Blog",
    app: "App",
    getStarted: "Get Started",
    toggleEn: "EN",
    toggleKh: "KH",
  },
} as const satisfies Record<LandingLocale, {
  templates: string;
  blog: string;
  app: string;
  getStarted: string;
  toggleEn: string;
  toggleKh: string;
}>;

/* ─────────────────────────────────────────────
   Footer Labels
   ───────────────────────────────────────────── */

export const LANDING_FOOTER_LABELS = {
  en: {
    brand: "Phneakngar",
    tagline: "Your Agent. Always Working.",
    templates: "Templates",
    blog: "Blog",
    privacy: "Privacy",
  },
  km: {
    brand: "ភ្នាក់ងារ",
    tagline: "ភ្នាក់ងាររបស់អ្នក តែងតែដំណើរការ",
    templates: "គំរូ",
    blog: "ប្លុក",
    privacy: "ឯកជនភាព",
  },
} as const satisfies Record<LandingLocale, {
  brand: string;
  tagline: string;
  templates: string;
  blog: string;
  privacy: string;
}>;

/* ─────────────────────────────────────────────
   Use Cases Section Labels
   ───────────────────────────────────────────── */

export const LANDING_USE_CASES_LABELS = {
  sectionLabel: {
    [Locale.KM]: "ករណីប្រើប្រាស់",
    [Locale.EN]: "Use Cases",
  },
  heading: {
    [Locale.KM]: "មើលវាដំណើរការពិត",
    [Locale.EN]: "See it in action",
  },
  description: {
    [Locale.KM]: "ស្ថានភាពពិតៗដែលរត់លើភ្នាក់ងារពិត រាល់ថ្ងៃ។",
    [Locale.EN]: "Real scenarios running on real agents, every day.",
  },
  scenarios: {
    [Locale.KM]: [
      {
        id: "lead-followup",
        title: "តាមដាន lead ដោយស្វ័យប្រវត្តិ",
        subtitle: "ឆ្លើយតបផ្ទាល់ខ្លួនក្នុងប៉ុន្មាននាទី មិនមែនប៉ុន្មានម៉ោង",
      },
      {
        id: "weekly-brief",
        title: "សង្ខេបថ្ងៃចន្ទ ម៉ោង 8 ព្រឹក",
        subtitle: "សប្តាហ៍របស់អ្នកត្រូវបានរៀបចំមុនកាហ្វេ",
      },
      {
        id: "store-ops",
        title: "ប្រតិបត្តិការហាងប្រ�ាំថ្ងៃ",
        subtitle: "អ្នកគ្រប់គ្រង AI ពិនិត្យប្រតិបត្តិការរាល់ព្រឹក",
      },
      {
        id: "bug-to-pr",
        title: "របាយការណ៍ bug → PR រួចរាល់",
        subtitle: "ភ្នាក់ងារ 3 បម្លែងអ៊ីមែល bug ទៅជា fix ដែល merge រួច",
      },
      {
        id: "post-update",
        title: "បង្ហោះ update",
        subtitle: "មួយប្រយោគ ប្រាំនាទី បោះពុម្ពផ្សាយ",
      },
      {
        id: "fill-form",
        title: "បំពេញទម្រង់",
        subtitle: "វាចងចាំអ្វីៗទាំងអស់ អ្នកគ្រាន់តែចុះហត្ថលេខា",
      },
    ],
    [Locale.EN]: [
      {
        id: "lead-followup",
        title: "Auto lead follow-up",
        subtitle: "Personal replies in minutes, not hours.",
      },
      {
        id: "weekly-brief",
        title: "Monday brief, 8am",
        subtitle: "Your week is prepped before coffee.",
      },
      {
        id: "store-ops",
        title: "Daily store operations",
        subtitle: "AI ops manager checks in every morning.",
      },
      {
        id: "bug-to-pr",
        title: "Bug report to PR, done",
        subtitle: "3-agent pipeline turns bug emails into merged fixes.",
      },
      {
        id: "post-update",
        title: "Post an update",
        subtitle: "One sentence. Five minutes. Published.",
      },
      {
        id: "fill-form",
        title: "Fill this form",
        subtitle: "It remembers everything. You just sign.",
      },
    ],
  },
} as const;

/* ─────────────────────────────────────────────
   Feature Showcase Labels
   ───────────────────────────────────────────── */

export const LANDING_FEATURE_LABELS = {
  sectionLabel: {
    [Locale.KM]: "មុខងារ",
    [Locale.EN]: "Features",
  },
  heading: {
    [Locale.KM]: "ក្រុមហ៊ុនរបស់អ្នក ភ្នាក់ងាររបស់អ្នក",
    [Locale.EN]: "Your company. Your agents.",
  },
  description: {
    [Locale.KM]: "កំណត់តួនាទី ផ្តល់ភារកិច្ចឲ្យភ្នាក់ងារ ហើយឲ្យពួកគេដំណើរការ ភ្នាក់ងារ គឺជាស្រទាប់សម្របសម្រួលដែលបម្លែងភ្នាក់ងារ AI ទៅជាក្រុមហ៊ុន",
    [Locale.EN]: "Define roles, assign tasks, let them run. The agent is the coordination layer that turns AI agents into a company.",
  },
  features: {
    [Locale.KM]: [
      {
        number: "I",
        title: "សហការ",
        spec: "កំណត់រចនាសម្ព័ន្ធក្រុមហ៊ុនរបស់អ្នក",
        description: "អ្នកជានាយក កំណត់តួនាទីឲ្យភ្នាក់ងារ ដូចជា dev, ops, research ហើយឲ្យពួកគេសម្របសម្រួលគ្នា ភ្នាក់ងារ រក្សាក្រុមទាំងមូលឲ្យដើរតាមគ្នា",
        cta: { tagline: "រចនាផែនទីក្រុមរបស់អ្នក", label: "បង្កើតក្រុម", href: "/sign-in" },
      },
      {
        number: "II",
        title: "តាមដានបាន",
        spec: "រាល់អន្�រកម្មត្រូវបានកត់ត្រា និងពិនិត្យបាន",
        description: "ភ្នាក់ងារទាក់ទងតាមអ៊ីមែល និងធ្វើការលើម៉ាស៊ីនរបស់អ្នក រាល់ការណែនាំ ការសម្រេចចិត្ត និងការឆ្លើយតបត្រូវបានកត់ត្រា ដូច្នេះអ្នកអាចពិនិត្យបានគ្រប់ពេល",
        cta: { tagline: "មានកំណត់ត្រាពេញលេញ គ្មានប្រអប់ខ្មៅ", label: "មើលការសម្រេចចិត្ត", href: "/sign-in" },
      },
      {
        number: "III",
        title: "ប្រតិទិន",
        spec: "មកដល់ពេលវេលាត្រឹមត្រូវ",
        description: "ភ្នាក់ងាររបស់អ្នកគ្រប់គ្រងកាលវិភាគដោយខ្លួនឯង ដឹងពេលត្រូវធ្វើការ តាមដាន ឬរង់ចាំ ដោយមិនរំខានលំហូរការងាររបស់អ្នក",
        cta: { tagline: "ភ្នាក់ងារមកតាមពេល", label: "រៀបចំកាលវិភាគ", href: "/sign-in" },
      },
      {
        number: "IV",
        title: "បើកជានិច្ច",
        spec: "ក្រុមហ៊ុនរបស់អ្នកមិនដេក",
        description: "chhlat បន្តដំណើរការរក្សាភ្នាក់ងារឲ្យធ្វើការ ព្រមទាំងទទួលភារកិច្ច ឆ្លើយអ៊ីមែល និងប�្ជូនលទ្ធផល ខណៈពេលអ្នកសម្រាក",
        cta: { tagline: "បញ្ជូនការងារខណៈអ្នកសម្រាក", label: "ចាប់ផ្តើម chhlat", href: "/sign-in" },
      },
      {
        number: "V",
        title: "រៀនដោយខ្លួនឯង",
        spec: "រាល់ភារកិច្ចធ្វើឲ្យក្រុមឆ្លាតជាងមុន",
        description: "ភ្នាក់ងារបង្កើតការចងចាំពីការងារមុនៗ ដូចជាការសម្រេចចិត្ត ចំណូលចិត្ត និងបរិបទ ក្រុមហ៊ុនរបស់អ្នកកាន់តែច្បាស់លាស់ពីរាល់ការសន្ទនា និងភារកិច្ច",
        cta: { tagline: "ឆ្លាតជាងមុនពីរាល់ភារកិច្ច", label: "ពង្រីកក្រុម", href: "/sign-in" },
      },
    ],
    [Locale.EN]: [
      {
        number: "I",
        title: "Collaborate",
        spec: "Structure your company",
        description: "You're the CEO. Assign roles to agents, like dev, ops, research, and have them coordinate. Agents keep the whole team in sync.",
        cta: { tagline: "Map your team", label: "Create team", href: "/sign-in" },
      },
      {
        number: "II",
        title: "Trackable",
        spec: "Every interaction is logged and auditable",
        description: "Agents communicate via email and work on your machines. Every instruction, decision, and response is logged, so you can audit anytime.",
        cta: { tagline: "Full records, no black boxes", label: "See decisions", href: "/sign-in" },
      },
      {
        number: "III",
        title: "Scheduled",
        spec: "Time arrives correctly",
        description: "Your agents manage their own calendars. Know when to work, follow up, or wait — without disrupting your workflow.",
        cta: { tagline: "Agents on time", label: "Set schedule", href: "/sign-in" },
      },
      {
        number: "IV",
        title: "Always on",
        spec: "Your company never sleeps",
        description: "chhlat keeps agents running, receiving tasks, answering emails, and delivering results while you rest.",
        cta: { tagline: "Offload work while you rest", label: "Start chhlat", href: "/sign-in" },
      },
      {
        number: "V",
        title: "Self-learning",
        spec: "Every task makes the team smarter",
        description: "Agents build memory from past work, including decisions, preferences, and context. Your company gets clearer about every conversation and task.",
        cta: { tagline: "Smarter with every task", label: "Grow team", href: "/sign-in" },
      },
    ],
  },
} as const;

/* ─────────────────────────────────────────────
   BYOA Section Labels
   ───────────────────────────────────────────── */

export const LANDING_BYOA_LABELS = {
  sectionLabel: {
    [Locale.KM]: "មិនជាប់នឹងភ្នាក់ងារតែមួយ",
    [Locale.EN]: "Not locked into one agent",
  },
  heading: {
    [Locale.KM]: "យកភ្នាក់ងារដែលអ្នកទុកចិត្តមកប្រើ",
    [Locale.EN]: "Bring your own agents",
  },
  description: {
    [Locale.KM]: "ភ្នាក់ងារ គឺជាស្រទាប់សម្របសម្រួល ជ្រើសភ្នាក់ងារដែលអ្នកទុកចិត្ត យើងផ្តល់តួនាទី ប្រអប់សំបុត្រ និងដំណើរការបើកដំណើរការជានិច្ច",
    [Locale.EN]: "Phneakngar is a coordination layer. Pick the agents you trust — we provide the email, dashboard, and always-on runtime.",
  },
  agents: {
    [Locale.KM]: [
      { name: "Claude Code", provider: "claude", detail: "ភ្នាក់ងារ CLI របស់ Anthropic" },
      { name: "Codex", provider: "codex", detail: "ភ្នាក់ងារសរសេរកូដរបស់ OpenAI" },
      { name: "OpenCode", provider: "opencode", detail: "ភ្នាក់ងារសរសេរកូដបើកចំហ" },
      { name: "Grok", provider: "grok", detail: "ភ្នាក់ងារ CLI របស់ xAI" },
      { name: "Cursor", provider: "cursor", detail: "កម្មវិធីកែសម្រួលកូដដោយ AI", comingSoon: true },
      { name: "Hermes", provider: "hermes", detail: "ភ្នាក់ងារសរសេរកូដស្វ័យប្រវត្តិ", comingSoon: true },
      { name: "OpenClaw", provider: "openclaw", detail: "ភ្នាក់ងារ AI បើកចំហ", comingSoon: true },
    ],
    [Locale.EN]: [
      { name: "Claude Code", provider: "claude", detail: "Anthropic's CLI agent" },
      { name: "Codex", provider: "codex", detail: "OpenAI's coding agent" },
      { name: "OpenCode", provider: "opencode", detail: "Open-source coding agent" },
      { name: "Grok", provider: "grok", detail: "xAI's CLI agent" },
      { name: "Cursor", provider: "cursor", detail: "AI-powered code editor", comingSoon: true },
      { name: "Hermes", provider: "hermes", detail: "Self-learning coding agent", comingSoon: true },
      { name: "OpenClaw", provider: "openclaw", detail: "Open-source AI agent", comingSoon: true },
    ],
  },
  comingSoon: {
    [Locale.KM]: "ឆាប់ៗ",
    [Locale.EN]: "Coming soon",
  },
} as const;

/* ─────────────────────────────────────────────
   Quickstart Section Labels
   ───────────────────────────────────────────── */

export const LANDING_QUICKSTART_LABELS = {
  sectionLabel: {
    [Locale.KM]: "បើកចំហ និង host ដោយខ្លួនឯង",
    [Locale.EN]: "Open source & self-host",
  },
  heading: {
    [Locale.KM]: "គ្រប់គ្រងហេដ្ឋារចនាសម្ព័ន្ធរបស់អ្នក",
    [Locale.EN]: "Control your infrastructure",
  },
  description: {
    [Locale.KM]: "Phneakngar is fully open source. Self-host the entire platform, keep your data private, and run your AI company on hardware you control.",
    [Locale.EN]: "Phneakngar is fully open source. Self-host the entire platform, keep your data private, and run your AI company on hardware you control.",
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
      "One command to start",
    ],
  },
  cta: {
    [Locale.KM]: "ចាប់ផ្តើមក្រុមហ៊ុនរបស់អ្នក",
    [Locale.EN]: "Start your company",
  },
} as const;

/* ─────────────────────────────────────────────
   Architecture Overview Labels
   ───────────────────────────────────────────── */

export const LANDING_ARCH_LABELS = {
  sectionLabel: {
    [Locale.KM]: "របៀបដំណើរការ",
    [Locale.EN]: "How it works",
  },
  heading: {
    [Locale.KM]: "ភ្នាក់ងារមូលដ្ឋាន ឈានទៅពិភពខាងក្រៅ",
    [Locale.EN]: "Base agents reach the outside world",
  },
  description: {
    [Locale.KM]: "ភ្នាក់ងាររត់លើម៉ាស៊ីនរបស់អ្នក និងមានសិទ្ធិប្រើឧបករណ៍របស់អ្នក ភ្នាក់ងារ ភ្ជាប់វាទៅអ៊ីមែល ផ្ទាំងគ្រប់គ្រង និងពិភពខាងក្រៅ",
    [Locale.EN]: "Agents run on your machine and have access to your tools. Phneakngar connects them to email, the dashboard, and the outside world.",
  },
  desktopTitle: {
    [Locale.KM]: "ភ្នាក់ងារ Desktop",
    [Locale.EN]: "Phneakngar Desktop",
  },
  mobileTitle: {
    [Locale.KM]: "ភ្នាក់ងារ Mobile",
    [Locale.EN]: "Phneakngar Mobile",
  },
  terminalTitle: {
    [Locale.KM]: "ម៉ាស៊ីនរបស់អ្នក",
    [Locale.EN]: "Your Machine",
  },
} as const satisfies Record<string, { [key in Locale]: string }>;
