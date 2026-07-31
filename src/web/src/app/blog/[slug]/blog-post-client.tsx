"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { PublicLayout } from "@/components/public-layout";
import { LocaleToggle } from "@/components/locale-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { LandingLocaleProvider, useLandingLocale } from "@/components/home/use-landing-locale";
import { getBlogLabels, formatBlogDate } from "@/lib/blog/blog-labels";
import type { BlogPost } from "@/lib/blog/types";

export function BlogPostClient({
  post,
  prevPost,
  nextPost,
  children,
}: {
  post: BlogPost;
  prevPost: BlogPost | null;
  nextPost: BlogPost | null;
  children: React.ReactNode;
}) {
  return (
    <LandingLocaleProvider>
      <BlogPostClientInner post={post} prevPost={prevPost} nextPost={nextPost}>
        {children}
      </BlogPostClientInner>
    </LandingLocaleProvider>
  );
}

function BlogPostClientInner({
  post,
  prevPost,
  nextPost,
  children,
}: {
  post: BlogPost;
  prevPost: BlogPost | null;
  nextPost: BlogPost | null;
  children: React.ReactNode;
}) {
  const { locale } = useLandingLocale();
  const labels = getBlogLabels(locale);

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
      <article className="mx-auto max-w-3xl px-6 pt-12 sm:pt-24 pb-28">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8 sm:mb-14"
        >
          <ArrowLeft className="size-3.5" />
          {labels.detail.allPosts}
        </Link>

        <header className="mb-10 sm:mb-16">
          <h1 className="font-khmer text-4xl sm:text-5xl font-semibold tracking-normal leading-[1.4]">
            {post.title}
          </h1>
          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground/70">{post.author}</span>
            <span className="text-muted-foreground/40">/</span>
            <span>{formatBlogDate(post.date, locale)}</span>
            <span className="text-muted-foreground/40">/</span>
            <span>{post.readingTime}</span>
          </div>
        </header>

        <div className="blog-content blog-content-editorial font-sans text-lg leading-[1.7] text-foreground max-w-[65ch] [&_h2]:font-sans [&_h2]:text-[1.625rem] [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:mt-16 [&_h2]:mb-6 [&_p]:mb-8 [&_blockquote]:border-l-[3px] [&_blockquote]:border-foreground/20 [&_blockquote]:pl-6 [&_blockquote]:italic [&_blockquote]:text-foreground/70 [&_blockquote]:my-10 [&_blockquote]:text-xl [&_blockquote]:leading-relaxed [&_code]:font-mono [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[0.875em] [&_pre]:bg-muted [&_pre]:rounded-lg [&_pre]:px-5 [&_pre]:py-4 [&_pre]:my-10 [&_pre]:overflow-x-auto [&_pre]:thin-scrollbar [&_pre]:text-[0.875rem] [&_pre]:leading-relaxed [&_pre]:max-w-none [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_img]:rounded-lg [&_img]:my-12 [&_img]:w-full [&_img]:max-w-none [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-8 [&_ul]:-mt-1 [&_li]:mb-3 [&_li]:leading-[1.7] [&_strong]:font-semibold [&_em]:italic [&_a]:underline [&_a]:underline-offset-3 [&_a]:decoration-foreground/30 [&_a]:hover:decoration-foreground/60 [&_a]:transition-colors [&_table]:w-full [&_table]:my-10 [&_table]:border-collapse [&_table]:text-[0.9rem] [&_th]:text-left [&_th]:font-semibold [&_th]:py-3 [&_th]:px-4 [&_th]:border-b-2 [&_th]:border-border [&_td]:py-3 [&_td]:px-4 [&_td]:border-b [&_td]:border-border [&_tr:hover]:bg-muted/50">
          {children}
        </div>

        <nav className="mt-20 border-t border-border pt-10 flex items-stretch justify-between gap-6">
          {prevPost ? (
            <Link
              href={`/blog/${prevPost.slug}`}
              className="group flex flex-col gap-1.5 text-left max-w-[45%]"
            >
              <span className="text-[11px] tracking-[0.15em] font-mono text-muted-foreground flex items-center gap-1.5">
                <ArrowLeft className="size-3" />
                {labels.detail.previous}
              </span>
              <span className="text-[15px] font-sans group-hover:-translate-x-0.5 transition-transform duration-200 leading-snug">
                {prevPost.title}
              </span>
            </Link>
          ) : (
            <div />
          )}
          {nextPost ? (
            <Link
              href={`/blog/${nextPost.slug}`}
              className="group flex flex-col gap-1.5 text-right ml-auto max-w-[45%]"
            >
              <span className="text-[11px] tracking-[0.15em] font-mono text-muted-foreground flex items-center justify-end gap-1.5">
                {labels.detail.next}
                <ArrowRight className="size-3" />
              </span>
              <span className="text-[15px] font-sans group-hover:translate-x-0.5 transition-transform duration-200 leading-snug">
                {nextPost.title}
              </span>
            </Link>
          ) : (
            <div />
          )}
        </nav>
      </article>
    </PublicLayout>
  );
}
