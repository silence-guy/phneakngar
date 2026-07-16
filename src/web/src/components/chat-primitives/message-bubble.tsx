import type { ReactNode, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import {
  TIMELINE_BODY_CLASS,
  TIMELINE_BODY_QUIET_CLASS,
  toTimelineActor,
  type TimelineActor,
} from "./timeline-chrome";

/**
 * Body surface for a timeline event.
 *
 * B4: no ChatGPT-style colored bubbles. Human and AI share the same flat body
 * chrome; system uses the quiet tone of the same family. `variant` remains for
 * API compatibility (`user`/`agent` aliases) but no longer paints second-class
 * bot fills or right-side pill radii.
 */
type BubbleVariant = TimelineActor | "user" | "agent";
export type BubblePosition = "first" | "middle" | "last" | "single";

interface MessageBubbleProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  variant: BubbleVariant;
  /** Kept for API compatibility with clustering callers; no longer drives asymmetric radii. */
  position?: BubblePosition;
  children: ReactNode;
  className?: string;
}

export function MessageBubble({
  variant,
  position: _position = "single",
  children,
  className,
  ...rest
}: MessageBubbleProps) {
  void _position;
  const actor = toTimelineActor(variant);
  const isSystem = actor === "system";

  return (
    <div
      className={cn(
        isSystem ? TIMELINE_BODY_QUIET_CLASS : TIMELINE_BODY_CLASS,
        // Slight vertical padding so dense clusters don't collide; no fill/radius bubble.
        !isSystem && "py-0.5",
        className,
      )}
      data-timeline-body={actor}
      {...rest}
    >
      {children}
    </div>
  );
}
