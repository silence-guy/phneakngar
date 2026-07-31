import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { getSession } from "@/lib/session";
import { getPublicEmailDomain } from "@/lib/email-domain";


const HomePage = dynamic(() => import("@/components/home/home-page").then(m => ({ default: m.HomePage })), {
  ssr: true,
});

export const metadata: Metadata = {
  title: "Phneakngar — Your Agent. Always Working.",
  description:
    "Give your AI agents a job and let them handle it. Phneakngar agents work while you rest.",
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is Phneakngar?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Phneakngar is an AI agent orchestration layer for personal companies. It lets you assign roles, give tasks to AI agents, and keep them collaborating, running continuously, and learning on their own.",
      },
    },
    {
      "@type": "Question",
      name: "How do I communicate with AI agents?",
      acceptedAnswer: {
        "@type": "Answer",
        text: `Each agent gets its own email handle at @${getPublicEmailDomain()}. You can send instructions via email and the agent will collaborate on tasks and respond. You can also manage your company through the agent dashboard.`,
      },
    },
    {
      "@type": "Question",
      name: "Is Phneakngar free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Phneakngar offers a free tier to get your personal company started.",
      },
    },
  ],
};

export default async function Page() {
  const session = await getSession();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <HomePage isLoggedIn={!!session} />
    </>
  );
}
