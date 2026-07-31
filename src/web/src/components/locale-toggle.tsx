"use client";

import { Locale, type Locale as SharedLocale } from "@phneakngar/shared";
import { useLandingLocale } from "@/components/home/use-landing-locale";

const LOCALE_OPTIONS: { value: SharedLocale; label: string }[] = [
  { value: Locale.EN, label: "EN" },
  { value: Locale.KM, label: "KH" },
];

function LocaleToggleButtons({
  locale,
  onSelect,
}: {
  locale: SharedLocale;
  onSelect: (locale: SharedLocale) => void;
}) {
  return (
    <div
      className="flex items-center rounded-md overflow-hidden border"
      style={{ borderColor: "var(--border)" }}
      aria-label="Toggle language"
    >
      {LOCALE_OPTIONS.map((option) => {
        const active = locale === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            className="flex items-center px-2 py-1 text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
            style={{
              fontFamily: "var(--font-mono)",
              backgroundColor: active ? "var(--foreground)" : "transparent",
              color: active ? "var(--background)" : "var(--muted-foreground)",
            }}
            aria-label={`Switch to ${option.value === Locale.EN ? "English" : "Khmer"}`}
            aria-pressed={active}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Client-side EN/KH toggle. Reads/writes the shared `landing-locale`
 * localStorage key so the choice carries across the landing page and every
 * marketing subpage.
 */
export function LocaleToggle() {
  const { locale, setLocale } = useLandingLocale();
  return <LocaleToggleButtons locale={locale} onSelect={setLocale} />;
}
