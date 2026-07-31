"use client";

import { Locale } from "@phneakngar/shared";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useShellLocale } from "@/contexts/shell-locale-context";
import { shellLabel } from "./shell-labels";
import { cn } from "@/lib/utils";

/**
 * Compact EN/KH segmented language toggle for the authenticated app shell.
 * Mirrors the marketing nav toggle UI, adapted to shell theme tokens.
 * `compact` fits the 56px sidebar rail; the default fits the mobile top bar.
 */
export function ShellLocaleToggle({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useShellLocale();
  const tooltip = shellLabel("actions", "switchLanguage", locale);
  const segmentClass = (active: boolean) =>
    cn(
      "flex items-center justify-center font-semibold uppercase tracking-wider transition-colors cursor-pointer",
      compact ? "h-6 w-[22px] text-[9px]" : "h-7 px-2.5 text-[10px]",
      active
        ? "bg-foreground text-background"
        : "text-muted-foreground hover:text-foreground hover:bg-accent",
    );

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            role="group"
            aria-label={tooltip}
            className={cn(
              "flex items-center rounded-lg overflow-hidden border border-border/60",
              compact ? "h-6" : "h-7",
            )}
          />
        }
      >
        <button
          type="button"
          onClick={() => setLocale(Locale.EN)}
          aria-label="English"
          aria-pressed={locale === Locale.EN}
          className={segmentClass(locale === Locale.EN)}
        >
          EN
        </button>
        <button
          type="button"
          onClick={() => setLocale(Locale.KM)}
          aria-label="Khmer"
          aria-pressed={locale === Locale.KM}
          className={segmentClass(locale === Locale.KM)}
        >
          KH
        </button>
      </TooltipTrigger>
      <TooltipContent side={compact ? "right" : "top"}>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
