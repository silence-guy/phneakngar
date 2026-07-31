"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Locale } from "@phneakngar/shared";
import { listWorkspaces } from "@/lib/api";
import { useWorkspace } from "@/contexts/workspace-context";

interface SettingsLocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  isLoading: boolean;
}

const SettingsLocaleContext = createContext<SettingsLocaleContextValue | null>(null);

interface SettingsLocaleProviderProps {
  children: ReactNode;
}

export function SettingsLocaleProvider({ children }: SettingsLocaleProviderProps) {
  const { workspaceId } = useWorkspace();
  const [locale, setLocale] = useState<Locale>(Locale.KM);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch initial locale from workspace
  useEffect(() => {
    if (!workspaceId) return;

    setIsLoading(true);
    listWorkspaces()
      .then((workspaces) => {
        const ws = workspaces.find((w) => w.id === workspaceId);
        if (ws?.default_locale) {
          setLocale(ws.default_locale as Locale);
        }
      })
      .catch(() => {
        // Use default
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [workspaceId]);

  const handleSetLocale = useCallback((newLocale: Locale) => {
    setLocale(newLocale);
  }, []);

  return (
    <SettingsLocaleContext.Provider
      value={{
        locale,
        setLocale: handleSetLocale,
        isLoading,
      }}
    >
      {children}
    </SettingsLocaleContext.Provider>
  );
}

export function useSettingsLocale(): SettingsLocaleContextValue {
  const context = useContext(SettingsLocaleContext);
  if (!context) {
    throw new Error("useSettingsLocale must be used within a SettingsLocaleProvider");
  }
  return context;
}
