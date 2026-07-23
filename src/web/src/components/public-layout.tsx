import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { BLOG_LABELS } from "@/lib/blog/blog-labels";

const footerLinks = [
  { href: "/templates", label: BLOG_LABELS.footer.templates },
  { href: "/blog", label: BLOG_LABELS.footer.blog },
  { href: "/privacy", label: BLOG_LABELS.footer.privacy },
];

export type PublicBreadcrumb =
  | string
  | {
      label: string;
      href: string;
    };

function resolveBreadcrumb(breadcrumb: PublicBreadcrumb): { label: string; href: string } {
  if (typeof breadcrumb === "string") {
    return { label: breadcrumb, href: `/${breadcrumb.toLowerCase()}` };
  }
  return breadcrumb;
}

export function PublicLayout({
  maxWidth = "5xl",
  breadcrumb,
  leftSlot,
  centerSlot,
  rightSlot,
  footer = "none",
  mainClassName,
  children,
}: {
  maxWidth?: "4xl" | "5xl";
  breadcrumb?: PublicBreadcrumb;
  leftSlot?: React.ReactNode;
  centerSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  footer?: "simple" | "rich" | "none";
  mainClassName?: string;
  children: React.ReactNode;
}) {
  const maxWClass = maxWidth === "4xl" ? "max-w-4xl" : "max-w-5xl";
  const crumb = breadcrumb ? resolveBreadcrumb(breadcrumb) : null;

  return (
    <div className="min-h-dvh flex flex-col bg-background text-foreground">
      <nav className="sticky top-0 z-50 bg-background border-b border-border/40">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-2.5">
          {leftSlot ? (
            <div className="flex items-center gap-1.5">{leftSlot}</div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Link href="/" className="flex items-center gap-1">
                <BrandMark size={22} />
                <span
                  className="text-lg tracking-tight font-bold"
                >
                  ភ្នាក់ងារ
                </span>
              </Link>
              {crumb && (
                <>
                  <span className="text-muted-foreground/50 text-sm">/</span>
                  <Link
                    href={crumb.href}
                    className="text-sm font-medium text-foreground hover:text-muted-foreground transition-colors"
                  >
                    {crumb.label}
                  </Link>
                </>
              )}
            </div>
          )}
          {centerSlot && <div className="flex items-center gap-3">{centerSlot}</div>}
          {rightSlot && <div className="flex items-center gap-3">{rightSlot}</div>}
        </div>
      </nav>

      <main className={mainClassName ? `flex-1 ${mainClassName}` : "flex-1"}>{children}</main>

      {footer === "simple" && (
        <footer className="border-t border-border px-6 py-12">
          <div className={`mx-auto flex ${maxWClass} items-center justify-center`}>
            <span className="text-[10px] uppercase tracking-[0.2em] font-mono text-muted-foreground/50">
              &copy; {new Date().getFullYear()} ភ្នាក់ងារ AI
            </span>
          </div>
        </footer>
      )}

      {footer === "rich" && (
        <footer className="border-t border-border px-6 py-12">
          <div className={`mx-auto flex ${maxWClass} flex-col items-center justify-between gap-6 md:flex-row`}>
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-1">
                <span
                  className="text-lg tracking-tight font-bold"
                >
                  ភ្នាក់ងារ
                </span>
              </Link>
              <span className="text-[10px] tracking-[0.12em] font-mono text-muted-foreground">
                {BLOG_LABELS.footer.tagline}
              </span>
            </div>

            <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2" aria-label="Footer navigation">
              {footerLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-[11px] tracking-[0.12em] font-mono text-muted-foreground transition-opacity hover:opacity-70"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <span className="text-[10px] uppercase tracking-[0.2em] font-mono text-muted-foreground/50">
              &copy; {new Date().getFullYear()} ភ្នាក់ងារ AI
            </span>
          </div>
        </footer>
      )}
    </div>
  );
}
