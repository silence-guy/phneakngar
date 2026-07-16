"use client";

/**
 * Installed skills list for an agent.
 * Install/update flows go through skill_install approvals — this panel is read-only.
 * Marketplace / ClawHub verify is not claimed.
 */

import { useCallback, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { getAgentSkills } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const LABELS = {
  title: "Skills",
  subtitle:
    "Installed skills for this agent. New skills land via skill_install approvals — marketplace verify is not claimed.",
  empty: "No skills installed yet",
  global: "global",
  agent: "agent",
  failedLoad: "Failed to load skills",
} as const;

type SkillRow = {
  name: string;
  description: string;
  isGlobal?: boolean;
};

export function AgentSkillsPanel({
  agentId,
  workspaceId,
  className,
}: {
  agentId: string;
  workspaceId: string;
  className?: string;
}) {
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAgentSkills(agentId, workspaceId);
      setSkills(res.skills ?? []);
    } catch {
      toast.error(LABELS.failedLoad);
    } finally {
      setLoading(false);
    }
  }, [agentId, workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className={cn("space-y-2 max-w-md", className)}>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <div className={cn("mx-auto max-w-md space-y-3", className)}>
      <div>
        <h3 className="text-sm font-medium text-foreground flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-muted-foreground" />
          {LABELS.title}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
          {LABELS.subtitle}
        </p>
      </div>

      {skills.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">{LABELS.empty}</p>
      ) : (
        <ul className="space-y-2">
          {skills.map((skill) => (
            <li
              key={`${skill.isGlobal ? "g" : "a"}:${skill.name}`}
              className="rounded-md border border-border/40 px-3 py-2"
              data-testid="agent-skill-row"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium text-foreground truncate">
                  {skill.name}
                </span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">
                  {skill.isGlobal ? LABELS.global : LABELS.agent}
                </span>
              </div>
              {skill.description ? (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {skill.description}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
