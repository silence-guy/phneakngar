"use client";

import { ErrorPageView } from "@/app/error-page-view";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorPageView variant="error" onReset={reset} />;
}
