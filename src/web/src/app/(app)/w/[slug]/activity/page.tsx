"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useWorkspace } from "@/contexts/workspace-context";
import { listActivityEvents, type ActivityEventItem } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Circle,
  Radar,
  Repeat,
  Send,
  ShieldCheck,
} from "lucide-react";
import { relativeTime } from "@/lib/time";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  ACTIVITY_LABELS,
  activityIconKey,
  activityKindLabel,
  type ActivityIconKey,
} from "./activity-labels";
import { resolveActivityListView } from "./activity-list-view";

function SkeletonRow() {
  return (
    <div className="px-4 py-3 border-b border-border/30">
      <div className="flex items-start gap-3">
        <Skeleton className="size-8 rounded-md shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-2/3 rounded" />
          <Skeleton className="h-3 w-1/2 rounded" />
          <Skeleton className="h-2.5 w-24 rounded" />
        </div>
      </div>
    </div>
  );
}

function KindIcon({ iconKey }: { iconKey: ActivityIconKey }) {
  const cls = "size-4 text-muted-foreground";
  switch (iconKey) {
    case "shield":
      return <ShieldCheck className={cls} />;
    case "send":
      return <Send className={cls} />;
    case "radar":
      return <Radar className={cls} />;
    case "repeat":
      return <Repeat className={cls} />;
    default:
      return <Circle className={cls} />;
  }
}

function ActivityRow({ item }: { item: ActivityEventItem }) {
  const iconKey = activityIconKey(item.kind);
  return (
    <div className="px-4 py-3 border-b border-border/30" data-testid="activity-row">
      <div className="flex items-start gap-3">
        <div className="size-8 rounded-md bg-secondary flex items-center justify-center shrink-0">
          <KindIcon iconKey={iconKey} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium text-foreground truncate">
              {item.summary || activityKindLabel(item.kind)}
            </span>
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground shrink-0">
              {activityKindLabel(item.kind)}
            </span>
            <Tooltip>
              <TooltipTrigger
                render={<span className="text-xs text-muted-foreground shrink-0 ml-auto" />}
              >
                {relativeTime(item.created_at)}
              </TooltipTrigger>
              <TooltipContent>
                {new Date(item.created_at).toLocaleString()}
              </TooltipContent>
            </Tooltip>
          </div>
          {item.actor_type || item.subject_type ? (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
              {[item.actor_type, item.subject_type].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function ActivityPage() {
  const { workspaceId } = useWorkspace();
  const [items, setItems] = useState<ActivityEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const result = await listActivityEvents(workspaceId, { limit: 50 });
      setItems(result.items);
    } catch {
      setItems([]);
      setLoadError(true);
      toast.error(ACTIVITY_LABELS.failedToLoad);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const view = resolveActivityListView({
    loading,
    loadError,
    itemCount: items.length,
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-border/50 px-3 md:px-5 py-2.5 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-sm font-medium">{ACTIVITY_LABELS.title}</h1>
          <p className="text-xs text-muted-foreground hidden md:block">
            {ACTIVITY_LABELS.subtitle}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto thin-scrollbar">
        {view === "loading" ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : view === "error" ? (
          <div
            className="flex flex-col items-center justify-center py-20 text-center px-4"
            data-testid="activity-load-error"
          >
            <Activity className="size-8 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground max-w-sm mb-4">
              {ACTIVITY_LABELS.empty.loadFailed}
            </p>
            <Button type="button" size="sm" variant="secondary" onClick={() => void load()}>
              {ACTIVITY_LABELS.retry}
            </Button>
          </div>
        ) : view === "empty" ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <Activity className="size-8 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground max-w-sm">
              {ACTIVITY_LABELS.empty.none}
            </p>
          </div>
        ) : (
          items.map((item) => <ActivityRow key={item.id} item={item} />)
        )}
      </div>
    </div>
  );
}
