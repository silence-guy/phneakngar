"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, PawPrint } from "lucide-react";

import {
  readCloudCodeMonsterPetPresetId,
  writeCloudCodeMonsterPetPresetId,
  CLOUD_CODE_MONSTER_PET_PRESETS,
} from "./cloud-code-monster-pet-presets";
import {
  CLOUD_CODE_MONSTER_PRESET_CHANGED_EVENT,
  CLOUD_CODE_MONSTER_PRESET_STORAGE_KEY,
} from "./cloud-code-monster-pet-constants";
import { CloudCodeMonsterPetPreset } from "./cloud-code-monster-pet-types";
import { cn } from "@/lib/utils";
import styles from "./pet-selector.module.css";

// Preset pet IDs for the selector
const SELECTOR_PRESET_IDS = [
  "pet-01", // Claude Pixel
  "pet-02", // Blue Pocket Bot (boba inspired)
  "pet-04", // Pink Star Puff (doraemon inspired)
  "pet-08", // Moon Alley Cat
  "pet-13", // Red Cap Jumper (shinchan inspired)
  "pet-14", // Honey Cub (wangcai inspired)
  "pet-16", // Cozy Hood Cub (nezuko inspired)
  "pet-21", // Shadow Ninja Bean (dasheng inspired)
] as const;

type SelectorPresetId = (typeof SELECTOR_PRESET_IDS)[number];

const SELECTOR_PRESETS = CLOUD_CODE_MONSTER_PET_PRESETS.filter((preset) =>
  SELECTOR_PRESET_IDS.includes(preset.id as SelectorPresetId)
);

interface PetCardProps {
  preset: CloudCodeMonsterPetPreset;
  isSelected: boolean;
  onSelect: (presetId: string) => void;
}

function PetCard({ preset, isSelected, onSelect }: PetCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(preset.id)}
      className={cn(
        styles.petCard,
        isSelected && styles.petCardSelected
      )}
      aria-pressed={isSelected}
    >
      <div className={styles.petPreview}>
        <PetPreview preset={preset} />
      </div>
      <div className={styles.petInfo}>
        <span className={styles.petName}>{preset.name}</span>
        <span className={styles.petGroup}>{preset.group}</span>
      </div>
      <div className={styles.selectButton}>
        {isSelected ? (
          <span className={styles.selectedBadge}>Selected</span>
        ) : (
          <span className={styles.selectText}>Select</span>
        )}
      </div>
    </button>
  );
}

function PetPreview({ preset }: { preset: CloudCodeMonsterPetPreset }) {
  // Render a simple pixel-style preview using CSS
  return (
    <div className={styles.pixelPet}>
      <svg
        viewBox="0 0 16 16"
        className={styles.pixelSvg}
        aria-hidden="true"
      >
        {/* Body */}
        <rect x="4" y="6" width="8" height="7" fill={preset.body} />
        <rect x="5" y="5" width="6" height="1" fill={preset.bodyTop} />
        <rect x="5" y="13" width="6" height="1" fill={preset.bodyDark} />
        {/* Head */}
        <rect x="3" y="3" width="10" height="5" fill={preset.body} />
        <rect x="4" y="2" width="8" height="1" fill={preset.bodyTop} />
        {/* Eyes */}
        <rect x="5" y="4" width="2" height="2" fill={preset.eye} />
        <rect x="9" y="4" width="2" height="2" fill={preset.eye} />
        {/* Highlight */}
        <rect x="4" y="3" width="1" height="1" fill={preset.highlight} />
        <rect x="11" y="3" width="1" height="1" fill={preset.highlight} />
        {/* Accessory/Feature */}
        {preset.cheek && (
          <>
            <rect x="4" y="6" width="1" height="1" fill={preset.cheek} />
            <rect x="11" y="6" width="1" height="1" fill={preset.cheek} />
          </>
        )}
        {/* Feet */}
        <rect x="5" y="13" width="2" height="2" fill={preset.bodySideDark} />
        <rect x="9" y="13" width="2" height="2" fill={preset.bodySideDark} />
      </svg>
    </div>
  );
}

export function PetSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Initialize selected preset from localStorage
  useEffect(() => {
    const storedId = localStorage.getItem(CLOUD_CODE_MONSTER_PRESET_STORAGE_KEY);
    setSelectedPresetId(storedId || CLOUD_CODE_MONSTER_PET_PRESETS[0]!.id);
  }, []);

  // Listen for preset changes from other sources
  useEffect(() => {
    const handlePresetChange = (event: Event) => {
      const nextPresetId = (event as CustomEvent<{ presetId?: string }>).detail
        ?.presetId;
      if (nextPresetId) {
        setSelectedPresetId(nextPresetId);
      }
    };

    window.addEventListener(
      CLOUD_CODE_MONSTER_PRESET_CHANGED_EVENT,
      handlePresetChange
    );

    return () => {
      window.removeEventListener(
        CLOUD_CODE_MONSTER_PRESET_CHANGED_EVENT,
        handlePresetChange
      );
    };
  }, []);

  // Close panel when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    // Delay to avoid closing immediately on open
    const timer = setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  const handleSelect = useCallback((presetId: string) => {
    writeCloudCodeMonsterPetPresetId(presetId);
    setSelectedPresetId(presetId);
    // Dispatch the event for other components
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(CLOUD_CODE_MONSTER_PRESET_CHANGED_EVENT, {
          detail: { presetId },
        })
      );
    }
    setIsOpen(false);
  }, []);

  const selectedPreset = SELECTOR_PRESETS.find(
    (p) => p.id === selectedPresetId
  ) ?? SELECTOR_PRESETS[0]!;

  return (
    <div className={styles.container}>
      {/* Floating Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={styles.floatingButton}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <PawPrint className={styles.buttonIcon} />
        <span className={styles.buttonLabel}>
          {selectedPreset?.name ?? "Select Pet"}
        </span>
        {isOpen ? (
          <ChevronUp className={styles.chevronIcon} />
        ) : (
          <ChevronDown className={styles.chevronIcon} />
        )}
      </button>

      {/* Selector Panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className={styles.panel}
          role="dialog"
          aria-label="Pet selector"
        >
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>Choose Your Companion</h3>
            <p className={styles.panelSubtitle}>
              Select a pet to accompany you
            </p>
          </div>

          <div className={styles.petGrid}>
            {SELECTOR_PRESETS.map((preset) => (
              <PetCard
                key={preset.id}
                preset={preset}
                isSelected={preset.id === selectedPresetId}
                onSelect={handleSelect}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
