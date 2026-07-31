import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllPosts, getPostBySlug } from "@/lib/blog/posts";
import { BlogPostClient } from "./blog-post-client";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "";

function absoluteUrl(path: string): string | undefined {
  return SITE_URL ? `${SITE_URL}${path}` : undefined;
}

export const dynamicParams = false;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const posts = await getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return {};
  const postUrl = absoluteUrl(`/blog/${post.slug}`);

  return {
    title: `${post.title} — Blog`,
    description: post.excerpt,
    ...(postUrl
      ? { alternates: { canonical: postUrl, languages: { en: postUrl, km: `${SITE_URL}/km/blog/${post.slug}` } } }
      : {}),
    openGraph: {
      title: post.title,
      description: post.excerpt,
      ...(postUrl ? { url: postUrl } : {}),
      type: "article",
      publishedTime: post.date,
      authors: [post.author],
      locale: "en_US",
      alternateLocale: ["km_KH"],
      images: [
        {
          url: `/og?title=${encodeURIComponent(post.title)}`,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      images: [`/og?title=${encodeURIComponent(post.title)}`],
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const posts = await getAllPosts();
  const currentIndex = posts.findIndex((p) => p.slug === slug);
  const prevPost = currentIndex < posts.length - 1 ? posts[currentIndex + 1] : null;
  const nextPost = currentIndex > 0 ? posts[currentIndex - 1] : null;

  const { default: PostContent } = await import(`@/content/${slug}.mdx`);
  const postUrl = absoluteUrl(`/blog/${post.slug}`);

  const blogPostingJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    author: {
      "@type": "Person",
      name: post.author,
    },
    publisher: {
      "@type": "Organization",
      name: "ភ្នាក់ងារ AI",
      ...(SITE_URL ? { url: SITE_URL } : {}),
    },
    ...(postUrl ? { url: postUrl } : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogPostingJsonLd) }}
      />
      <BlogPostClient post={post} prevPost={prevPost} nextPost={nextPost}>
        <PostContent />
      </BlogPostClient>
    </>
  );
}
