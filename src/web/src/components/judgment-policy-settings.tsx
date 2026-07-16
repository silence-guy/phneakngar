"use client";

import {
  applyJudgmentPolicyToRuntimeConfig,
  readJudgmentPolicy,
  type JudgmentPolicySettings,
} from "@phneakngar/shared";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { agentFormLabel } from "@/lib/locale";

export type { JudgmentPolicySettings };

export function readJudgmentSettings(runtimeConfig: unknown): JudgmentPolicySettings {
  return readJudgmentPolicy(runtimeConfig);
}

/**
 * Apply judgment settings onto a runtime_config produced by other builders
 * (e.g. headroom + model). Pure merge — no I/O.
 */
export function buildRuntimeConfigWithJudgment(
  baseRuntimeConfig: unknown,
  settings: JudgmentPolicySettings,
): Record<string, unknown> {
  return applyJudgmentPolicyToRuntimeConfig(baseRuntimeConfig, settings);
}

export function JudgmentPolicySettingsPanel({
  value,
  onChange,
}: {
  value: JudgmentPolicySettings;
  onChange: (value: JudgmentPolicySettings) => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-border/50 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <Label className="text-xs text-muted-foreground">
            {agentFormLabel("ambiguousToIssue")}
          </Label>
          <p className="text-xs text-muted-foreground/70">
            {agentFormLabel("ambiguousToIssueHint")}
          </p>
        </div>
        <Switch
          checked={value.ambiguousToIssue}
          onCheckedChange={(checked) =>
            onChange({ ...value, ambiguousToIssue: checked })
          }
          aria-label={agentFormLabel("ambiguousToIssue")}
        />
      </div>
    </div>
  );
}
