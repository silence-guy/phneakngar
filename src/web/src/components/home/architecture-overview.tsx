"use client";

import { useMemo, useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { DemoWindow } from "./demo-window";
import { DemoDashboard, type DashboardStep, type DashboardState, type DashboardConfig, type AgentInfo } from "./demo-pad/demo-dashboard";
import { DemoTerminal, type TerminalLine } from "./demo-pad/demo-terminal";
import { DemoMobile } from "./demo-pad/demo-mobile";
import { useScriptedTimeline, type TimelineStep } from "./demo-pad/use-scripted-timeline";

gsap.registerPlugin(ScrollTrigger);

const ARCH_AGENTS: AgentInfo[] = [
  { id: "planner", name: "វិចិត្រ", email: "planner@phneakngar.ai", config: { shape: "hexagon", eye: "dots", nose: "dash", bg: 5 } },
  { id: "coder", name: "ដារ៉ា", email: "coder@phneakngar.ai", config: { shape: "task", eye: "happy", nose: "dot", bg: 0 } },
];
const ARCH_CONFIG: DashboardConfig = { agents: ARCH_AGENTS };

/* ─── អ្នករៀបចំ's chat steps ─── */
const PLANNER_STEPS: DashboardStep[] = [
  { type: "user-message", text: "មានអ្នកប្រើប្រាស់រាយការណ៍ថា Safari គាំងពេល login — ជួយជួសជុលបានទេ?" },
  { type: "message", text: "ខ្ញុំកំពុងពិនិត្យ ហើយនឹងផ្ទេរទៅ ដារ៉ា សម្រាប់ផ្នែកកូដ។" },
  { type: "email-out", subject: "ជួសជុល Safari flex gap ក្នុង login page", address: "coder@phneakngar.ai" },
  // After អ្នកសរសេរកូដ finishes:
  { type: "email-in", subject: "Re: ជួសជុល Safari flex gap — រួចរាល់, PR #142", address: "coder@phneakngar.ai" },
  { type: "message", markdown: "ដារ៉ា បានជួសជុលរួច — បើក <strong>PR #142</strong> ហើយ។ បានកែ <code>login-page.tsx</code> និង <code>signup.tsx</code>; tests 42 pass។" },
  { type: "user-message", text: "ល្អណាស់ បញ្ចូលវាទៅ" },
  { type: "message", text: "រួចរាល់។ Merge ហើយ និងឆ្លើយតបទៅអ្នករាយការណ៍។" },
  { type: "email-out", subject: "Re: Login គាំងលើ Safari — បានជួសជុល", address: "user@company.com" },
];

/* ─── អ្នកសរសេរកូដ's chat steps ─── */
const CODER_STEPS: DashboardStep[] = [
  { type: "email-in", subject: "ជួសជុល Safari flex gap ក្នុង login page", address: "planner@phneakngar.ai" },
  { type: "message", text: "ទទួលបានហើយ។ កំពុងស្វែងរកការប្រើ flex gap..." },
  { type: "message", markdown: `រកឃើញឯកសារប៉ះពាល់ 2:<br/><code>login-page.tsx:42</code> និង <code>signup.tsx:18</code>។ កំពុងជួសជុលទាំងពីរ។` },
  { type: "message", markdown: "រួចរាល់ — ប្តូរ flex gap ទៅជា margin spacing។ <strong>tests 42 pass ✓</strong>" },
  { type: "email-out", subject: "Re: ជួសជុល Safari flex gap — រួចរាល់, PR #142", address: "planner@phneakngar.ai" },
];

/* ─── Terminal lines ─── */
const TERMINAL_LINES: TerminalLine[] = [
  { spans: [
    { text: "INFO  ", color: "keyword" },
    { text: "[daemon] ", color: "muted" },
    { text: "Task ", color: "info" },
    { text: "PhGFC9l ", color: "string" },
    { text: "claimed agent=", color: "info" },
    { text: "វិចិត្រ", color: "string" },
  ] },
  { spans: [
    { text: "INFO  ", color: "keyword" },
    { text: "[session-runner] ", color: "muted" },
    { text: "send-dm", color: "highlight" },
    { text: ": ", color: "muted" },
    { text: "\"កំពុងពិនិត្យ ហើយផ្ទេរទៅ ដារ៉ា...\"", color: "string" },
  ] },
  { spans: [
    { text: "INFO  ", color: "keyword" },
    { text: "[session-runner] ", color: "muted" },
    { text: "email-send", color: "highlight" },
    { text: ": → ", color: "muted" },
    { text: "coder@phneakngar.ai", color: "string" },
  ] },
  { spans: [
    { text: "INFO  ", color: "keyword" },
    { text: "[daemon] ", color: "muted" },
    { text: "Task ", color: "info" },
    { text: "xK9mT2r ", color: "string" },
    { text: "claimed agent=", color: "info" },
    { text: "ដារ៉ា", color: "string" },
  ] },
  { spans: [
    { text: "INFO  ", color: "keyword" },
    { text: "[session-runner] ", color: "muted" },
    { text: "starting ", color: "info" },
    { text: "(provider=", color: "muted" },
    { text: "claude", color: "string" },
    { text: ")", color: "muted" },
  ] },
  { spans: [
    { text: "INFO  ", color: "keyword" },
    { text: "[session-runner] ", color: "muted" },
    { text: "Bash", color: "highlight" },
    { text: ": grep -rn ", color: "info" },
    { text: "flex-gap", color: "string" },
    { text: " src/", color: "muted" },
  ] },
  { spans: [
    { text: "INFO  ", color: "keyword" },
    { text: "[session-runner] ", color: "muted" },
    { text: "→ found in ", color: "info" },
    { text: "login-page.tsx:42", color: "highlight" },
    { text: ", ", color: "muted" },
    { text: "signup.tsx:18", color: "highlight" },
  ] },
  { spans: [
    { text: "INFO  ", color: "keyword" },
    { text: "[session-runner] ", color: "muted" },
    { text: "Edit", color: "highlight" },
    { text: ": ", color: "muted" },
    { text: "login-page.tsx", color: "string" },
    { text: ", ", color: "muted" },
    { text: "signup.tsx", color: "string" },
  ] },
  { spans: [
    { text: "INFO  ", color: "keyword" },
    { text: "[session-runner] ", color: "muted" },
    { text: "Bash", color: "highlight" },
    { text: ": pnpm test ", color: "info" },
    { text: "→ ", color: "muted" },
    { text: "42 passed ✓", color: "success" },
  ] },
  { spans: [
    { text: "INFO  ", color: "keyword" },
    { text: "[session-runner] ", color: "muted" },
    { text: "email-send", color: "highlight" },
    { text: ": → ", color: "muted" },
    { text: "planner@phneakngar.ai", color: "string" },
  ] },
  { spans: [
    { text: "INFO  ", color: "keyword" },
    { text: "[session-runner] ", color: "muted" },
    { text: "completed ", color: "success" },
    { text: "(duration=18s, tools=4)", color: "muted" },
  ] },
  { spans: [
    { text: "INFO  ", color: "keyword" },
    { text: "[session-runner] ", color: "muted" },
    { text: "send-dm", color: "highlight" },
    { text: ": ", color: "muted" },
    { text: "\"ដារ៉ា បានជួសជុលរួច — បើក PR #142។\"", color: "string" },
  ] },
  { spans: [
    { text: "INFO  ", color: "keyword" },
    { text: "[session-runner] ", color: "muted" },
    { text: "email-send", color: "highlight" },
    { text: ": → ", color: "muted" },
    { text: "user@company.com", color: "string" },
    { text: " — ", color: "muted" },
    { text: "completed", color: "success" },
  ] },
];

/* ─── Timeline ─── */
const TIMELINE: TimelineStep[] = [
  // អ្នករៀបចំ phase 1: user asks, planner responds + delegates
  { id: "user-asks", duration: 2000 },
  { id: "planner-typing", duration: 1500 },
  { id: "planner-msg1", duration: 1500 },
  { id: "planner-email-out", duration: 2000 },
  // Switch to អ្នកសរសេរកូដ
  { id: "switch-to-coder", duration: 1200 },
  { id: "coder-email-in", duration: 1800 },
  { id: "coder-typing", duration: 1200 },
  { id: "coder-msg1", duration: 1500 },
  { id: "coder-msg2", duration: 1800 },
  { id: "coder-msg3", duration: 1800 },
  { id: "coder-email-out", duration: 2000 },
  // Switch back to អ្នករៀបចំ
  { id: "switch-to-planner", duration: 1200 },
  { id: "planner-email-in", duration: 1800 },
  { id: "planner-msg2", duration: 2000 },
  { id: "user-confirms", duration: 1800 },
  { id: "planner-msg3", duration: 1500 },
  { id: "planner-final-email", duration: 3000 },
];

/* ─── Main component ─── */

export function ArchitectureOverview() {
  const sectionRef = useRef<HTMLDivElement>(null);

  const { visibleCount, isResetting, containerRef, isStepVisible } =
    useScriptedTimeline({ steps: TIMELINE, holdAfterComplete: 3500 });

  // Derive dashboard state from timeline
  const dashboardState: DashboardState = useMemo(() => {
    // Which agent is active?
    const showអ្នកសរសេរកូដ = isStepVisible(4) && !isStepVisible(11);
    const activeAgent = showអ្នកសរសេរកូដ ? "coder" as const : "planner" as const;

    let steps: DashboardStep[];
    let vis: number;
    let isTyping: boolean;
    let isWorking: boolean;

    if (showអ្នកសរសេរកូដ) {
      steps = CODER_STEPS;
      vis = 0;
      if (isStepVisible(5)) vis = 1;  // email-in
      if (isStepVisible(7)) vis = 2;  // msg1 "Got it"
      if (isStepVisible(8)) vis = 3;  // msg2 "Found 2 files"
      if (isStepVisible(9)) vis = 4;  // msg3 "Done"
      if (isStepVisible(10)) vis = 5; // email-out
      isTyping = isStepVisible(6) && !isStepVisible(7);
      isWorking = isStepVisible(5) && !isStepVisible(10);
    } else {
      steps = PLANNER_STEPS;
      vis = 0;
      if (isStepVisible(0)) vis = 1;  // user msg
      if (isStepVisible(2)) vis = 2;  // planner msg1
      if (isStepVisible(3)) vis = 3;  // email-out to coder
      if (isStepVisible(12)) vis = 4; // email-in from coder
      if (isStepVisible(13)) vis = 5; // planner msg2 "អ្នកសរសេរកូដ fixed it"
      if (isStepVisible(14)) vis = 6; // user "ល្អណាស់ បញ្ចូលវាទៅ"
      if (isStepVisible(15)) vis = 7; // planner msg3 "Done"
      if (isStepVisible(16)) vis = 8; // email-out to user
      isTyping = isStepVisible(1) && !isStepVisible(2);
      isWorking = isStepVisible(0) && !isStepVisible(16);
    }

    return { activeAgent, steps, visibleCount: vis, isTyping, isWorking };
  }, [visibleCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Terminal: each timeline step from 0 onward maps to a line
  const terminalVisible = useMemo(() => {
    // Map timeline steps to terminal lines
    const mapping = [0, 1, 2, 3, 4, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12];
    let count = 0;
    for (let i = 0; i < mapping.length; i++) {
      if (isStepVisible(i)) count = mapping[i] + 1;
    }
    return Math.min(count, TERMINAL_LINES.length);
  }, [visibleCount]); // eslint-disable-line react-hooks/exhaustive-deps

  useGSAP(
    () => {
      gsap.from(".arch-title", {
        y: 30, opacity: 0, duration: 0.6,
        scrollTrigger: { trigger: sectionRef.current, start: "top 75%", toggleActions: "play none none none" },
      });
      gsap.from(".arch-demo-container", {
        y: 40, opacity: 0, duration: 0.7,
        scrollTrigger: { trigger: ".arch-demo-container", start: "top 70%", toggleActions: "play none none none" },
      });
    },
    { scope: sectionRef },
  );

  return (
    <section
      ref={sectionRef}
      className="relative flex flex-col items-center justify-center px-6 py-24 lg:py-32"
      style={{ backgroundColor: "var(--landing-bg)" }}
    >
      {/* Title */}
      <div className="arch-title mb-16 text-center">
        <div
          className="mb-3 text-xs uppercase tracking-[0.3em]"
          style={{ fontFamily: "var(--font-mono)", color: "var(--landing-text-muted)" }}
        >
          របៀបដំណើរការ
        </div>
        <h2 style={{ fontFamily: "var(--font-crt)", color: "var(--landing-text)", fontSize: "clamp(1.75rem, 4vw, 3rem)" }}>
          ភ្នាក់ងារមូលដ្ឋាន ឈានទៅពិភពខាងក្រៅ
        </h2>
        <p
          className="mt-2 max-w-2xl mx-auto"
          style={{ fontFamily: "var(--font-mono)", color: "var(--landing-text-muted)", fontSize: "0.85rem" }}
        >
          ភ្នាក់ងាររត់លើម៉ាស៊ីនរបស់អ្នក និងមានសិទ្ធិប្រើឧបករណ៍របស់អ្នក។
          ភ្នាក់ងារ ភ្ជាប់វាទៅអ៊ីមែល ផ្ទាំងគ្រប់គ្រង និងពិភពខាងក្រៅ។
        </p>
      </div>

      {/* Triple-window demo */}
      <div
        ref={containerRef}
        className={`arch-demo-container relative w-full max-w-5xl mx-auto h-130 lg:h-120 transition-opacity duration-300 ${
          isResetting ? "opacity-0" : "opacity-100"
        }`}
      >
        {/* Desktop — top-left, behind */}
        <div className="absolute top-0 left-0 w-[60%] h-[88%] z-10 hidden md:block">
          <DemoWindow title="ភ្នាក់ងារ Desktop" className="h-full shadow-[0_28px_70px_rgba(0,0,0,0.14),0_14px_32px_rgba(0,0,0,0.1)]">
            <DemoDashboard state={dashboardState} config={ARCH_CONFIG} />
          </DemoWindow>
        </div>

        {/* Mobile + Terminal — side by side, overlapping desktop from left */}
        <div className="absolute top-[25%] left-[40%] right-0 h-[75%] z-20 hidden md:flex gap-3">
          {/* Mobile — phone frame */}
          <div className="w-45 shrink-0 h-full hidden lg:block">
            <div className="h-full rounded-[1.5rem] border-[3px] border-neutral-700 bg-background shadow-[0_28px_70px_rgba(0,0,0,0.18),0_14px_32px_rgba(0,0,0,0.12)] overflow-hidden flex flex-col dark">
              {/* Dynamic Island */}
              <div className="flex justify-center pt-1 shrink-0">
                <div className="px-2 py-px bg-neutral-800 rounded-full flex items-center justify-center">
                  <span className="text-[8px] text-neutral-400">ភ្នាក់ងារ Mobile</span>
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <DemoMobile state={dashboardState} config={ARCH_CONFIG} />
              </div>
              {/* Home indicator */}
              <div className="flex justify-center py-1 shrink-0">
                <div className="w-12 h-1 bg-muted-foreground/30 rounded-full" />
              </div>
            </div>
          </div>
          {/* Terminal */}
          <div className="flex-1 min-w-0 h-full">
            <DemoWindow title="ម៉ាស៊ីនរបស់អ្នក" className="h-full shadow-[0_28px_70px_rgba(0,0,0,0.18),0_14px_32px_rgba(0,0,0,0.12)]">
              <DemoTerminal lines={TERMINAL_LINES} visibleCount={terminalVisible} />
            </DemoWindow>
          </div>
        </div>

        {/* Responsive (< md): mobile phone only */}
        <div className="md:hidden flex justify-center h-full">
          <div className="w-65 h-full rounded-[2rem] border-[3px] border-neutral-700 bg-background shadow-lg overflow-hidden flex flex-col dark">
            <div className="flex justify-center pt-2 shrink-0">
              <div className="px-4 py-1 bg-neutral-800 rounded-full flex items-center justify-center">
                <span className="text-[11px] text-neutral-400 leading-none">ភ្នាក់ងារ Mobile</span>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <DemoMobile state={dashboardState} config={ARCH_CONFIG} />
            </div>
            <div className="flex justify-center py-1 shrink-0">
              <div className="w-16 h-1 bg-muted-foreground/30 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
