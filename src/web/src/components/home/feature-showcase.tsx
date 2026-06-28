"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface Feature {
  number: string;
  title: string;
  spec: string;
  description: string;
  terminal: string[];
  cta: { tagline: string; label: string; href: string };
}

const features: Feature[] = [
  {
    number: "I",
    title: "សហការ",
    spec: "កំណត់រចនាសម្ព័ន្ធក្រុមហ៊ុនរបស់អ្នក",
    description:
      "អ្នកជានាយក។ កំណត់តួនាទីឲ្យភ្នាក់ងារ ដូចជា dev, ops, research ហើយឲ្យពួកគេសម្របសម្រួលគ្នា។ ភ្នាក់ងារ រក្សាក្រុមទាំងមូលឲ្យដើរតាមគ្នា។",
    terminal: [
      "▓▓▓▓▓▓▓▓▓           ▓▓▓▓▓▓▓▓▓           ▓▓▓▓▓▓▓▓▓",
      "▓  YOU  ▓░░░░░░░░░░░▓  DEV  ▓░░░░░░░░░░░▓  OPS  ▓",
      "▓▓▓▓▓▓▓▓▓           ▓▓▓▓▓▓▓▓▓           ▓▓▓▓▓▓▓▓▓",
      "    ░                   ░                   ░    ",
      "    ░                   ░                   ░    ",
      "▓▓▓▓▓▓▓▓▓           ▓▓▓▓▓▓▓▓▓           ▓▓▓▓▓▓▓▓▓",
      "▓  R&D  ▓░░░░░░░░░░░▓ SALES ▓░░░░░░░░░░░▓  BIZ  ▓",
      "▓▓▓▓▓▓▓▓▓           ▓▓▓▓▓▓▓▓▓           ▓▓▓▓▓▓▓▓▓",
    ],
    cta: { tagline: "រចនាផែនទីក្រុមរបស់អ្នក", label: "បង្កើតក្រុម", href: "/sign-in" },
  },
  {
    number: "II",
    title: "តាមដានបាន",
    spec: "រាល់អន្តរកម្មត្រូវបានកត់ត្រា និងពិនិត្យបាន",
    description:
      "ភ្នាក់ងារទាក់ទងតាមអ៊ីមែល និងធ្វើការលើម៉ាស៊ីនរបស់អ្នក។ រាល់ការណែនាំ ការសម្រេចចិត្ត និងការឆ្លើយតបត្រូវបានកត់ត្រា ដូច្នេះអ្នកអាចពិនិត្យបានគ្រប់ពេល។",
    terminal: [
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
    cta: { tagline: "មានកំណត់ត្រាពេញលេញ គ្មានប្រអប់ខ្មៅ", label: "មើលការសម្រេចចិត្ត", href: "/sign-in" },
  },
  {
    number: "III",
    title: "ប្រតិទិន",
    spec: "មកដល់ពេលវេលាត្រឹមត្រូវ",
    description:
      "ភ្នាក់ងាររបស់អ្នកគ្រប់គ្រងកាលវិភាគដោយខ្លួនឯង។ ដឹងពេលត្រូវធ្វើការ តាមដាន ឬរង់ចាំ ដោយមិនរំខានលំហូរការងាររបស់អ្នក។",
    terminal: [
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
    cta: { tagline: "ភ្នាក់ងារមកតាមពេល", label: "រៀបចំកាលវិភាគ", href: "/sign-in" },
  },
  {
    number: "IV",
    title: "បើកជានិច្ច",
    spec: "ក្រុមហ៊ុនរបស់អ្នកមិនដេក",
    description:
      "daemon បន្តដំណើរការរក្សាភ្នាក់ងារឲ្យធ្វើការ ព្រមទាំងទទួលភារកិច្ច ឆ្លើយអ៊ីមែល និងបញ្ជូនលទ្ធផល ខណៈពេលអ្នកសម្រាក។",
    terminal: [
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
    cta: { tagline: "បញ្ជូនការងារខណៈអ្នកសម្រាក", label: "ចាប់ផ្តើម daemon", href: "/sign-in" },
  },
  {
    number: "V",
    title: "រៀនដោយខ្លួនឯង",
    spec: "រាល់ភារកិច្ចធ្វើឲ្យក្រុមឆ្លាតជាងមុន",
    description:
      "ភ្នាក់ងារបង្កើតការចងចាំពីការងារមុនៗ ដូចជាការសម្រេចចិត្ត ចំណូលចិត្ត និងបរិបទ។ ក្រុមហ៊ុនរបស់អ្នកកាន់តែច្បាស់លាស់ពីរាល់ការសន្ទនា និងភារកិច្ច។",
    terminal: [
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
    cta: { tagline: "ឆ្លាតជាងមុនពីរាល់ភារកិច្ច", label: "ពង្រីកក្រុម", href: "/sign-in" },
  },
];

export function FeatureShowcase() {
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
          មុខងារ
        </div>
        <h2
          style={{
            fontFamily: "var(--font-crt)",
            color: "var(--landing-text)",
            fontSize: "clamp(1.75rem, 4vw, 3rem)",
          }}
        >
          ក្រុមហ៊ុនរបស់អ្នក ភ្នាក់ងាររបស់អ្នក
        </h2>
        <p
          className="mx-auto mt-3 max-w-xl"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--landing-text-muted)",
            fontSize: "0.85rem",
          }}
        >
          កំណត់តួនាទី ផ្តល់ភារកិច្ចឲ្យភ្នាក់ងារ ហើយឲ្យពួកគេដំណើរការ។
          ភ្នាក់ងារ គឺជាស្រទាប់សម្របសម្រួលដែលបម្លែងភ្នាក់ងារ AI ទៅជាក្រុមហ៊ុន។
        </p>
      </div>

      <div className="mx-auto flex max-w-5xl flex-col gap-16 px-6 sm:gap-24 lg:gap-32 lg:px-12">
        {features.map((feature, i) => (
          <FeaturePanel key={feature.number} feature={feature} reversed={i % 2 === 1} />
        ))}
      </div>
    </section>
  );
}

