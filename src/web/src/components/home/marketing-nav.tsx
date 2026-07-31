"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { BrandMark } from "@/components/brand-mark";
import { SunMoon } from "lucide-react";
import { useLandingLocale } from "./use-landing-locale";
import { LANDING_NAV_LABELS } from "./landing-labels";

export function MarketingNav({ isLoggedIn }: { isLoggedIn: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  const { locale, toggleLocale } = useLandingLocale();
  const labels = LANDING_NAV_LABELS[locale];

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <nav
      className="marketing-nav fixed top-0 right-0 left-0 z-50 invisible opacity-0"
      style={{
        backgroundColor: "var(--landing-bg-translucent)",
        backdropFilter: "blur(8px)",
        borderBottom: "1px solid var(--landing-border)",
      }}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-2.5">
        <Link href="/" className="flex items-center gap-1">
          <BrandMark size={22} />
          <span
            className="text-lg tracking-tight font-bold"
            style={{
              color: "var(--landing-text)",
            }}
          >
            Phneakngar
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/templates"
            className="hidden sm:block px-3 py-1.5 text-xs transition-opacity duration-150 hover:opacity-70"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--landing-text)",
            }}
          >
            {labels.templates}
          </Link>
          <Link
            href="/blog"
            className="hidden sm:block px-3 py-1.5 text-xs transition-opacity duration-150 hover:opacity-70"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--landing-text)",
            }}
          >
            {labels.blog}
          </Link>
          {/* Language toggle */}
          <div
            className="flex items-center rounded-md overflow-hidden border"
            style={{ borderColor: "var(--landing-border)" }}
          >
            <button
              type="button"
              onClick={toggleLocale}
              className="flex items-center px-2 py-1 text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
              style={{
                fontFamily: "var(--font-mono)",
                backgroundColor: locale === "en" ? "var(--landing-text)" : "transparent",
                color: locale === "en" ? "var(--landing-bg)" : "var(--landing-text-muted)",
              }}
              aria-label="Toggle language"
            >
              EN
            </button>
            <button
              type="button"
              onClick={toggleLocale}
              className="flex items-center px-2 py-1 text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
              style={{
                fontFamily: "var(--font-mono)",
                backgroundColor: locale === "km" ? "var(--landing-text)" : "transparent",
                color: locale === "km" ? "var(--landing-bg)" : "var(--landing-text-muted)",
              }}
              aria-label="Toggle language"
            >
              KH
            </button>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center justify-center size-8 rounded-md transition-colors hover:bg-[var(--landing-border)] cursor-pointer"
            style={{ color: "var(--landing-text)" }}
            aria-label="Toggle theme"
          >
            <SunMoon className="size-4" />
          </button>
          {isLoggedIn ? (
            <Link
              href="/workspaces?auto"
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs transition-opacity duration-150 hover:opacity-70"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--landing-text)",
                border: "1px solid var(--landing-text)",
              }}
            >
            {labels.app}
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          ) : (
            <a
              href="/sign-in"
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs transition-opacity duration-150 hover:opacity-70"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--landing-bg)",
                backgroundColor: "var(--landing-text)",
              }}
            >
            {labels.getStarted}
            </a>
          )}
        </div>
      </div>
    </nav>
  );
}
