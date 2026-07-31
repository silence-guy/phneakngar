import { Locale, resolveLocale, type Locale as SharedLocale } from "@phneakngar/shared";

type BlogLabels = {
  nav: {
    blog: string;
  };
  list: {
    title: string;
    description: string;
    latest: string;
  };
  detail: {
    allPosts: string;
    previous: string;
    next: string;
  };
};

export const BLOG_LABELS = {
  [Locale.KM]: {
    nav: {
      blog: "ប្លុក",
    },
    list: {
      title: "ប្លុក",
      description:
        "គំនិតអំពីការកសាងក្រុមហ៊ុន AI ការសហការភ្នាក់ងារ និងអនាគតនៃកម្មវិធីផ្ទាល់ខ្លួន។",
      latest: "ថ្មីៗ",
    },
    detail: {
      allPosts: "ប្លុកទាំងអស់",
      previous: "មុន",
      next: "បន្ទាប់",
    },
  },
  [Locale.EN]: {
    nav: {
      blog: "Blog",
    },
    list: {
      title: "Blog",
      description:
        "Ideas about building AI companies, agent collaboration, and the future of personal software.",
      latest: "Latest",
    },
    detail: {
      allPosts: "All posts",
      previous: "Previous",
      next: "Next",
    },
  },
} as const satisfies Record<SharedLocale, BlogLabels>;

export function getBlogLabels(locale?: string | null): BlogLabels {
  return BLOG_LABELS[resolveLocale(locale)];
}

/**
 * Format a post ISO date for display. Defaults to Khmer (km-KH) to match the
 * landing chrome's default; pass a locale to switch to English (en-US).
 */
export function formatBlogDate(date: string, locale?: string | null): string {
  const resolved = resolveLocale(locale);
  return new Date(date).toLocaleDateString(resolved === Locale.KM ? "km-KH" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
