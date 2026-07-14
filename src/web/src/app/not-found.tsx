import type { Metadata } from "next";
import Link from "next/link";
import { TypewriterVisual } from "@/components/typewriter-visual";
import { ERROR_PAGE_LABELS } from "@/app/error-page-labels";
import { toPublicPhneakngarAddress } from "@/lib/email-domain";

export const metadata: Metadata = {
  title: "Page Not Found",
  description: "The page you're looking for doesn't exist or has been moved.",
  robots: { index: false, follow: true },
};

export default function NotFound() {
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
                  {toPublicPhneakngarAddress("postmaster")}
                </div>
                <div className="tw-email-line">
                  <span style={{ color: "var(--landing-text)" }}>{ERROR_PAGE_LABELS.toLabel}</span>{" "}
                  {ERROR_PAGE_LABELS.toRecipient}
                </div>
                <div className="tw-email-line">
                  <span style={{ color: "var(--landing-text)" }}>{ERROR_PAGE_LABELS.subjectLabel}</span>{" "}
                  {ERROR_PAGE_LABELS.notFound.subject}
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
                {ERROR_PAGE_LABELS.notFound.body}
              </div>
            </>
          }
        />
      </div>

      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 px-5 py-2 text-xs uppercase tracking-widest transition-opacity duration-150 hover:opacity-70"
        style={{
          fontFamily: "var(--font-mono)",
          color: "var(--landing-bg)",
          backgroundColor: "var(--landing-text)",
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        {ERROR_PAGE_LABELS.goHome}
      </Link>
    </div>
  );
}
