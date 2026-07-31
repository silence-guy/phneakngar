"use client";

import Link from "next/link";
import { TypewriterVisual } from "@/components/typewriter-visual";
import { LandingLocaleProvider, useLandingLocale } from "@/components/home/use-landing-locale";
import { getErrorPageLabels } from "@/app/error-page-labels";
import { toPublicPhneakngarAddress } from "@/lib/email-domain";

export function ErrorPageView({
  variant,
  onReset,
}: {
  variant: "error" | "notFound";
  onReset?: () => void;
}) {
  return (
    <LandingLocaleProvider>
      <ErrorPageViewInner variant={variant} onReset={onReset} />
    </LandingLocaleProvider>
  );
}

function ErrorPageViewInner({
  variant,
  onReset,
}: {
  variant: "error" | "notFound";
  onReset?: () => void;
}) {
  const { locale } = useLandingLocale();
  const labels = getErrorPageLabels(locale);
  const isError = variant === "error";

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
                  borderBottom: "1px solid rgba(0, 0, 0, 0.1)",
                  paddingBottom: "10px",
                  marginBottom: "12px",
                }}
              >
                <div className="tw-email-line">
                  <span style={{ color: "var(--landing-text)" }}>{labels.fromLabel}</span>{" "}
                  {toPublicPhneakngarAddress(isError ? "system" : "postmaster")}
                </div>
                <div className="tw-email-line">
                  <span style={{ color: "var(--landing-text)" }}>{labels.toLabel}</span>{" "}
                  {labels.toRecipient}
                </div>
                <div className="tw-email-line">
                  <span style={{ color: "var(--landing-text)" }}>{labels.subjectLabel}</span>{" "}
                  {isError ? labels.error.subject : labels.notFound.subject}
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
                {isError ? labels.error.body : labels.notFound.body}
              </div>
            </>
          }
        />
      </div>

      <div className="mt-8 flex items-center gap-4">
        {isError && onReset && (
          <button
            onClick={onReset}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs uppercase tracking-widest transition-opacity duration-150 hover:opacity-70"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--landing-bg)",
              backgroundColor: "var(--landing-text)",
            }}
          >
            {labels.error.tryAgain}
          </button>
        )}
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2 text-xs uppercase tracking-widest transition-opacity duration-150 hover:opacity-70"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--landing-text)",
            border: "1px solid var(--landing-border)",
          }}
        >
          {labels.goHome}
        </Link>
      </div>
    </div>
  );
}
