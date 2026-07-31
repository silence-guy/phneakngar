import type { Metadata } from "next";
import { getSession } from "@/lib/session";
import { TEMPLATES, TEMPLATE_CATEGORIES, getTemplates } from "@/lib/templates";
import { TemplatesClient } from "./client";

const description =
  "Browse pre-built AI company templates. Deploy a full AI company in minutes — developers, content creators, research analysts, and more.";

export const metadata: Metadata = {
  title: "Templates",
  description,
  alternates: {
    canonical: "https://phneakngar.ai/templates",
    languages: {
      en: "https://phneakngar.ai/templates",
      km: "https://phneakngar.ai/km/templates",
    },
  },
  openGraph: {
    title: "AI Company Templates — ភ្នាក់ងារ",
    description,
    url: "https://phneakngar.ai/templates",
    images: [{ url: "/og?title=AI Company Templates", width: 1200, height: 630 }],
    locale: "en_US",
    alternateLocale: ["km_KH"],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Company Templates — ភ្នាក់ងារ",
    description,
    images: ["/og?title=AI Company Templates"],
  },
};

// JSON-LD / SEO stays English for search engines; UI uses getTemplates() (KM default).
const itemListJsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "AI Company Templates",
  description,
  numberOfItems: TEMPLATES.length,
  itemListElement: TEMPLATES.map((template, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: template.name,
    description: template.description,
    url: `https://phneakngar.ai/templates/${template.id}`,
  })),
};

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await getSession();
  const params = await searchParams;
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <TemplatesClient
        templates={getTemplates()}
        categories={TEMPLATE_CATEGORIES}
        isLoggedIn={!!session}
        workspaceId={params.workspace_id}
      />
    </>
  );
}
