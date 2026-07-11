import { ThemeToggle } from "@/components/theme-toggle";
import { PublicLayout } from "@/components/public-layout";
import { BLOG_LABELS } from "@/lib/blog/blog-labels";

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PublicLayout
      breadcrumb={{ label: BLOG_LABELS.nav.blog, href: "/blog" }}
      rightSlot={<ThemeToggle />}
      footer="rich"
    >
      {children}
    </PublicLayout>
  );
}
