import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { PublicLayoutFooter } from "@/components/public-layout-footer";

export type PublicBreadcrumb =
  | string
  | {
      label: React.ReactNode;
      href: string;
    };

function resolveBreadcrumb(breadcrumb: PublicBreadcrumb): { label: React.ReactNode; href: string } {
  if (typeof breadcrumb === "string") {
    return { label: breadcrumb, href: `/${breadcrumb.toLowerCase()}` };
  }
  return breadcrumb;
}

export function PublicLayout({
  breadcrumb,
  leftSlot,
  centerSlot,
  rightSlot,
  footer = "none",
  mainClassName,
  children,
}: {
  breadcrumb?: PublicBreadcrumb;
  leftSlot?: React.ReactNode;
  centerSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  footer?: "simple" | "rich" | "none";
  mainClassName?: string;
  children: React.ReactNode;
}) {
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
                  Phneakngar
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

      {footer !== "none" && <PublicLayoutFooter variant={footer} />}
    </div>
  );
}
