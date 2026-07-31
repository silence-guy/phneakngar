"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Locale, defaultLocale, isSupportedLocale } from "@phneakngar/shared";
import { listWorkspaces } from "@/lib/api";
import { useWorkspace } from "@/contexts/workspace-context";

const STORAGE_KEY = "phneakngar-shell-locale";

function getStoredLocale(): Locale | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isSupportedLocale(stored) ? stored : null;
}

function persistLocale(locale: Locale) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Ignore storage failures (private mode, quota, etc.)
  }
}

interface ShellLocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  isLoading: boolean;
}

const ShellLocaleContext = createContext<ShellLocaleContextValue | null>(null);

interface ShellLocaleProviderProps {
  children: ReactNode;
}

export function ShellLocaleProvider({ children }: ShellLocaleProviderProps) {
  const { workspaceId } = useWorkspace();
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const [isLoading, setIsLoading] = useState(true);

  // Load the user's persisted choice on mount.
  useEffect(() => {
    const stored = getStoredLocale();
    if (stored) setLocaleState(stored);
  }, []);

  // Fetch the workspace default locale and apply it unless the user
  // already made an explicit (persisted) choice.
  useEffect(() => {
    if (!workspaceId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    listWorkspaces()
      .then((workspaces) => {
        const ws = workspaces.find((w) => w.id === workspaceId);
        if (ws?.default_locale && !getStoredLocale()) {
          setLocaleState(ws.default_locale as Locale);
        }
      })
      .catch(() => {
        // Keep the current/default locale on failure.
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [workspaceId]);

  // Keep the document language attribute in sync with the selected locale.
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    persistLocale(next);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocaleState((prev) => {
      const next = prev === Locale.KM ? Locale.EN : Locale.KM;
      persistLocale(next);
      return next;
    });
  }, []);

  return (
    <ShellLocaleContext.Provider
      value={{ locale, setLocale, toggleLocale, isLoading }}
    >
      {children}
    </ShellLocaleContext.Provider>
  );
}

export function useShellLocale(): ShellLocaleContextValue {
  const context = useContext(ShellLocaleContext);
  if (!context) {
    // Fallback for components rendered outside the provider (SSR, tests, previews).
    return {
      locale: defaultLocale,
      setLocale: () => {},
      toggleLocale: () => {},
      isLoading: false,
    };
  }
  return context;
}
