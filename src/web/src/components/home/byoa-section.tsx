"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ProviderLogo } from "@/components/provider-logo";

gsap.registerPlugin(ScrollTrigger);

interface Agent {
  name: string;
  provider: string;
  detail: string;
  comingSoon?: boolean;
}

/** Keep in sync with supported local runtimes (cli detectRuntimes + README BYOA table). */
const agents: Agent[] = [
  { name: "Claude Code", provider: "claude", detail: "ភ្នាក់ងារ CLI របស់ Anthropic" },
  { name: "Codex", provider: "codex", detail: "ភ្នាក់ងារសរសេរកូដរបស់ OpenAI" },
  { name: "OpenCode", provider: "opencode", detail: "ភ្នាក់ងារសរសេរកូដបើកចំហ" },
  {
    name: "Grok",
    provider: "grok",
    detail: "ភ្នាក់ងារ CLI របស់ xAI",
  },
  { name: "Cursor", provider: "cursor", detail: "កម្មវិធីកែសម្រួលកូដដោយ AI", comingSoon: true },
  { name: "Hermes", provider: "hermes", detail: "ភ្នាក់ងារសរសេរកូដស្វ័យប្រវត្តិ", comingSoon: true },
  { name: "OpenClaw", provider: "openclaw", detail: "ភ្នាក់ងារ AI បើកចំហ", comingSoon: true },
];

function AgentCard({ agent }: { agent: Agent }) {
  const dimmed = agent.comingSoon;

  return (
    <div
      className="byoa-card crt-panel-outer"
      style={{ opacity: dimmed ? 0.55 : 1 }}
    >
      <div className="crt-panel-inner px-5 py-4">
          <div className="flex items-center gap-3">
            <div
              className="flex shrink-0 items-center justify-center rounded"
              style={{ opacity: dimmed ? 0.45 : 0.85 }}
            >
              <ProviderLogo provider={agent.provider} className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div
                  className="text-sm font-medium"
                  style={{
                    fontFamily: "var(--font-crt)",
                    color: "var(--landing-phosphor)",
                    textShadow: dimmed
                      ? "none"
                      : "0 0 6px oklch(0.75 0.18 80 / 30%)",
                    opacity: dimmed ? 0.5 : 1,
                  }}
                >
                  {agent.name}
                </div>
                {dimmed && (
                  <span
                    className="text-[9px] uppercase tracking-[0.15em]"
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: "var(--landing-phosphor)",
                      opacity: 0.4,
                    }}
                  >
                    ឆាប់ៗ
                  </span>
                )}
                {!dimmed && (
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{
                      backgroundColor: "var(--landing-phosphor)",
                      boxShadow: "0 0 6px oklch(0.75 0.18 80 / 50%)",
                    }}
                  />
                )}
              </div>
              <div
                className="mt-0.5 text-[11px] leading-relaxed"
                style={{
                  fontFamily: "var(--font-crt)",
                  color: "var(--landing-phosphor)",
                  textShadow: dimmed
                    ? "none"
                    : "0 0 6px oklch(0.75 0.18 80 / 30%)",
                  opacity: dimmed ? 0.35 : 0.55,
                }}
              >
                {agent.detail}
              </div>
            </div>
          </div>
      </div>
    </div>
  );
}

export function ByoaSection() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.from(".byoa-title", {
        y: 30,
        opacity: 0,
        duration: 0.6,
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 75%",
          toggleActions: "play none none none",
        },
      });

      gsap.from(".byoa-card", {
        y: 30,
        opacity: 0,
        duration: 0.5,
        stagger: 0.1,
        scrollTrigger: {
          trigger: ".byoa-grid",
          start: "top 80%",
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
      <div className="byoa-title mx-auto mb-12 max-w-4xl text-center lg:mb-16">
        <div
          className="mb-3 text-xs uppercase tracking-[0.3em]"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--landing-text-muted)",
          }}
        >
          មិនជាប់នឹងភ្នាក់ងារតែមួយ
        </div>
        <h2
          style={{
            fontFamily: "var(--font-crt)",
            color: "var(--landing-text)",
            fontSize: "clamp(1.75rem, 4vw, 3rem)",
          }}
        >
          យកភ្នាក់ងារដែលអ្នកទុកចិត្តមកប្រើ
        </h2>
        <p
          className="mx-auto mt-2 max-w-lg"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--landing-text-muted)",
            fontSize: "0.85rem",
          }}
        >
          ភ្នាក់ងារ គឺជាស្រទាប់សម្របសម្រួល។ ជ្រើសភ្នាក់ងារដែលអ្នកទុកចិត្ត —
          យើងផ្តល់តួនាទី ប្រអប់សំបុត្រ និងដំណើរការបើកដំណើរការជានិច្ច។
        </p>
      </div>

      {/* Agent grid — available first, then soon */}
      <div className="byoa-grid mx-auto grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {agents.map((agent) => (
          <AgentCard key={agent.name} agent={agent} />
        ))}
      </div>
    </section>
  );
}
