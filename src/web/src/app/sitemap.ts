import type { MetadataRoute } from "next";
import { TEMPLATES } from "@/lib/templates";
import { getAllPosts } from "@/lib/blog/posts";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "";

type SitemapEntry = MetadataRoute.Sitemap[number];

function buildEntry(path: string, options: Omit<SitemapEntry, "url">): SitemapEntry {
  return {
    url: `${SITE_URL}${path}`,
    ...options,
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!SITE_URL) return [];

  const templateEntries: MetadataRoute.Sitemap = TEMPLATES.map((t) =>
    buildEntry(`/templates/${t.id}`, {
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    })
  );

  const posts = await getAllPosts();
  const blogEntries: MetadataRoute.Sitemap = posts.map((post) =>
    buildEntry(`/blog/${post.slug}`, {
      lastModified: new Date(post.date),
      changeFrequency: "monthly",
      priority: 0.6,
    })
  );

  const baseEntries: MetadataRoute.Sitemap = [
    buildEntry("/", {
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    }),
    buildEntry("/templates", {
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    }),
    ...templateEntries,
    buildEntry("/blog", {
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    }),
    ...blogEntries,
    buildEntry("/privacy", {
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    }),
    buildEntry("/sign-in", {
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    }),
  ];

  return baseEntries;
}
