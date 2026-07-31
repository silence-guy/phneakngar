"use client";

import Link from "next/link";
import { PublicLayout } from "@/components/public-layout";
import { LocaleToggle } from "@/components/locale-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { LandingLocaleProvider, useLandingLocale } from "@/components/home/use-landing-locale";
import { getBlogLabels, formatBlogDate } from "@/lib/blog/blog-labels";
import type { BlogPost } from "@/lib/blog/types";

export function BlogListClient({ posts }: { posts: BlogPost[] }) {
  return (
    <LandingLocaleProvider>
      <BlogListClientInner posts={posts} />
    </LandingLocaleProvider>
  );
}

function BlogListClientInner({ posts }: { posts: BlogPost[] }) {
  const { locale } = useLandingLocale();
  const labels = getBlogLabels(locale);
  const [featured, ...rest] = posts;

  return (
    <PublicLayout
      breadcrumb={{ label: labels.nav.blog, href: "/blog" }}
      rightSlot={
        <>
          <LocaleToggle />
          <ThemeToggle />
        </>
      }
      footer="rich"
    >
      <div className="mx-auto max-w-3xl px-6 pt-10 sm:pt-20 pb-24">
        <header className="mb-16">
          {/* font-khmer + normal tracking: tight display tracking stacks Khmer clusters */}
          <h1 className="font-khmer text-5xl sm:text-6xl font-semibold tracking-normal leading-[1.35]">
            {labels.list.title}
          </h1>
          <p className="mt-4 text-[1.0625rem] text-muted-foreground font-sans leading-relaxed max-w-xl">
            {labels.list.description}
          </p>
        </header>

        {featured && (
          <Link
            href={`/blog/${featured.slug}`}
            className="group block pb-14 mb-14 border-b border-border"
          >
            <span className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground/60">
              {labels.list.latest}
            </span>
            <h2 className="mt-3 font-khmer text-3xl sm:text-4xl font-semibold tracking-normal leading-[1.4] group-hover:translate-x-1 transition-transform duration-200">
              {featured.title}
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              {formatBlogDate(featured.date, locale)} &middot; {featured.readingTime}
            </p>
            <p className="mt-4 font-sans text-lg text-foreground/80 leading-relaxed max-w-2xl">
              {featured.excerpt}
            </p>
          </Link>
        )}

        <div className="space-y-0">
          {rest.map((post, i) => (
            <article
              key={post.slug}
              className={`py-10 ${i < rest.length - 1 ? "border-b border-border" : ""}`}
            >
              <Link href={`/blog/${post.slug}`} className="group block">
                <div className="flex items-baseline gap-4">
                  <span className="text-xs font-mono text-muted-foreground/40 tabular-nums w-6 shrink-0">
                    {String(i + 2).padStart(2, "0")}
                  </span>
                  <div>
                    <h2 className="font-khmer text-xl sm:text-2xl font-semibold tracking-normal leading-[1.4] group-hover:translate-x-0.5 transition-transform duration-200">
                      {post.title}
                    </h2>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      {formatBlogDate(post.date, locale)} &middot; {post.readingTime}
                    </p>
                    <p className="mt-3 font-sans text-foreground/75 leading-relaxed">
                      {post.excerpt}
                    </p>
                  </div>
                </div>
              </Link>
            </article>
          ))}
        </div>
      </div>
    </PublicLayout>
  );
}
