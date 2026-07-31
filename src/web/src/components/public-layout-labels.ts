import { Locale, resolveLocale, type Locale as SharedLocale } from "@phneakngar/shared";

// Bilingual chrome for the shared public header/footer (PublicLayout).
// Tab ids, URLs and brand names stay English; only display labels are localized.

type PublicLayoutLabels = {
  tagline: string;
  templates: string;
  blog: string;
  privacy: string;
  footerAria: string;
};

export const PUBLIC_LAYOUT_LABELS = {
  [Locale.EN]: {
    tagline: "Your Agent. Always Working.",
    templates: "Templates",
    blog: "Blog",
    privacy: "Privacy",
    footerAria: "Footer navigation",
  },
  [Locale.KM]: {
    tagline: "ក្រុមហ៊ុនផ្ទាល់ខ្លួនរបស់អ្នក",
    templates: "គំរូ",
    blog: "ប្លុក",
    privacy: "ឯកជនភាព",
    footerAria: "បញ្ជីរុករកក្រោមទំព័រ",
  },
} as const satisfies Record<SharedLocale, PublicLayoutLabels>;

export function getPublicLayoutLabels(locale?: string | null): PublicLayoutLabels {
  return PUBLIC_LAYOUT_LABELS[resolveLocale(locale)];
}
