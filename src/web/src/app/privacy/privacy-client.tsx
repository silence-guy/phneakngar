"use client";

import { PublicLayout } from "@/components/public-layout";
import { LocaleToggle } from "@/components/locale-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { LandingLocaleProvider, useLandingLocale } from "@/components/home/use-landing-locale";
import { getPrivacyLabels, type PrivacyListItem } from "./privacy-labels";

const linkClass =
  "underline underline-offset-3 decoration-foreground/30 hover:decoration-foreground/60 transition-colors";

function ListItemContent({ item }: { item: PrivacyListItem }) {
  if (typeof item === "string") {
    return <span>{item}</span>;
  }
  return (
    <span>
      <strong>{item.lead}</strong>
      {item.rest}
    </span>
  );
}

function PrivacyBlock({ block }: { block: (ReturnType<typeof getPrivacyLabels>)["sections"][number]["blocks"][number] }) {
  switch (block.kind) {
    case "p":
      return <p className="text-foreground/80">{block.text}</p>;
    case "h3":
      return <h3 className="text-lg font-medium mt-8 mb-3">{block.text}</h3>;
    case "h4":
      return <h4 className="text-base font-medium mt-6 mb-2">{block.text}</h4>;
    case "ul":
      return (
        <ul className="list-disc pl-6 mt-3 space-y-2 text-foreground/80">
          {block.items.map((item, i) => (
            <li key={i}>
              <ListItemContent item={item} />
            </li>
          ))}
        </ul>
      );
    case "cloudflare":
      return (
        <p className="text-foreground/80">
          {block.before}
          <a
            href="https://www.cloudflare.com/"
            className={linkClass}
            target="_blank"
            rel="noopener noreferrer"
          >
            Cloudflare
          </a>
          {block.after}
        </p>
      );
    case "contact":
      return (
        <p className="text-foreground/80">
          {block.before}
          <a href={`mailto:${block.email}`} className={linkClass}>
            {block.email}
          </a>
          {block.after}
        </p>
      );
    default:
      return null;
  }
}

export function PrivacyContent() {
  return (
    <LandingLocaleProvider>
      <PrivacyContentInner />
    </LandingLocaleProvider>
  );
}

function PrivacyContentInner() {
  const { locale } = useLandingLocale();
  const labels = getPrivacyLabels(locale);

  return (
    <PublicLayout
      rightSlot={
        <>
          <LocaleToggle />
          <ThemeToggle />
        </>
      }
      footer="simple"
    >
      <div className="mx-auto max-w-3xl px-6 pt-12 sm:pt-24 pb-28">
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-4">
          {labels.title}
        </h1>
        <p className="text-sm text-muted-foreground mb-12">
          {labels.lastUpdated}
        </p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-[1.0625rem] leading-relaxed">
          {labels.sections.map((section, i) => (
            <section key={i}>
              <h2 className="text-xl font-semibold mt-10 mb-4">{section.heading}</h2>
              {section.blocks.map((block, j) => (
                <PrivacyBlock key={j} block={block} />
              ))}
            </section>
          ))}
        </div>
      </div>
    </PublicLayout>
  );
}
