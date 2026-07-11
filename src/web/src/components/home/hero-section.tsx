"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { TypewriterVisual } from "@/components/typewriter-visual";
import { BrandMark } from "@/components/brand-mark";
import { trackLandingCtaClicked } from "@/lib/analytics";

gsap.registerPlugin(ScrollTrigger, SplitText);

export function HeroSection({ isLoggedIn }: { isLoggedIn: boolean }) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const sublineRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useGSAP(
    () => {
      if (
        !headingRef.current ||
        !sublineRef.current ||
        !ctaRef.current
      )
        return;

      const entranceTl = gsap.timeline({ delay: 0.3 });

      entranceTl
        .fromTo(".hero-brand",
          { y: -20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }
        )
        .to(headingRef.current, { opacity: 1, duration: 0.4, ease: "power2.out" }, 0.2)
        .to(sublineRef.current, { opacity: 1, duration: 0.3, ease: "power2.out" }, "-=0.1")
        .fromTo(
          ".hero-clipboard",
          { y: 10, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.3, ease: "power2.out" },
          "-=0.1"
        )
        .fromTo(
          ".hero-providers",
          { y: 10, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.4, ease: "power2.out" },
          "-=0.2"
        )
        .fromTo(
          ctaRef.current,
          { y: 15, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.4, ease: "power2.out" },
          "-=0.2"
        );

    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      className="hero-section relative flex h-screen items-center justify-center overflow-hidden"
      style={{ backgroundColor: "var(--landing-bg)" }}
    >
      {/* Paper noise */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.06'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
        }}
      />

      <div className="hero-content relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center px-4 sm:px-6 py-8 max-h-full">
        {/* Brand */}
        <div className="hero-brand mb-6 flex shrink-0 items-center gap-1.5" style={{ opacity: 0 }}>
          <BrandMark size={32} priority />
          <span
            className="text-2xl tracking-tight"
            style={{
              fontFamily: "var(--font-brand)",
              color: "var(--landing-text)",
              fontWeight: 700,
            }}
          >
            ភ្នាក់ងារ
          </span>
        </div>

        {/* Scalable content zone — all content scales together on short viewports */}
        <div className="typewriter-wrapper flex w-full shrink min-h-0 flex-col items-center" style={{ height: "clamp(192px, calc(100vh - 200px), 750px)" }}>
        <div className="hero-scalable flex w-full flex-1 min-h-0 flex-col items-center">

        {/* Typewriter + Slogan wrapper */}
        <div className="relative w-full shrink min-h-0 flex-1">
          {/* Slogan — positioned at top of typewriter area */}
          <div className="absolute top-0 left-0 right-0 z-10 flex flex-col items-center pt-2">
            <h1
              ref={headingRef}
              className="mb-1 text-center leading-[1.2] px-2"
              style={{
                fontFamily: "var(--font-crt)",
                color: "var(--landing-text)",
                fontSize: "clamp(26px, 4vw, 44px)",
                letterSpacing: "0",
                opacity: 0,
              }}
            >
              ដំណើរការក្រុមហ៊ុនផ្ទាល់ខ្លួន
            </h1>
            <p
              ref={sublineRef}
              className="block max-w-lg text-center text-sm sm:text-base leading-relaxed px-2"
              style={{
                fontFamily: "var(--font-crt)",
                color: "var(--landing-text-muted)",
                fontSize: "clamp(15px, 3.6vw, 20px)",
                opacity: 0,
              }}
            >
              គំនិតរបស់អ្នកត្រូវការក្រុមមនុស្សដើម្បីសម្រេច។
              ឥឡូវនេះអ្នកត្រូវការតែខ្លួនឯង និង ភ្នាក់ងារ។
            </p>
          </div>

          {/* Full Typewriter */}
          <TypewriterVisual
            interactive
            entranceDelay={1.2}
            className="absolute! inset-0"
          />
        </div>

        {/* Clipboard copy widget */}
        <div
          className="hero-clipboard relative mt-8 shrink-0 w-full max-w-lg cursor-pointer"
          style={{ opacity: 0 }}
          onClick={() => {
            navigator.clipboard.writeText(
              `អាន ${window.location.origin}/onboard.md ហើយធ្វើតាមការណែនាំ ដើម្បីដំឡើង និងកំណត់រចនាសម្ព័ន្ធ ភ្នាក់ងារ`
            );
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {/* Floating badge label */}
          <span
            className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap overflow-hidden text-ellipsis px-2 py-0.5 text-[10px] sm:text-xs"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--landing-text-muted)",
              backgroundColor: "var(--landing-bg)",
            }}
          >
          ចម្លងទៅក្នុងការជជែករបស់ភ្នាក់ងារដើម្បីចាប់ផ្តើម
          </span>
          {/* Content box */}
          <div
            className="flex w-full items-center gap-2 rounded px-3 py-2.5 pt-3 text-xs sm:text-sm"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--landing-text)",
              border: "1px solid color-mix(in srgb, var(--landing-text-muted) 30%, transparent)",
            }}
          >
            <span className="flex-1 overflow-hidden whitespace-nowrap text-ellipsis">
                  អាន{" "}
              <a
                href="/onboard.md"
                target="_blank"
                rel="noopener noreferrer"
                className="underline transition-opacity hover:opacity-70"
                style={{ color: "var(--landing-text)" }}
                onClick={(e) => e.stopPropagation()}
              >
                Onboard.md
              </a>
                  {" "}ហើយធ្វើតាមការណែនាំ ដើម្បីដំឡើង និងកំណត់រចនាសម្ព័ន្ធ ភ្នាក់ងារ
            </span>
            <span
              className="shrink-0 p-1"
              style={{ color: copied ? "var(--landing-text)" : "var(--landing-text-muted)" }}
            >
              {copied ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </span>
          </div>
        </div>

        {/* Specs */}
        {/* <div className="hero-specs mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2" style={{ opacity: 0 }}>
          {[
            "Collaboration",
            "Always-On",
            "Self-Learning",
          ].map((spec) => (
            <span
              key={spec}
              className="text-xs sm:text-sm uppercase tracking-[0.15em] font-bold"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--landing-text-muted)",
              }}
            >
              {spec}
            </span>
          ))}
        </div> */}

        {/* CTA */}
        <div ref={ctaRef} className="mt-8 shrink-0 flex flex-nowrap items-center justify-center gap-3" style={{ opacity: 0 }}>
          {isLoggedIn ? (
            <a
              href="/workspaces?auto"
              onClick={() => trackLandingCtaClicked({ cta_name: "open_app" })}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm transition-all duration-200 hover:opacity-80"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--landing-bg)",
                backgroundColor: "var(--landing-text)",
                    letterSpacing: "0",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
                  បើកកម្មវិធី
            </a>
          ) : (
            <a
              href="/sign-in"
              onClick={() => trackLandingCtaClicked({ cta_name: "get_started" })}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm transition-all duration-200 hover:opacity-80"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--landing-bg)",
                backgroundColor: "var(--landing-text)",
                    letterSpacing: "0",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
                  ចាប់ផ្តើម
            </a>
          )}
          <Link
            href="/templates"
            onClick={() => trackLandingCtaClicked({ cta_name: "templates" })}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm transition-all duration-200 hover:opacity-80"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--landing-text)",
              border: "1px solid var(--landing-text)",
                letterSpacing: "0",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
              គំរូ
          </Link>
        </div>

        </div>{/* end hero-scalable */}
        </div>{/* end typewriter-wrapper */}

        <p
          className="mt-4 shrink-0 sm:hidden text-center text-xs"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--landing-text-muted)",
          }}
        >
          For the full experience, open on a desktop browser.
        </p>
      </div>
    </section>
  );
}
