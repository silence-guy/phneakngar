"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLandingLocale } from "./use-landing-locale";
import { LANDING_FEATURE_LABELS } from "./landing-labels";

gsap.registerPlugin(ScrollTrigger);

interface Feature {
  number: string;
  description: string;
  terminal: string[];
  cta: { tagline: string; label: string; href: string };
}

const featureTerminals: Record<string, string[]> = {
  I: [
    "▓▓▓▓▓▓▓▓▓           ▓▓▓▓▓▓▓▓▓           ▓▓▓▓▓▓▓▓▓",
    "▓  YOU  ▓░░░░░░░░░░░▓  DEV  ▓░░░░░░░░░░░▓  OPS  ▓",
    "▓▓▓▓▓▓▓▓▓           ▓▓▓▓▓▓▓▓▓           ▓▓▓▓▓▓▓▓▓",
    "    ░                   ░                   ░    ",
    "    ░                   ░                   ░    ",
    "▓▓▓▓▓▓▓▓▓           ▓▓▓▓▓▓▓▓▓           ▓▓▓▓▓▓▓▓▓",
    "▓  R&D  ▓░░░░░░░░░░░▓ SALES ▓░░░░░░░░░░░▓  BIZ  ▓",
    "▓▓▓▓▓▓▓▓▓           ▓▓▓▓▓▓▓▓▓           ▓▓▓▓▓▓▓▓▓",
  ],
  II: [
    "█████████████████████████",
    "█▓▒                   ▒▓█",
    "█ ▓▒░               ░▒▓ █",
    "█   ▓▒░           ░▒▓   █",
    "█     ▓▒░       ░▒▓     █",
    "█       ▓▒░   ░▒▓       █",
    "█         ▓▒█▒▓         █",
    "█          ▒█▒          █",
    "█                       █",
    "█████████████████████████",
  ],
  III: [
    "▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓",
    "▓  M  T  W  T  F  S  S  ▓",
    "▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓",
    "▓  ░  ░  ░  ░  ░  ░  ░  ▓",
    "▓  ░  ░  ░  ░  ░  ░  ░  ▓",
    "▓  ░  ░  ▒  ▓  ░  ░  ░  ▓",
    "▓  ░  ░  ░  ░  █  ░  ░  ▓",
    "▓  ░  ░  ░  ░  ░  ░  ░  ▓",
    "▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓",
  ],
  IV: [
    "                         ",
    "                         ",
    "           █             ",
    "          █ █            ",
    "        ▒▓   █           ",
    "░░░░░░░░░     ▓   ▒░░░░░░",
    "               █ ▓       ",
    "                ▓        ",
    "                         ",
    "                         ",
  ],
  V: [
    "                         ",
    "            █            ",
    "           ▓█▓           ",
    "          ▒▓█▓▒          ",
    "         ░▒▓█▓▒░         ",
    "        ░░▒▓█▓▒░░        ",
    "       ░░░▒▓█▓▒░░░       ",
    "      ░░░░▒▓█▓▒░░░░      ",
    "     ░░░░░▒▓█▓▒░░░░░     ",
    "                         ",
  ],
};

const features: Feature[] = [
  {
    number: "I",
    description: "",
    terminal: featureTerminals.I,
    cta: { tagline: "", label: "", href: "/sign-in" },
  },
  {
    number: "II",
    description: "",
    terminal: featureTerminals.II,
    cta: { tagline: "", label: "", href: "/sign-in" },
  },
  {
    number: "III",
    description: "",
    terminal: featureTerminals.III,
    cta: { tagline: "", label: "", href: "/sign-in" },
  },
  {
    number: "IV",
    description: "",
    terminal: featureTerminals.IV,
    cta: { tagline: "", label: "", href: "/sign-in" },
  },
  {
    number: "V",
    description: "",
    terminal: featureTerminals.V,
    cta: { tagline: "", label: "", href: "/sign-in" },
  },
];

export function FeatureShowcase() {
  const { locale } = useLandingLocale();
  const labels = LANDING_FEATURE_LABELS;
  const sectionRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.from(".feature-hero", {
        y: 30,
        opacity: 0,
        duration: 0.6,
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 75%",
          toggleActions: "play none none none",
        },
      });

      const panels = gsap.utils.toArray<HTMLElement>(".feature-row");
      panels.forEach((panel) => {
        gsap.from(panel, {
          y: 40,
          opacity: 0,
          duration: 0.6,
          ease: "power2.out",
          scrollTrigger: {
            trigger: panel,
            start: "top 80%",
            toggleActions: "play none none none",
          },
        });
      });
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden py-24 lg:py-32"
      style={{ backgroundColor: "var(--landing-bg)" }}
    >
      {/* Section hero */}
      <div className="feature-hero mx-auto mb-20 max-w-4xl px-6 text-center lg:mb-28">
        <div
          className="mb-3 text-xs uppercase tracking-[0.3em]"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--landing-text-muted)",
          }}
        >
          {labels.sectionLabel[locale]}
        </div>
        <h2
          style={{
            fontFamily: "var(--font-crt)",
            color: "var(--landing-text)",
            fontSize: "clamp(1.75rem, 4vw, 3rem)",
          }}
        >
          {labels.heading[locale]}
        </h2>
        <p
          className="mx-auto mt-3 max-w-xl"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--landing-text-muted)",
            fontSize: "0.85rem",
          }}
        >
          {labels.description[locale]}
        </p>
      </div>

      <div className="mx-auto flex max-w-5xl flex-col gap-16 px-6 sm:gap-24 lg:gap-32 lg:px-12">
        {labels.features[locale].map((featureLabel, i) => (
          <FeaturePanel
            key={featureLabel.number}
            feature={features[i]}
            featureLabel={featureLabel}
            reversed={i % 2 === 1}
          />
        ))}
      </div>
    </section>
  );
}

