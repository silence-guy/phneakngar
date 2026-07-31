import { Locale, resolveLocale, type Locale as SharedLocale } from "@phneakngar/shared";

// Bilingual site metadata used by the root layout and public page metadata.
// The static default stays English (SEO default); `alternates.languages`
// exposes the Khmer variants.

type PublicMetaLabels = {
  siteTitle: string;
  siteTagline: string;
  siteDescription: string;
  ogImageAlt: string;
};

export const PUBLIC_META_LABELS = {
  [Locale.EN]: {
    siteTitle: "Phneakngar — Your Agent. Always Working.",
    siteTagline: "Your Agent. Always Working.",
    siteDescription:
      "Phneakngar AI agents work on your behalf, 24/7. Give them email, assign tasks, and let them handle your workload while you focus on what matters.",
    ogImageAlt: "Phneakngar — your personal AI company",
  },
  [Locale.KM]: {
    siteTitle: "ភ្នាក់ងារ — ភ្នាក់ងាររបស់អ្នក តែងតែដំណើរការ",
    siteTagline: "ភ្នាក់ងាររបស់អ្នក តែងតែដំណើរការ",
    siteDescription:
      "ភ្នាក់ងារ AI របស់ Phneakngar ធ្វើការជំនួសអ្នក ២៤/៧។ ផ្តល់អ៊ីមែល កំណត់ភារកិច្ច ហើយឲ្យពួកគេដោះស្រាយការងាររបស់អ្នក ខណៈអ្នកផ្តោតលើអ្វីដែលសំខាន់។",
    ogImageAlt: "ភ្នាក់ងារ — ក្រុមហ៊ុនផ្ទាល់ខ្លួនរបស់អ្នក",
  },
} as const satisfies Record<SharedLocale, PublicMetaLabels>;

export function getPublicMetaLabels(locale?: string | null): PublicMetaLabels {
  return PUBLIC_META_LABELS[resolveLocale(locale)];
}
