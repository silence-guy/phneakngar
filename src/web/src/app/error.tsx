"use client";

import Link from "next/link";
import { TypewriterVisual } from "@/components/typewriter-visual";
import { ERROR_PAGE_LABELS } from "@/app/error-page-labels";
import { toPublicPhneakngarAddress } from "@/lib/email-domain";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      className="landing flex flex-1 flex-col items-center justify-center px-6"
      style={{ backgroundColor: "var(--landing-bg)" }}
    >
      <div className="w-full max-w-md">
        <TypewriterVisual
          entranceDelay={0.3}
          paper={
            <>
              <div
                className="tw-email-headers"
                style={{
                  fontFamily: "var(--font-crt)",
                  fontSize: "15px",
                  color: "var(--landing-text-muted)",
                  lineHeight: 1.7,
                  borderBottom: "1px solid oklch(0.15 0.01 55 / 10%)",
                  paddingBottom: "10px",
                  marginBottom: "12px",
                }}
              >
                <div className="tw-email-line">
                  <span style={{ color: "var(--landing-text)" }}>{ERROR_PAGE_LABELS.fromLabel}</span>{" "}
                  {toPublicPhneakngarAddress("system")}
                </div>
                <div className="tw-email-line">
                  <span style={{ color: "var(--landing-text)" }}>{ERROR_PAGE_LABELS.toLabel}</span>{" "}
                  {ERROR_PAGE_LABELS.toRecipient}
                </div>
                <div className="tw-email-line">
                  <span style={{ color: "var(--landing-text)" }}>{ERROR_PAGE_LABELS.subjectLabel}</span>{" "}
                  {ERROR_PAGE_LABELS.error.subject}
                </div>
              </div>

              <div
                className="tw-email-body"
                style={{
                  fontFamily: "var(--font-crt)",
                  color: "var(--landing-text)",
                  fontSize: "17px",
                  lineHeight: 1.6,
                }}
              >
                {ERROR_PAGE_LABELS.error.body}
              </div>
            </>
          }
        />
      </div>

      <div className="mt-8 flex items-center gap-4">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-5 py-2 text-xs uppercase tracking-widest transition-opacity duration-150 hover:opacity-70"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--landing-bg)",
            backgroundColor: "var(--landing-text)",
          }}
        >
          {ERROR_PAGE_LABELS.error.tryAgain}
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2 text-xs uppercase tracking-widest transition-opacity duration-150 hover:opacity-70"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--landing-text)",
            border: "1px solid var(--landing-border)",
          }}
        >
          {ERROR_PAGE_LABELS.goHome}
        </Link>
      </div>
    </div>
  );
}
