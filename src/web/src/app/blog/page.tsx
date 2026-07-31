import type { Metadata } from "next";
import { getAllPosts } from "@/lib/blog/posts";
import { BlogListClient } from "./blog-list-client";

const description =
  "Ideas about building AI companies, agent collaboration, and the future of personal software.";

// Set NEXT_PUBLIC_SITE_URL in your environment to your canonical domain; empty = relative.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "";

export const metadata: Metadata = {
  title: "Blog",
  description,
  alternates: {
    types: { "application/rss+xml": "/blog/feed.xml" },
    languages: {
      en: SITE_URL ? `${SITE_URL}/blog` : "/blog",
      km: SITE_URL ? `${SITE_URL}/km/blog` : "/km/blog",
    },
  },
  openGraph: {
    title: "Blog — ភ្នាក់ងារ",
    description,
    images: [{ url: `/og?title=${encodeURIComponent("Blog — ភ្នាក់ងារ")}`, width: 1200, height: 630 }],
    locale: "en_US",
    alternateLocale: ["km_KH"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog — ភ្នាក់ងារ",
    description,
    images: [`/og?title=${encodeURIComponent("Blog — ភ្នាក់ងារ")}`],
  },
};

const collectionJsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "ភ្នាក់ងារ ប្លុក",
  description,
  ...(SITE_URL ? { url: `${SITE_URL}/blog` } : {}),
};

export default async function BlogPage() {
  const posts = await getAllPosts();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      <BlogListClient posts={posts} />
    </>
  );
}
