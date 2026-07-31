"use client";

import Link from "next/link";
import { LandingLocaleProvider, useLandingLocale } from "@/components/home/use-landing-locale";
import { getPublicLayoutLabels } from "./public-layout-labels";

function PublicLayoutFooterInner({ variant }: { variant: "simple" | "rich" }) {
  const { locale } = useLandingLocale();
  const labels = getPublicLayoutLabels(locale);
  const year = new Date().getFullYear();

  const footerLinks = [
    { href: "/templates", label: labels.templates },
    { href: "/blog", label: labels.blog },
    { href: "/privacy", label: labels.privacy },
  ];

  return (
    <footer className="border-t border-border px-6 py-12">
      {variant === "simple" ? (
        <div className="mx-auto flex items-center justify-center">
          <span className="text-[10px] uppercase tracking-[0.2em] font-mono text-muted-foreground/50">
            &copy; {year} Phneakngar AI
          </span>
        </div>
      ) : (
        <div className="mx-auto flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-1">
              <span className="text-lg tracking-tight font-bold">Phneakngar</span>
            </Link>
            <span className="text-[10px] tracking-[0.12em] font-mono text-muted-foreground">
              {labels.tagline}
            </span>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2" aria-label={labels.footerAria}>
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
            &copy; {year} Phneakngar AI
          </span>
        </div>
      )}
    </footer>
  );
}

export function PublicLayoutFooter({ variant }: { variant: "simple" | "rich" }) {
  return (
    <LandingLocaleProvider>
      <PublicLayoutFooterInner variant={variant} />
    </LandingLocaleProvider>
  );
}
