"use client";

import { useRef, useCallback, useState, useEffect, useMemo } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { SplitText } from "gsap/SplitText";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

gsap.registerPlugin(SplitText);

// Key layout: 3 rows of oval keys (front-facing view)
const KEY_ROWS = [9, 7, 9];

interface TypewriterEmail {
  from: string;
  to: string;
  subject: string;
  body: string;
}

/** Clean, professional emails — default for the homepage. First email is shown on load, rest are randomly picked. */
const EMAILS_DEFAULT: TypewriterEmail[] = [
  {
    from: "jarvis@phneakngar.ai",
    to: "you@email.com",
    subject: "រីករាយថ្ងៃកំណើត!",
    body: "រីករាយថ្ងៃកំណើត! ខ្ញុំចងចាំបានច្បាស់ \u2014 April 17th។ សូមឲ្យថ្ងៃនេះស្រួល និងសមនឹងអ្វីដែលអ្នកខំប្រឹង។ សម្រាកបន្តិច ហើយខ្ញុំនឹងចាត់ការផ្នែកដែលនៅសល់។",
  },
  {
    from: "you@email.com",
    to: "jarvis@phneakngar.ai",
    subject: "រៀបចំកំណត់ត្រាប្រជុំសប្តាហ៍នេះ",
    body: "Jarvis, ខ្ញុំបានដាក់កំណត់ត្រាប្រជុំទាំងអស់ទៅក្នុង /docs/notes។ ជួយរៀបតាមគម្រោង ដក action items ហើយសង្ខេបឲ្យផង។ ចំណុចណាដែលបន្ទាន់ សូមដាក់សញ្ញាឲ្យខ្ញុំដឹង។",
  },
  {
    from: "jarvis@phneakngar.ai",
    to: "you@email.com",
    subject: "សង្ខេបព្រឹកនេះ \u2014 Apr 17",
    body: "អរុណសួស្តី។ យប់មិញ CI លើ main បានជោគជ័យ, PR ពីរត្រូវបាន merge, ហើយគ្មានការជូនដំណឹង។ ថ្ងៃនេះមាន standup ម៉ោង 10 ព្រឹក និង design review ម៉ោង 2 រសៀល។ ខ្ញុំបាន rebase branch របស់អ្នក និងរត់ linter រួចហើយ។",
  },
  {
    from: "jarvis@phneakngar.ai",
    to: "you@email.com",
    subject: "Re: អ្នកនៅទីនោះទេ?",
    body: "នៅជានិច្ច។ ខ្ញុំបានធ្វើការតាំងពីម៉ោង 3 ព្រឹក \u2014 សម្អាត inbox, ចាត់អាទិភាព bug reports ពីរ, ហើយរៀប deploy ទុករង់ចាំអ្នក។ ទៅយកកាហ្វេបាន ខ្ញុំនៅទីនេះពេលអ្នកត្រឡប់មក។",
  },
  {
    from: "you@email.com",
    to: "jarvis@phneakngar.ai",
    subject: "ជួយ refactor auth middleware បានទេ?",
    body: "ការគ្រប់គ្រង session ក្នុង src/middleware/auth.ts ចាប់ផ្តើមរញ៉េរញ៉ៃ។ ជួយបំបែកជាមុខងារតូចៗ បន្ថែម error types ត្រឹមត្រូវ ហើយធានាថា tests នៅតែ pass។ កុំប្តូរ public API។",
  },
  {
    from: "jarvis@phneakngar.ai",
    to: "you@email.com",
    subject: "សង្ខេបសប្តាហ៍ \u2014 Apr 14\u201317",
    body: "សប្តាហ៍នេះ: PR 12 ត្រូវបាន merge, bug 3 ត្រូវបានបិទ, test coverage ឡើងដល់ 86%។ អ្នកបានចំណាយពេលច្រើនលើ calendar feature។ រំលឹក: អ្នកធ្លាប់និយាយថាចង់ពិនិត្យ caching strategy វិញ។ ឲ្យខ្ញុំរៀប proposal ទេ?",
  },
  {
    from: "you@email.com",
    to: "jarvis@phneakngar.ai",
    subject: "ស្រាវជ្រាវ vector DB សម្រាប់ memory",
    body: "ខ្ញុំកំពុងគិតបន្ថែម semantic search ទៅ memory system។ ជួយប្រៀបធៀប pgvector, Qdrant និង Turbopuffer ផង។ ផ្តោតលើ local-first setup, latency និងរបៀបភ្ជាប់ជាមួយ SQLite stack របស់យើង។",
  },
  {
    from: "jarvis@phneakngar.ai",
    to: "you@email.com",
    subject: "ជូនដំណឹង \u2014 CI លើ main បរាជ័យ",
    body: "Build ខូចប្រហែល 20 នាទីមុន។ Test ដែលបរាជ័យគឺ calendar-month-grid.test.ts \u2014 មើលទៅជា off-by-one ក្នុង week boundary logic ពី commit ចុងក្រោយរបស់អ្នក។ ខ្ញុំមាន fix រួចហើយ។ ឲ្យខ្ញុំ push ទេ?",
  },
  {
    from: "you@email.com",
    to: "jarvis@phneakngar.ai",
    subject: "រៀបចំ demo សម្រាប់ថ្ងៃស្អែក",
    body: "យើងនឹង demo ក្រុមនៅថ្ងៃស្អែកម៉ោង 2 រសៀល។ ជួយធានាថា staging ទាន់សម័យ, seed test data ដែលស្រដៀងពិត, ហើយសរសេរ walkthrough ខ្លីមួយ។ សូមឲ្យក្រោម 5 នាទី។",
  },
];