function FeaturePanel({
  feature,
  featureLabel,
  reversed,
}: {
  feature: Feature;
  featureLabel: {
    number: string;
    title: string;
    spec: string;
    description: string;
    cta: { tagline: string; label: string; href: string };
  };
  reversed: boolean;
}) {
  return (
    <div className="feature-row grid w-full grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-16">
      {/* Text side */}
      <div className={`panel-text text-center lg:text-left ${reversed ? "lg:order-2" : ""}`}>
        <div className="mb-2 flex items-baseline justify-center gap-3 lg:justify-start">
          <span
            className="text-3xl"
            style={{
              fontFamily: "var(--font-crt)",
              color: "var(--landing-text-muted)",
            }}
          >
            {featureLabel.number}.
          </span>
          <h2
            className="leading-tight"
            style={{
              fontFamily: "var(--font-crt)",
              color: "var(--landing-text)",
              fontSize: "clamp(2rem, 4vw, 3rem)",
            }}
          >
            {featureLabel.title}
          </h2>
        </div>
        <div
          className="mt-2 text-[10px] uppercase tracking-[0.2em]"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--landing-text-muted)",
          }}
        >
          {featureLabel.spec}
        </div>
        <p
          className="mx-auto mt-4 max-w-md leading-relaxed text-[0.8125rem] sm:text-[0.875rem] lg:mx-0"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--landing-text-muted)",
          }}
        >
          {featureLabel.description}
        </p>
      </div>

      {/* Flip card */}
      <div className={`mx-auto w-full max-w-sm sm:max-w-md ${reversed ? "lg:order-1" : ""}`} style={{ isolation: "isolate" }}>
        <FlipCard feature={feature} featureLabel={featureLabel} />
      </div>
    </div>
  );
}

function FlipCard({
  feature,
  featureLabel,
}: {
  feature: Feature;
  featureLabel: {
    cta: { tagline: string; label: string; href: string };
  };
}) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      className="flip-card panel-crt relative z-1 cursor-pointer"
      style={{ perspective: "1200px" }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a")) return;
        setFlipped((f) => !f);
      }}
    >
      <div
        className="flip-card-inner relative w-full transition-transform duration-500 ease-out transform-3d"
        style={flipped ? { transform: "rotateY(180deg)" } : undefined}
      >
        {/* Front — ASCII art */}
        <div
          className="flip-card-front crt-panel-outer"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            pointerEvents: flipped ? "none" : undefined,
            boxShadow:
              "0 4px 16px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.4)",
          }}
        >
          <div className="crt-panel-inner p-5">
            <div className="flex items-center justify-center min-h-35">
              <AnimatedArt lines={feature.terminal} />
            </div>
          </div>
        </div>

        {/* Back — CTA */}
        <div
          className="flip-card-back absolute inset-0 flex flex-col items-center justify-center rounded-lg p-6"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            backgroundColor: "var(--landing-crt-bg)",
            boxShadow:
              "0 4px 16px rgba(0, 0, 0, 0.15)",
          }}
        >
          <p
            className="mb-5 text-center text-sm"
            style={{
              fontFamily: "var(--font-crt)",
              color: "var(--landing-phosphor)",
              textShadow: "0 0 6px rgba(237, 237, 237, 0.3)",
            }}
          >
            {featureLabel.cta.tagline}
          </p>
          <a
            href={featureLabel.cta.href}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs uppercase tracking-widest transition-opacity hover:opacity-80"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--landing-crt-bg)",
              backgroundColor: "var(--landing-phosphor)",
              boxShadow: "0 0 12px rgba(237, 237, 237, 0.4)",
            }}
          >
            {featureLabel.cta.label}
          </a>
        </div>
      </div>
    </div>
  );
}

const DENSITY = [" ", "░", "▒", "▓", "█"];

function AnimatedArt({ lines }: { lines: string[] }) {
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (!preRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const text = lines.join("\n");
    const chars = [...text];
    const meta = chars.map((c, i) => {
      const level = DENSITY.indexOf(c);
      let row = 0;
      let col = 0;
      for (let j = 0; j < i; j++) {
        if (text[j] === "\n") { row++; col = 0; } else { col++; }
      }
      return { orig: c, level, row, col };
    });

    let frame = 0;
    let animId: number | null = null;

    const animate = () => {
      frame++;
      if (frame % 2 === 0) {
        const buf: string[] = [];
        for (let i = 0; i < meta.length; i++) {
          const m = meta[i];
          if (m.level <= 0) { buf.push(m.orig); continue; }
          const wave = Math.sin(frame * 0.015 + m.row * 0.45 + m.col * 0.1);
          const shifted = Math.max(1, Math.min(4, m.level + Math.round(wave)));
          buf.push(DENSITY[shifted]);
        }
        if (preRef.current) preRef.current.textContent = buf.join("");
      }
      animId = requestAnimationFrame(animate);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (animId === null) animId = requestAnimationFrame(animate);
        } else {
          if (animId !== null) { cancelAnimationFrame(animId); animId = null; }
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(preRef.current);

    return () => {
      if (animId !== null) cancelAnimationFrame(animId);
      observer.disconnect();
    };
  }, [lines]);

  return (
    <pre
      ref={preRef}
      style={{
        fontFamily: "'Menlo', 'Consolas', 'DejaVu Sans Mono', monospace",
        fontSize: "clamp(7px, 2.5vw, 13px)",
        color: "var(--landing-phosphor)",
        textShadow: "0 0 8px rgba(237, 237, 237, 0.4)",
        opacity: 0.8,
        lineHeight: 1.35,
        overflowX: "hidden",
      }}
    >
      {lines.join("\n")}
    </pre>
  );
}
