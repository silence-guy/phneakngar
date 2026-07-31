"use client";

import { useRef } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SunMoon } from "lucide-react";
import { useLandingLocale } from "./use-landing-locale";
import { LANDING_FOOTER_LABELS } from "./landing-labels";

gsap.registerPlugin(ScrollTrigger);

export function MarketingFooter() {
  const footerRef = useRef<HTMLElement>(null);
  const { resolvedTheme, setTheme } = useTheme();
  const { locale } = useLandingLocale();
  const labels = LANDING_FOOTER_LABELS[locale];

  useGSAP(
    () => {
      gsap.from(footerRef.current, {
        y: 20,
        opacity: 0,
        duration: 0.6,
        ease: "power2.out",
        scrollTrigger: {
          trigger: footerRef.current,
          start: "top 90%",
          toggleActions: "play none none none",
        },
      });
    },
    { scope: footerRef }
  );

  const linkStyle = {
    fontFamily: "var(--font-mono)",
    color: "var(--landing-text-muted)",
    fontSize: "11px",
    letterSpacing: "0",
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  const footerLinks = [
    { href: "/templates", label: labels.templates },
    { href: "/blog", label: labels.blog },
    { href: "/privacy", label: labels.privacy },
  ];

  return (
    <footer
      ref={footerRef}
      className="px-6 py-12"
      style={{
        backgroundColor: "var(--landing-surface)",
        borderTop: "1px solid var(--landing-border)",
      }}
    >
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-6 md:flex-row">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <span
              className="text-lg tracking-tight font-bold"
              style={{
                color: "var(--landing-text)",
              }}
            >
              {labels.brand}
            </span>
          </div>
          <span
            className="text-[10px] uppercase tracking-[0.2em]"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--landing-text-muted)",
            }}
          >
            {labels.tagline}
          </span>
        </div>

        <nav className="flex items-center gap-5" aria-label="Footer navigation">
          {footerLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="transition-opacity hover:opacity-70"
              style={linkStyle}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center justify-center size-8 rounded-md transition-colors hover:bg-[var(--landing-border)] cursor-pointer"
            style={{ color: "var(--landing-text-muted)" }}
            aria-label="Toggle theme"
          >
            <SunMoon className="size-4" />
          </button>
          <span
            className="text-[10px] uppercase tracking-[0.2em]"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--landing-text-muted)",
              opacity: 0.5,
            }}
          >
            &copy; {new Date().getFullYear()} {labels.brand}
          </span>
        </div>
      </div>
    </footer>
  );
}
