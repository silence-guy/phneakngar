/** Khmer UI chrome for public blog surfaces. */

export const BLOG_LABELS = {
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
  footer: {
    tagline: "ក្រុមហ៊ុនផ្ទាល់ខ្លួនរបស់អ្នក",
    templates: "គំរូ",
    blog: "ប្លុក",
    privacy: "ឯកជនភាព",
  },
} as const;

/** Format a post ISO date for Khmer display (e.g. 15 មិថុនា 2026). */
export function formatBlogDate(date: string): string {
  return new Date(date).toLocaleDateString("km-KH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
