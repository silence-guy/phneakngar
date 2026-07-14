import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { getSession } from "@/lib/session";
import { getPublicEmailDomain } from "@/lib/email-domain";


const HomePage = dynamic(() => import("@/components/home/home-page").then(m => ({ default: m.HomePage })), {
  ssr: true,
});

export const metadata: Metadata = {
  title: "ភ្នាក់ងារ — ក្រុមហ៊ុនផ្ទាល់ខ្លួនរបស់អ្នក",
  description:
    "ដំណើរការក្រុមហ៊ុនផ្ទាល់ខ្លួនជាមួយភ្នាក់ងារ AI ដែលសហការគ្នា បើកដំណើរការជានិច្ច និងរៀនពីរាល់ភារកិច្ច។ ផ្តល់អ៊ីមែលដល់ភ្នាក់ងារនីមួយៗ កំណត់តួនាទី ហើយឲ្យពួកគេធ្វើការជូនអ្នកពេញម៉ោង។",
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "តើ ភ្នាក់ងារ ជាអ្វី?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "ភ្នាក់ងារ គឺជាស្រទាប់សម្របសម្រួលសម្រាប់ក្រុមហ៊ុនផ្ទាល់ខ្លួន។ វាអនុញ្ញាតឲ្យអ្នកកំណត់តួនាទី ផ្តល់ការងារឲ្យភ្នាក់ងារ AI ហើយរក្សាពួកគេឲ្យសហការ បើកដំណើរការជានិច្ច និងរៀនដោយខ្លួនឯង។",
      },
    },
    {
      "@type": "Question",
      name: "តើខ្ញុំទាក់ទងជាមួយភ្នាក់ងារ AI ដូចម្តេច?",
      acceptedAnswer: {
        "@type": "Answer",
        text: `ភ្នាក់ងារនីមួយៗមានអាសយដ្ឋាន @${getPublicEmailDomain()} ផ្ទាល់ខ្លួន។ អ្នកអាចផ្ញើការណែនាំតាមអ៊ីមែល ហើយភ្នាក់ងារនឹងសហការលើភារកិច្ច និងឆ្លើយតប។ អ្នកក៏អាចគ្រប់គ្រងក្រុមហ៊ុនតាមផ្ទាំងគ្រប់គ្រង ភ្នាក់ងារ។`,
      },
    },
    {
      "@type": "Question",
      name: "តើ ភ្នាក់ងារ អាចប្រើដោយឥតគិតថ្លៃទេ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "បាន។ ភ្នាក់ងារ មានកម្រិតឥតគិតថ្លៃ ដើម្បីចាប់ផ្តើមក្រុមហ៊ុនផ្ទាល់ខ្លួនរបស់អ្នក។",
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
