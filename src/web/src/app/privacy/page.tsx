import type { Metadata } from "next";
import { PrivacyContent } from "./privacy-client";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Phneakngar collects, uses, and protects your personal information.",
  alternates: {
    languages: {
      en: "/privacy",
      km: "/km/privacy",
    },
  },
  openGraph: {
    title: "Privacy Policy — ភ្នាក់ងារ",
    description: "How Phneakngar collects, uses, and protects your personal information.",
    images: [{ url: "/og?title=Privacy%20Policy", width: 1200, height: 630 }],
    locale: "en_US",
    alternateLocale: ["km_KH"],
  },
};

export default function PrivacyPage() {
  return <PrivacyContent />;
}