const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTH_NAMES = [
  "មករា",
  "កុម្ភៈ",
  "មីនា",
  "មេសា",
  "ឧសភា",
  "មិថុនា",
  "កក្កដា",
  "សីហា",
  "កញ្ញា",
  "តុលា",
  "វិច្ឆិកា",
  "ធ្នូ",
];

function formatKhmerDate(month: number, day: number) {
  return `${MONTH_NAMES[month]} ${day}`;
}

interface Birthday {
  month: number;
  day: number;
}

function BirthdayPicker({
  value,
  onSave,
}: {
  value: Birthday | null;
  onSave: (v: Birthday) => void;
  onClear: () => void;
}) {
  const [month, setMonth] = useState(value?.month ?? 0);
  const [day, setDay] = useState(value?.day ?? 1);
  const maxDay = DAYS_IN_MONTH[month];

  useEffect(() => {
    if (day > maxDay) setDay(maxDay);
  }, [month, day, maxDay]);

  return (
    <div className="tw-birthday-picker">
<p className="tw-birthday-title">ថ្ងៃកំណើតរបស់អ្នកថ្ងៃណា?</p>
      <div className="tw-birthday-selects">
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {MONTH_NAMES.map((name, i) => (
            <option key={i} value={i}>
              {name}
            </option>
          ))}
        </select>
        <select value={day} onChange={(e) => setDay(Number(e.target.value))}>
          {Array.from({ length: maxDay }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>
      </div>
      <button className="tw-birthday-save" onClick={() => onSave({ month, day })}>
រក្សាទុក
      </button>
    </div>
  );
}

// CSS variables the typewriter CSS needs — self-provided so
// the component works outside the `.landing` scope too.
const TW_VARS: React.CSSProperties = {
  "--tw-body": "oklch(0.25 0.01 60)",
  "--tw-body-hi": "oklch(0.30 0.01 60)",
  "--tw-body-lo": "oklch(0.18 0.01 55)",
  "--tw-body-top": "oklch(0.28 0.01 60)",
  "--tw-chrome": "oklch(0.72 0.01 75)",
  "--tw-chrome-hi": "oklch(0.82 0.005 80)",
  "--tw-paper": "oklch(0.97 0.008 80)",
  "--tw-blob": "oklch(0.88 0.025 82)",
  "--tw-roller": "oklch(0.15 0.01 55)",
} as React.CSSProperties;

interface TypewriterVisualProps {
  className?: string;
  /** When true, keyboard Enter cycles emails. Default false. */
  interactive?: boolean;
  /** Delay (seconds) before the paper-feed entrance animation starts. */
  entranceDelay?: number;
  /** Custom paper content. When provided, replaces the default email carousel and disables cycling. */
  paper?: React.ReactNode;
  /** Email scheme to display. Defaults to EMAILS_DEFAULT. Ignored when `paper` is provided. */
  emails?: TypewriterEmail[];
  /** Scale factor for the background blob. Default 1. */
  blobScale?: number;
  /** Bottom offset for the blob, e.g. "10%" or "20%". Default "-10%". */
  blobBottom?: string;
}

/**
 * Full 3D typewriter with paper-feed animation, email cycling, and mouse parallax.
 * `interactive` controls whether keyboard Enter triggers email cycling —
 * only the homepage should set this to true.
 */
export function TypewriterVisual({
  className,
  interactive = false,
  entranceDelay = 0.3,
  paper,
  emails = EMAILS_DEFAULT,
  blobScale = 1,
  blobBottom,
}: TypewriterVisualProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const paperTlRef = useRef<gsap.core.Timeline | null>(null);
  const isAnimatingRef = useRef(false);
  const seenRef = useRef<Set<number>>(new Set([0]));
  const [emailIndex, setEmailIndex] = useState(0);

  const [birthday, setBirthday] = useLocalStorage<Birthday | null>("phneakngar-birthday", null);
  const [hPopoverOpen, setHPopoverOpen] = useState(false);
  const [paperKey, setPaperKey] = useState(0);

const effectiveEmails = useMemo(() => {
if (!birthday) return emails;
const longDate = formatKhmerDate(birthday.month, birthday.day);
const shortDate = longDate;
    return emails.map((e, i) => {
      if (i !== 0) return e;
      return {
        ...e,
        body: e.body.replace("April 17th", longDate).replace("Apr 17", shortDate),
      };
    });
  }, [emails, birthday]);

  useEffect(() => {
    if (!birthday) return;
    const now = new Date();
    if (now.getMonth() === birthday.month && now.getDate() === birthday.day) {
      setEmailIndex(0);
    }
  }, [birthday]);


  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const el = containerRef.current;
      if (!el) return;
      const scene = el.querySelector<HTMLElement>(".typewriter-scene");
      if (!scene) return;
      const rect = el.getBoundingClientRect();
      const nx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
      const ny = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
      scene.style.transition = "transform 0.12s ease-out";
      scene.style.transform = `rotateY(${-20 + nx * 15}deg) rotateX(${10 + ny * -10}deg)`;
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const scene = el.querySelector<HTMLElement>(".typewriter-scene");
    if (!scene) return;
    scene.style.transition = "transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)";
    scene.style.transform = "";
  }, []);

  // Play the paper feed animation — paper slides up, text types in
  const playPaperFeed = useCallback(() => {
    const root = containerRef.current;
    if (!root) return;

    if (paperTlRef.current) {
      paperTlRef.current.kill();
    }

    const bodyEl = root.querySelector(".tw-email-body");
    if (!bodyEl) return;
    const bodySplit = SplitText.create(bodyEl, { type: "words" });

    const paper = root.querySelector<HTMLElement>(".tw-paper");
    const paperH = paper ? paper.offsetHeight : 300;
    gsap.set(paper, { y: paperH, opacity: 1 });
    gsap.set(root.querySelectorAll(".tw-email-line"), { opacity: 0 });
    gsap.set(bodySplit.words, { opacity: 0 });

    const tl = gsap.timeline({
      onComplete: () => {
        isAnimatingRef.current = false;
      },
    });

    tl.to(paper, {
      y: 0,
      duration: 3,
      ease: "power1.out",
    })
      .to(root.querySelectorAll(".tw-email-line"), {
        opacity: 1,
        duration: 0.15,
        stagger: 0.3,
        ease: "none",
      }, "<+=0.3")
      .to(bodySplit.words, {
        opacity: 1,
        duration: 0.01,
        stagger: 0.06,
        ease: "none",
      }, "<+=0.5");

    paperTlRef.current = tl;
  }, []);

  useEffect(() => {
    if (paperKey === 0) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => playPaperFeed());
    });
  }, [paperKey, playPaperFeed]);

  const handleReturnKey = useCallback(() => {
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;

    const root = containerRef.current;
    if (!root) return;

    if (paperTlRef.current) {
      paperTlRef.current.kill();
    }

    const paper = root.querySelector<HTMLElement>(".tw-paper");
    const paperH = paper ? paper.offsetHeight : 300;
    gsap.to(paper, {
      y: paperH,
      duration: 0.4,
      ease: "power2.in",
      onComplete: () => {
        setEmailIndex(() => {
          const unseen = Array.from({ length: effectiveEmails.length }, (_, i) => i)
            .filter((i) => !seenRef.current.has(i));
          if (unseen.length === 0) {
            seenRef.current = new Set();
          }
          const pool = unseen.length > 0 ? unseen : Array.from({ length: effectiveEmails.length }, (_, i) => i);
          const next = pool[Math.floor(Math.random() * pool.length)];
          seenRef.current.add(next);
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              playPaperFeed();
            });
          });
          return next;
        });
      },
    });
  }, [playPaperFeed, effectiveEmails.length]);

  // Keyboard Enter listener — only when interactive
  useEffect(() => {
    if (!interactive) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleReturnKey();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [interactive, handleReturnKey]);

  // Entrance animation — paper feeds in on mount
  useGSAP(
    () => {
      const root = containerRef.current;
      if (!root) return;

      const bodyEl = root.querySelector(".tw-email-body");
      if (!bodyEl) return;
      const bodySplit = SplitText.create(bodyEl, { type: "words" });

      const paperEl = root.querySelector<HTMLElement>(".tw-paper");
      const paperH = paperEl ? paperEl.offsetHeight : 300;
      gsap.set(paperEl, { y: paperH, opacity: 1 });
      gsap.set(root.querySelectorAll(".tw-email-line"), { opacity: 0 });
      gsap.set(bodySplit.words, { opacity: 0 });

      const tl = gsap.timeline({ delay: entranceDelay });

      tl.to(paperEl, {
        y: 0,
        duration: 3,
        ease: "power1.out",
      })
        .to(root.querySelectorAll(".tw-email-line"), {
          opacity: 1,
          duration: 0.15,
          stagger: 0.3,
          ease: "none",
        }, "<+=0.3")
        .to(bodySplit.words, {
          opacity: 1,
          duration: 0.01,
          stagger: 0.06,
          ease: "none",
        }, "<+=0.5");

      paperTlRef.current = tl;
    },
    { scope: containerRef }
  );

  const email = effectiveEmails[emailIndex];

  return (
    <div
      ref={containerRef}
      className={`typewriter-visual${className ? ` ${className}` : ""}`}
      style={TW_VARS}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="typewriter-blob" style={(blobScale !== 1 || blobBottom) ? { "--blob-scale": blobScale, ...(blobBottom ? { "--blob-bottom": blobBottom } : {}) } as React.CSSProperties : undefined} />

      <div className="typewriter-scene">
        <div className="tw-machine">
          <div className="tw-body">
            <div className="tw-body-back" />
            <div className="tw-body-left" />
            <div className="tw-body-right" />
            <div className="tw-body-top" />
            <div className="tw-body-bottom" />

            <div className="tw-body-front">
              {/* Paper track — clips paper as it feeds out */}
              <div className="tw-paper-track">
                <div className="tw-paper" key={paper ? "custom" : `${emailIndex}-${paperKey}`}>
                  {paper ?? (
                    <>
                      <div
                        className="tw-email-headers"
                        style={{
                          fontFamily: "var(--font-crt)",
                          fontSize: "15px",
                          color: "oklch(0.45 0.01 55)",
                          lineHeight: 1.7,
                          borderBottom: "1px solid oklch(0.15 0.01 55 / 10%)",
                          paddingBottom: "10px",
                          marginBottom: "12px",
                        }}
                      >
                        <div className="tw-email-line">
<span style={{ color: "oklch(0.15 0.01 55)" }}>ពី:</span>{" "}
                          {email.from}
                        </div>
                        <div className="tw-email-line">
<span style={{ color: "oklch(0.15 0.01 55)" }}>ទៅ:</span>{" "}
                          {email.to}
                        </div>
                        <div className="tw-email-line">
<span style={{ color: "oklch(0.15 0.01 55)" }}>ប្រធានបទ:</span>{" "}
                          {email.subject}
                        </div>
                      </div>

                      <div
                        className="tw-email-body"
                        aria-hidden
                        style={{
                          fontFamily: "var(--font-crt)",
                          color: "oklch(0.45 0.01 55)",
                          fontSize: "17px",
                          lineHeight: 1.6,
                        }}
                      >
                        {email.body}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Roller with knobs */}
              <div className="tw-roller-assembly">
                <div className="tw-knob tw-knob-left" />
                <div className="tw-roller" />
                <div className="tw-knob tw-knob-right" />
              </div>

              {/* Type-bar fan */}
              <div className="tw-typebar-fan" />

              {/* Key rows + return key */}
              <div className="tw-keys-layer">
                {KEY_ROWS.map((count, ri) => (
                  <div key={ri} className="tw-key-row">
                    {Array.from({ length: count }).map((_, ki) => {
                      if (ri === 2 && ki === 4 && !paper) {
                        return (
                          <Popover key={ki} open={hPopoverOpen} onOpenChange={setHPopoverOpen}>
                            <PopoverTrigger
                              className="tw-key tw-h-key"
                              aria-label="H"
                              render={<button />}
                            >
                              <span className="tw-h-label">H</span>
                            </PopoverTrigger>
                            <PopoverContent
                              className="tw-birthday-popover"
                              sideOffset={12}
                              align="center"
                            >
                              <BirthdayPicker
                                value={birthday}
                                onSave={(v) => {
                                  setBirthday(v);
                                  setHPopoverOpen(false);
                                  setEmailIndex(0);
                                  setPaperKey((k) => k + 1);
                                }}
                                onClear={() => {
                                  setBirthday(null);
                                  setHPopoverOpen(false);
                                }}
                              />
                            </PopoverContent>
                          </Popover>
                        );
                      }
                      return <div key={ki} className="tw-key" />;
                    })}
                    {ri === 1 && !paper && (
                      <button
                        className="tw-key tw-return-key"
                        onClick={handleReturnKey}
                        aria-label="Return — load next email"
                      >
                        <span className="tw-return-label">{"\u21B5"}</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Bars */}
              <div className="tw-bars">
                <div className="tw-bar tw-bar-long" />
                <div className="tw-bar tw-bar-short" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
