import type { Metadata } from "next";
import { ErrorPageView } from "@/app/error-page-view";

export const metadata: Metadata = {
  title: "Page Not Found",
  description: "The page you're looking for doesn't exist or has been moved.",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return <ErrorPageView variant="notFound" />;
}
