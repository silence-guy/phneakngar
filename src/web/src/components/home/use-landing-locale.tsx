"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { type Locale, Locale as SharedLocale } from "@phneakngar/shared";

export type LandingLocale = Locale;

const STORAGE_KEY = "landing-locale";
const DEFAULT_LOCALE: Locale = SharedLocale.KM;

function getStoredLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "km") {
    return stored as Locale;
  }
  return DEFAULT_LOCALE;
}

interface LandingLocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  toggleLocale: () => void;
  mounted: boolean;
}

const LandingLocaleContext = createContext<LandingLocaleContextValue | null>(null);

export function LandingLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [mounted, setMounted] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setLocaleState(getStoredLocale());
    setMounted(true);
  }, []);

  // Keep the document language attribute in sync with the selected locale
  useEffect(() => {
    if (!mounted) return;
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale, mounted]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, l);
    }
  }, []);

  const toggleLocale = useCallback(() => {
    const next = locale === SharedLocale.KM ? SharedLocale.EN : SharedLocale.KM;
    setLocale(next);
  }, [locale, setLocale]);

  return (
    <LandingLocaleContext.Provider
      value={{
        locale: mounted ? locale : DEFAULT_LOCALE,
        setLocale,
        toggleLocale,
        mounted,
      }}
    >
      {children}
    </LandingLocaleContext.Provider>
  );
}

export function useLandingLocale(): LandingLocaleContextValue {
  const context = useContext(LandingLocaleContext);
  if (!context) {
    // Fallback for components outside the provider (SSR or direct import)
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      toggleLocale: () => {},
      mounted: false,
    };
  }
  return context;
}
