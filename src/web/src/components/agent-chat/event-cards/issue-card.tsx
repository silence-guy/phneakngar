import React from "react";
import {
  issueAssignedMeta,
  issueEventLabel,
  issueStampLabel,
  issueStatusTransitionMeta,
} from "@/components/issues/issue-labels";

export function IssueCard({
  title,
  event,
  fromStatus,
  toStatus,
  assigneeName,
  onClick,
}: {
  title: string;
  event: "created" | "status_changed" | "dispatch_failed";
  fromStatus?: string;
  toStatus?: string;
  assigneeName?: string;
  onClick?: () => void;
}) {
  const stamp = issueStampLabel(event, toStatus);
  const meta =
    event === "created" && assigneeName
      ? issueAssignedMeta(assigneeName)
      : event === "status_changed" && fromStatus && toStatus
        ? issueStatusTransitionMeta(fromStatus, toStatus)
        : null;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="card-grain w-104 max-w-full overflow-hidden rounded-(--radius) border border-(--border) bg-(--paper) text-left flex cursor-pointer [transition:translate_.2s_cubic-bezier(.2,.8,.2,1),box-shadow_.2s_ease] hover:-translate-y-0.5 [box-shadow:var(--e1)] hover:[box-shadow:var(--e2)]"
    >
      <span className="w-1 bg-(--ti) shrink-0 self-stretch" />
      <span className="flex-1 p-3 min-w-0 flex flex-col gap-1 relative">
        <span className="text-[0.62rem] font-semibold uppercase tracking-wider text-(--ti) leading-none">
          {issueEventLabel(event)}
        </span>
        <span className="text-[0.92rem] font-semibold tracking-[-0.01em] leading-[1.3] line-clamp-2 pr-8">
          {title}
        </span>
        {meta && (
          <span className="text-[0.75rem] text-(--muted-foreground) leading-[1.2]">
            {meta}
          </span>
        )}
        {stamp && (
          <span className="absolute top-3 right-3 text-[0.5rem] font-bold uppercase tracking-wider text-(--ti) border-[1.5px] border-(--ti) opacity-45 rotate-[4deg] rounded-[3px] px-1 py-0.5">
            {stamp}
          </span>
        )}
      </span>
    </button>
  );
}
