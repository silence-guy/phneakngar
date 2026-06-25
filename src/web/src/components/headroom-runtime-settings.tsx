"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { agentFormLabel } from "@/lib/locale";

export interface HeadroomSettingsValue {
  enabled: boolean;
  requireOptimization: boolean;
  outputShaper: boolean;
}

const DEFAULT_HEADROOM_SETTINGS: HeadroomSettingsValue = {
  enabled: false,
  requireOptimization: false,
  outputShaper: false,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function readHeadroomSettings(runtimeConfig: unknown): HeadroomSettingsValue {
  const config = asRecord(runtimeConfig);
  const headroom = asRecord(config?.headroom);
  return {
    enabled: headroom?.enabled === true,
    requireOptimization: headroom?.requireOptimization === true,
    outputShaper: headroom?.outputShaper === true,
  };
}

export function buildRuntimeConfigWithHeadroom(
  baseRuntimeConfig: unknown,
  model: string,
  headroom: HeadroomSettingsValue,
): Record<string, unknown> {
  const base = asRecord(baseRuntimeConfig) ?? {};
  const next: Record<string, unknown> = { ...base };
  const trimmedModel = model.trim();

  if (trimmedModel) {
    next.model = trimmedModel;
  } else {
    delete next.model;
  }

  if (headroom.enabled) {
    const existing = asRecord(base.headroom) ?? {};
    next.headroom = {
      ...existing,
      enabled: true,
      mode: "proxy",
      requireOptimization: headroom.requireOptimization,
      outputShaper: headroom.outputShaper,
    };
  } else {
    delete next.headroom;
  }

  return next;
}

export function HeadroomRuntimeSettings({
  value,
  onChange,
}: {
  value: HeadroomSettingsValue;
  onChange: (value: HeadroomSettingsValue) => void;
}) {
  const update = (patch: Partial<HeadroomSettingsValue>) => {
    onChange({ ...value, ...patch });
  };

  return (
    <div className="space-y-3 rounded-lg border border-border/50 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <Label className="text-xs text-muted-foreground">
            {agentFormLabel("contextOptimization")}
          </Label>
          <p className="text-xs text-muted-foreground/70">
            {agentFormLabel("contextOptimizationHint")}
          </p>
        </div>
        <Switch
          checked={value.enabled}
          onCheckedChange={(checked) =>
            update({
              enabled: checked,
              requireOptimization: checked ? value.requireOptimization : false,
              outputShaper: checked ? value.outputShaper : false,
            })
          }
          aria-label={agentFormLabel("contextOptimization")}
        />
      </div>

      {value.enabled && (
        <div className="space-y-3 border-t border-border/50 pt-3">
          <ToggleRow
            label={agentFormLabel("requireContextOptimization")}
            description={agentFormLabel("requireContextOptimizationHint")}
            checked={value.requireOptimization}
            onCheckedChange={(checked) => update({ requireOptimization: checked })}
          />
          <ToggleRow
            label={agentFormLabel("shapeOutput")}
            description={agentFormLabel("shapeOutputHint")}
            checked={value.outputShaper}
            onCheckedChange={(checked) => update({ outputShaper: checked })}
          />
        </div>
      )}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-0.5">
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground/70">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} size="sm" aria-label={label} />
    </div>
  );
}
