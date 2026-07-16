"use client";

import { useEffect } from "react";
import { isTauri, isDesktop, tauriInvoke } from "@phneakngar/shared";
import { useWorkspace } from "@/contexts/workspace-context";
import { listApprovals } from "@/lib/api";
import { syncPendingApprovalsToDesktop } from "@/components/tauri-approval-notify-lib";

/** Poll interval for desktop pending-approval notifications. */
const POLL_MS = 45_000;

/**
 * Desktop shell bridge: poll workspace pending approvals and report them to
 * Tauri so OS notifications fire for newly pending rows (F4).
 *
 * Renders nothing. No-ops outside the Tauri desktop shell.
 */
export function TauriApprovalNotify() {
  const { workspaceId, slug } = useWorkspace();

  useEffect(() => {
    if (!isTauri() || !isDesktop()) return;
    if (!workspaceId) return;

    let cancelled = false;

    const tick = async () => {
      try {
        await syncPendingApprovalsToDesktop({
          workspaceId,
          workspaceSlug: slug,
          listApprovals: (id, opts) => listApprovals(id, opts),
          invoke: async (command, args) => {
            if (cancelled) return;
            return tauriInvoke(command, args);
          },
        });
      } catch {
        // Auth / offline / non-desktop — silent.
      }
    };

    void tick();
    const interval = setInterval(() => {
      if (cancelled) return;
      void tick();
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [workspaceId, slug]);

  return null;
}
