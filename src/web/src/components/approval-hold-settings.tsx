"use client";

import {
  applyApprovalHoldPolicyToRuntimeConfig,
  readApprovalHoldPolicy,
  type ApprovalHoldSettings,
} from "@phneakngar/shared";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { agentFormLabel } from "@/lib/locale";

export type { ApprovalHoldSettings };

export function readApprovalHoldSettings(runtimeConfig: unknown): ApprovalHoldSettings {
  return readApprovalHoldPolicy(runtimeConfig);
}

/**
 * Apply hold settings onto a runtime_config produced by other builders.
 * Pure merge — no I/O.
 */
export function buildRuntimeConfigWithApprovalHold(
  baseRuntimeConfig: unknown,
  settings: ApprovalHoldSettings,
): Record<string, unknown> {
  return applyApprovalHoldPolicyToRuntimeConfig(baseRuntimeConfig, settings);
}

export function ApprovalHoldSettingsPanel({
  value,
  onChange,
}: {
  value: ApprovalHoldSettings;
  onChange: (value: ApprovalHoldSettings) => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-border/50 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <Label className="text-xs text-muted-foreground">
            {agentFormLabel("approvalHold")}
          </Label>
          <p className="text-xs text-muted-foreground/70">
            {agentFormLabel("approvalHoldHint")}
          </p>
        </div>
        <Switch
          checked={value.enabled}
          onCheckedChange={(checked) => onChange({ ...value, enabled: checked })}
          aria-label={agentFormLabel("approvalHold")}
        />
      </div>
    </div>
  );
}
