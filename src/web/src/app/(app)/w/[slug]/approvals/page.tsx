"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/contexts/workspace-context";
import {
  listApprovals,
  decideApproval,
  type ApprovalItem,
} from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Mail, ShieldCheck, Wrench, Sparkles, Workflow } from "lucide-react";
import { relativeTime } from "@/lib/time";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  APPROVALS_LABELS,
  approvalKindLabel,
  approvalPayloadSummary,
  outboundApprovalMeta,
} from "./approvals-labels";

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
        <div className="flex gap-2 shrink-0">
          <Skeleton className="h-8 w-16 rounded" />
          <Skeleton className="h-8 w-16 rounded" />
        </div>
      </div>
    </div>
  );
}

function ApprovalRow({
  item,
  busy,
  slug,
  onDecide,
}: {
  item: ApprovalItem;
  busy: boolean;
  slug: string | null;
  onDecide: (id: string, decision: "approved" | "rejected") => void;
}) {
  const isOutbound = item.kind === "outbound_email";
  const meta = isOutbound ? outboundApprovalMeta(item.payload) : null;
  const toLine = approvalPayloadSummary(item);
  const agentEmailHref =
    isOutbound && item.agent_id && slug
      ? `/w/${slug}/agents/${item.agent_id}/email`
      : null;

  const KindIcon =
    item.kind === "outbound_email"
      ? Mail
      : item.kind === "tool_action"
        ? Wrench
        : item.kind === "skill_install"
          ? Sparkles
          : item.kind === "automation_promote"
            ? Workflow
            : ShieldCheck;

  return (
    <div className="px-4 py-3 border-b border-border/30" data-testid="approval-row">
      <div className="flex items-start gap-3">
        <div className="size-8 rounded-md bg-secondary flex items-center justify-center shrink-0">
          <KindIcon className="size-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium text-foreground truncate">
              {item.title || approvalKindLabel(item.kind)}
            </span>
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground shrink-0">
              {approvalKindLabel(item.kind)}
            </span>
            <Tooltip>
              <TooltipTrigger
                render={<span className="text-xs text-muted-foreground shrink-0 ml-auto" />}
              >
                {relativeTime(item.created_at)}
              </TooltipTrigger>
              <TooltipContent>{new Date(item.created_at).toLocaleString()}</TooltipContent>
            </Tooltip>
          </div>
          {toLine ? (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{toLine}</p>
          ) : null}
          {agentEmailHref ? (
            <Link
              href={agentEmailHref}
              className="inline-flex text-[11px] text-muted-foreground hover:text-foreground mt-1.5 transition-colors"
            >
              {APPROVALS_LABELS.openAgentEmail}
              {meta?.emailId ? ` · ${meta.emailId.slice(0, 10)}…` : ""}
            </Link>
          ) : null}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => onDecide(item.id, "rejected")}
          >
            {APPROVALS_LABELS.reject}
          </Button>
          <Button
            size="sm"
            disabled={busy}
            onClick={() => onDecide(item.id, "approved")}
          >
            {APPROVALS_LABELS.approve}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ApprovalsPage() {
  const { workspaceId, slug } = useWorkspace();
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listApprovals(workspaceId, { status: "pending" });
      setItems(result.items);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDecide = useCallback(
    async (id: string, decision: "approved" | "rejected") => {
      const previous = items;
      setItems((prev) => prev.filter((i) => i.id !== id));
      setBusyId(id);
      try {
        await decideApproval(workspaceId, id, { decision });
      } catch {
        setItems(previous);
      } finally {
        setBusyId(null);
      }
    },
    [items, workspaceId]
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-border/50 px-3 md:px-5 py-2.5 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-sm font-medium">{APPROVALS_LABELS.title}</h1>
          <p className="text-xs text-muted-foreground hidden md:block">
            {APPROVALS_LABELS.subtitle}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto thin-scrollbar">
        {loading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <ShieldCheck className="size-8 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">{APPROVALS_LABELS.empty.noPending}</p>
          </div>
        ) : (
          items.map((item) => (
            <ApprovalRow
              key={item.id}
              item={item}
              slug={slug}
              busy={busyId === item.id}
              onDecide={handleDecide}
            />
          ))
        )}
      </div>
    </div>
  );
}
