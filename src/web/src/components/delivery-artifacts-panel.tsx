"use client";

/**
 * Thin list/viewer for delivery product artifacts (drafts, digests, reports).
 * Progressive disclosure: list first, expand one at a time.
 */

import { useMemo, useState } from "react";
import { isDeliveryArtifactSource, type Artifact } from "@phneakngar/shared";
import { FileText, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatSize } from "@/components/agent-chat/artifact-sheet";
import { ArtifactContentRenderer } from "@/components/artifact-content-renderer";

export interface DeliveryArtifactsPanelProps {
  artifacts: Artifact[];
  workspaceId: string;
  /** Restrict to a single task when set. */
  taskId?: string | null;
  className?: string;
  emptyLabel?: string;
  title?: string;
}

function isDelivery(a: Artifact): boolean {
  return isDeliveryArtifactSource(a.source);
}

export function filterDeliveryArtifacts(
  artifacts: Artifact[],
  taskId?: string | null,
): Artifact[] {
  return artifacts
    .filter(isDelivery)
    .filter((a) => (taskId ? a.task_id === taskId : true))
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function DeliveryArtifactsPanel({
  artifacts,
  workspaceId,
  taskId = null,
  className,
  emptyLabel = "No delivery artifacts yet",
  title = "Delivery",
}: DeliveryArtifactsPanelProps) {
  const items = useMemo(
    () => filterDeliveryArtifacts(artifacts, taskId),
    [artifacts, taskId],
  );
  const [openId, setOpenId] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <section className={cn("rounded-lg border border-border/50 bg-card/30", className)}>
        <header className="px-3 py-2 text-xs font-medium text-muted-foreground">
          {title}
        </header>
        <p className="px-3 pb-3 text-[11px] text-muted-foreground/70">{emptyLabel}</p>
      </section>
    );
  }

  return (
    <section className={cn("rounded-lg border border-border/50 bg-card/30", className)}>
      <header className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground">
        <span className="flex-1 truncate">{title}</span>
        <span className="tabular-nums text-[10px] text-muted-foreground/70">{items.length}</span>
      </header>
      <ul className="max-h-72 overflow-y-auto thin-scrollbar divide-y divide-border/40">
        {items.map((a) => {
          const open = openId === a.id;
          return (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => setOpenId(open ? null : a.id)}
                aria-expanded={open}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors"
              >
                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {a.filename}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    {formatSize(a.size)}
                    {a.task_id ? " · linked task" : ""}
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    "size-3.5 shrink-0 text-muted-foreground/60 transition-transform duration-200",
                    open && "rotate-180",
                  )}
                  aria-hidden
                />
              </button>
              {open && (
                <div className="border-t border-border/30 bg-background/40 px-3 py-2 max-h-56 overflow-y-auto thin-scrollbar">
                  <ArtifactContentRenderer artifact={a} workspaceId={workspaceId} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
