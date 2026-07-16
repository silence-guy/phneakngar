import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  TIMELINE_CONTENT_CLASS,
  TIMELINE_EVENT_CLASS,
  TIMELINE_GUTTER_CLASS,
  TIMELINE_NAME_CLASS,
  timelineChromeAttrs,
  toTimelineActor,
  type TimelineActor,
} from "./timeline-chrome";

export type ClusterPosition = "first" | "middle" | "last" | "solo";

export interface MessageClusterProps {
  avatar: ReactNode;
  name: string;
  children: ReactNode;
  position: ClusterPosition;
  /**
   * Who authored this cluster. Drives `data-timeline-actor` only — visual chrome
   * classes are shared across human / ai / system (B4 parity).
   */
  actor?: TimelineActor | "user" | "agent";
  className?: string;
}

const AVATAR_SIZE = 30;

export function MessageCluster({
  avatar,
  name,
  children,
  position,
  actor: actorProp = "ai",
  className,
}: MessageClusterProps) {
  const isClusterHead = position === "first" || position === "solo";
  const actor = toTimelineActor(actorProp);

  return (
    <div
      className={cn(TIMELINE_EVENT_CLASS, className)}
      {...timelineChromeAttrs(actor)}
    >
      <div className={cn(TIMELINE_GUTTER_CLASS, "shrink-0")} aria-hidden={!isClusterHead}>
        {isClusterHead && avatar}
      </div>
      <div className={TIMELINE_CONTENT_CLASS}>
        {isClusterHead && (
          <span className={TIMELINE_NAME_CLASS}>{name}</span>
        )}
        {children}
      </div>
    </div>
  );
}

export { AVATAR_SIZE };
