"use client";

import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

export function MarketingNav({ isLoggedIn }: { isLoggedIn: boolean }) {
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
            className="text-lg tracking-tight"
            style={{
              color: "var(--landing-text)",
              fontWeight: 700,
            }}
          >
            ភ្នាក់ងារ
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
            គំរូ
          </Link>
          <Link
            href="/blog"
            className="hidden sm:block px-3 py-1.5 text-xs transition-opacity duration-150 hover:opacity-70"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--landing-text)",
            }}
          >
            ប្លុក
          </Link>
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
            កម្មវិធី
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
            ចាប់ផ្តើម
            </a>
          )}
        </div>
      </div>
    </nav>
  );
}
