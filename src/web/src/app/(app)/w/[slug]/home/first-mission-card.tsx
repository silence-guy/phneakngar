"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import {
  FIRST_MISSION_STEPS,
  firstMissionStorageKey,
  resolveFirstMissionHref,
  shouldShowFirstMission,
} from "./first-mission";
import { HOME_LABELS } from "./home-labels";

export function FirstMissionCard({
  workspaceId,
  slug,
  agentCount,
  onlineRuntimeCount,
  firstAgentId,
}: {
  workspaceId: string;
  slug: string;
  agentCount: number;
  onlineRuntimeCount: number;
  firstAgentId: string | null;
}) {
  const storageKey = firstMissionStorageKey(workspaceId);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  const visible = shouldShowFirstMission({
    agentCount,
    onlineRuntimeCount,
    dismissed,
  });

  const steps = useMemo(
    () =>
      FIRST_MISSION_STEPS.map((step) => ({
        step,
        href: resolveFirstMissionHref(step, slug, firstAgentId),
        label: HOME_LABELS.firstMission.steps[step.id],
      })),
    [slug, firstAgentId],
  );

  if (!visible) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      /* ignore quota */
    }
    setDismissed(true);
  };

  return (
    <div
      className="absolute top-14 right-3 z-50 w-[min(100%-1.5rem,18rem)] rounded-lg border border-border/50 bg-background/50 shadow-sm px-3 py-2.5 space-y-2"
      data-testid="first-mission-card"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground">
            {HOME_LABELS.firstMission.title}
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {HOME_LABELS.firstMission.subtitle}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={dismiss}
          aria-label={HOME_LABELS.firstMission.dismiss}
        >
          <X className="size-3.5" />
        </Button>
      </div>
      <ol className="list-decimal list-outside ml-4 space-y-1 text-[11px] text-muted-foreground">
        {steps.map(({ step, href, label }) => (
          <li key={step.id}>
            {href ? (
              <Link
                href={href}
                className="text-foreground/90 hover:text-foreground underline-offset-2 hover:underline"
              >
                {label}
              </Link>
            ) : (
              <span>{label}</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