function FeaturePanel({ feature, reversed }: { feature: Feature; reversed: boolean }) {
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
            {feature.number}.
          </span>
          <h2
            className="leading-tight"
            style={{
              fontFamily: "var(--font-crt)",
              color: "var(--landing-text)",
              fontSize: "clamp(2rem, 4vw, 3rem)",
            }}
          >
            {feature.title}
          </h2>
        </div>
        <div
          className="mt-2 text-[10px] uppercase tracking-[0.2em]"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--landing-text-muted)",
          }}
        >
          {feature.spec}
        </div>
        <p
          className="mx-auto mt-4 max-w-md leading-relaxed text-[0.8125rem] sm:text-[0.875rem] lg:mx-0"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--landing-text-muted)",
          }}
        >
          {feature.description}
        </p>
      </div>

      {/* Flip card */}
      <div className={`mx-auto w-full max-w-sm sm:max-w-md ${reversed ? "lg:order-1" : ""}`} style={{ isolation: "isolate" }}>
        <FlipCard feature={feature} />
      </div>
    </div>
  );
}

function FlipCard({ feature }: { feature: Feature }) {
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
              "0 4px 16px oklch(0.15 0.01 55 / 15%), inset 0 1px 0 oklch(0.95 0.01 80 / 40%)",
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
              "0 4px 16px oklch(0.15 0.01 55 / 15%)",
          }}
        >
          <p
            className="mb-5 text-center text-sm"
            style={{
              fontFamily: "var(--font-crt)",
              color: "var(--landing-phosphor)",
              textShadow: "0 0 6px oklch(0.75 0.18 80 / 30%)",
            }}
          >
            {feature.cta.tagline}
          </p>
          <a
            href={feature.cta.href}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs uppercase tracking-widest transition-opacity hover:opacity-80"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--landing-crt-bg)",
              backgroundColor: "var(--landing-phosphor)",
              boxShadow: "0 0 12px oklch(0.75 0.18 80 / 40%)",
            }}
          >
            {feature.cta.label}
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
        textShadow: "0 0 8px oklch(0.75 0.18 80 / 40%)",
        opacity: 0.8,
        lineHeight: 1.35,
        overflowX: "hidden",
      }}
    >
      {lines.join("\n")}
    </pre>
  );
}
