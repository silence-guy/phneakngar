"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const PET_SETTINGS_STORAGE_KEY = "phneakngar-pet-settings";

export type PetSize = "sm" | "md" | "lg";

export type PetSettings = {
  mouseFollow: boolean;
  followSensitivity: number; // 0 to 1
  petSize: PetSize;
  selectedPreset: string;
};

const DEFAULT_PET_SETTINGS: PetSettings = {
  mouseFollow: true,
  followSensitivity: 0.5,
  petSize: "md",
  selectedPreset: "claude-code",
};

function readPetSettings(): PetSettings {
  if (typeof window === "undefined") {
    return DEFAULT_PET_SETTINGS;
  }

  try {
    const stored = window.localStorage.getItem(PET_SETTINGS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<PetSettings>;
      return {
        ...DEFAULT_PET_SETTINGS,
        ...parsed,
        followSensitivity: Math.max(
          0,
          Math.min(1, parsed.followSensitivity ?? DEFAULT_PET_SETTINGS.followSensitivity)
        ),
      };
    }
  } catch {
    // Invalid JSON, use defaults
  }

  return DEFAULT_PET_SETTINGS;
}

function writePetSettings(settings: Partial<PetSettings>): PetSettings {
  const next = {
    ...readPetSettings(),
    ...settings,
  };

  window.localStorage.setItem(PET_SETTINGS_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(
    new CustomEvent<PetSettings>("phneakngar-pet-settings-changed", {
      detail: next,
    })
  );

  return next;
}

type PetSettingsContextValue = {
  settings: PetSettings;
  updateSettings: (updates: Partial<PetSettings>) => void;
};

const PetSettingsContext = createContext<PetSettingsContextValue | null>(null);

export function PetSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PetSettings>(DEFAULT_PET_SETTINGS);

  useEffect(() => {
    setSettings(readPetSettings());

    const handleSettingsChanged = (event: Event) => {
      setSettings(
        (event as CustomEvent<PetSettings>).detail ?? readPetSettings()
      );
    };

    const handleStorageChanged = (event: StorageEvent) => {
      if (event.key === PET_SETTINGS_STORAGE_KEY) {
        setSettings(readPetSettings());
      }
    };

    window.addEventListener("phneakngar-pet-settings-changed", handleSettingsChanged);
    window.addEventListener("storage", handleStorageChanged);

    return () => {
      window.removeEventListener("phneakngar-pet-settings-changed", handleSettingsChanged);
      window.removeEventListener("storage", handleStorageChanged);
    };
  }, []);

  const updateSettings = useCallback((updates: Partial<PetSettings>) => {
    const next = writePetSettings(updates);
    setSettings(next);
  }, []);

  return (
    <PetSettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </PetSettingsContext.Provider>
  );
}

export function usePetSettings(): PetSettingsContextValue {
  const context = useContext(PetSettingsContext);
  if (!context) {
    throw new Error("usePetSettings must be used within a PetSettingsProvider");
  }
  return context;
}
