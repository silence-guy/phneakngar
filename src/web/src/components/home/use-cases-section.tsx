"use client";

import { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Calendar, DollarSign, BarChart3, Bug, MessageSquare, Brain } from "lucide-react";
import { DemoWindow } from "./demo-window";
import { UseCaseDemo } from "./demo-pad/use-case-demo";
import {
  leadFollowupScript,
  weeklyBriefScript,
  storeOpsScript,
  bugToPrScript,
  postUpdateScript,
  fillFormScript,
} from "./demo-pad/use-case-scripts";
import type { UseCaseScript } from "./demo-pad/use-case-demo";

gsap.registerPlugin(ScrollTrigger);

/* ─────────────────────────────────────────────
   Scenario Data
   ───────────────────────────────────────────── */

interface Scenario {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  script: UseCaseScript;
}

const scenarios: Scenario[] = [
  {
    id: "lead-followup",
    title: "តាមដាន lead ដោយស្វ័យប្រវត្តិ",
    subtitle: "ឆ្លើយតបផ្ទាល់ខ្លួនក្នុងប៉ុន្មាននាទី មិនមែនប៉ុន្មានម៉ោង។",
    icon: <DollarSign className="size-4" />,
    script: leadFollowupScript,
  },
  {
    id: "weekly-brief",
    title: "សង្ខេបថ្ងៃចន្ទ ម៉ោង 8 ព្រឹក",
    subtitle: "សប្តាហ៍របស់អ្នកត្រូវបានរៀបចំមុនកាហ្វេ។",
    icon: <Calendar className="size-4" />,
    script: weeklyBriefScript,
  },
  {
    id: "store-ops",
    title: "ប្រតិបត្តិការហាងប្រចាំថ្ងៃ",
    subtitle: "អ្នកគ្រប់គ្រងប្រតិបត្តិការ AI ពិនិត្យរាល់ព្រឹក។",
    icon: <BarChart3 className="size-4" />,
    script: storeOpsScript,
  },
  {
    id: "bug-to-pr",
    title: "របាយការណ៍ bug → PR រួចរាល់",
    subtitle: "ភ្នាក់ងារ 3 បម្លែងអ៊ីមែល bug ទៅជា fix ដែល merge រួច។",
    icon: <Bug className="size-4" />,
    script: bugToPrScript,
  },
  {
    id: "post-update",
    title: "\"បង្ហោះ update\"",
    subtitle: "មួយប្រយោគ។ ប្រាំនាទី។ បោះពុម្ពផ្សាយ។",
    icon: <MessageSquare className="size-4" />,
    script: postUpdateScript,
  },
  {
    id: "fill-form",
    title: "\"Fill this form\"",
    subtitle: "វាចងចាំអ្វីៗទាំងអស់។ អ្នកគ្រាន់តែចុះហត្ថលេខា។",
    icon: <Brain className="size-4" />,
    script: fillFormScript,
  },
];

/* ─────────────────────────────────────────────
   Main Section: Left Picker + Right Demo
   ───────────────────────────────────────────── */

export function UseCasesSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [slideDir, setSlideDir] = useState<"left" | "right">("left");

  useGSAP(
    () => {
      gsap.from(".usecase-title", {
        y: 30,
        opacity: 0,
        duration: 0.6,
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 75%",
          toggleActions: "play none none none",
        },
      });

      gsap.from(".usecase-layout", {
        y: 40,
        opacity: 0,
        duration: 0.6,
        ease: "power2.out",
        scrollTrigger: {
          trigger: ".usecase-layout",
          start: "top 85%",
          toggleActions: "play none none none",
        },
      });
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      className="relative px-6 py-24 lg:py-32"
      style={{ backgroundColor: "var(--landing-bg)" }}
    >
      {/* Title */}
      <div className="usecase-title mx-auto mb-14 max-w-4xl text-center lg:mb-20">
        <div
          className="mb-3 text-xs uppercase tracking-[0.3em]"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--landing-text-muted)",
          }}
        >
          ករណីប្រើប្រាស់
        </div>
        <h2
          style={{
            fontFamily: "var(--font-crt)",
            color: "var(--landing-text)",
            fontSize: "clamp(1.75rem, 4vw, 3rem)",
          }}
        >
          មើលវាដំណើរការពិត
        </h2>
        <p
          className="mx-auto mt-3 max-w-xl"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--landing-text-muted)",
            fontSize: "0.85rem",
          }}
        >
          ស្ថានភាពពិតៗដែលរត់លើភ្នាក់ងារពិត រាល់ថ្ងៃ។
        </p>
      </div>

      {/* Layout: Left picker + Right demo */}
      <div className="usecase-layout mx-auto flex max-w-5xl flex-col gap-6 md:flex-row md:items-start md:gap-8">
        {/* Left: Scenario picker */}
        <div className="flex flex-row gap-2 overflow-x-auto thin-scrollbar pb-2 md:w-72 md:shrink-0 md:flex-col md:overflow-x-visible md:pb-0">
          {scenarios.map((scenario, i) => (
            <button
              key={scenario.id}
              type="button"
              onClick={() => { setSlideDir(i > activeIndex ? "left" : "right"); setActiveIndex(i); }}
              className={`flex items-start gap-3 rounded-xl px-4 py-3 text-left transition-all duration-200 cursor-pointer shrink-0 md:shrink md:w-full ${
                i === activeIndex
                  ? "ring-1 ring-[var(--landing-border)] shadow-sm"
                  : "hover:bg-(--muted) opacity-70 hover:opacity-100"
              }`}
              style={
                i === activeIndex
                  ? { backgroundColor: "var(--landing-surface)" }
                  : undefined
              }
            >
              <span
                className="mt-0.5 shrink-0"
                style={{ color: i === activeIndex ? "var(--landing-text)" : "var(--landing-text-muted)" }}
              >
                {scenario.icon}
              </span>
              <div className="min-w-0">
                <div
                  className="text-sm font-medium leading-snug whitespace-nowrap lg:whitespace-normal"
                  style={{
                    fontFamily: "var(--font-crt)",
                    color: i === activeIndex ? "var(--landing-text)" : "var(--landing-text-muted)",
                  }}
                >
                  {scenario.title}
                </div>
                {i === activeIndex && (
                  <div
                    className="mt-0.5 text-[11px] leading-snug hidden md:block"
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: "var(--landing-text-muted)",
                    }}
                  >
                    {scenario.subtitle}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Right: Demo panel */}
        <div className="flex-1 min-w-0 overflow-hidden rounded-2xl" style={{ perspective: "1200px" }}>
          <div
            key={activeIndex}
            className={`overflow-hidden ${slideDir === "left" ? "usecase-demo-slide-left" : "usecase-demo-slide-right"}`}
          >
            <DemoWindow
              title={`phneakngar — ${scenarios[activeIndex].title}`}
              className="shadow-[0_4px_24px_rgba(0,0,0,0.1)]"
            >
              <div className="h-120 overflow-hidden">
                <UseCaseDemo script={scenarios[activeIndex].script} />
              </div>
            </DemoWindow>
          </div>
        </div>
      </div>
    </section>
  );
}
