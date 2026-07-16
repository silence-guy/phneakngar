/**
 * Pure helpers for desktop F4: map API pending approvals → Tauri
 * `report_pending_approvals` payload + injectable poll bridge.
 */

export type PendingApprovalLike = {
  id: string;
  title?: string | null;
  summary?: string | null;
  kind?: string | null;
};

export type PendingApprovalReportItem = {
  id: string;
  title?: string;
  summary?: string;
  kind?: string;
};

export type ListPendingApprovalsFn = (
  workspaceId: string,
  opts: { status: "pending"; limit: number }
) => Promise<{ items?: PendingApprovalLike[] | null }>;

export type TauriInvokeFn = (
  command: string,
  args?: Record<string, unknown>
) => Promise<unknown>;

/** Normalize API rows into the Rust `PendingApprovalReport` shape. */
export function toPendingApprovalReports(
  items: PendingApprovalLike[]
): PendingApprovalReportItem[] {
  return items
    .filter((item) => typeof item.id === "string" && item.id.length > 0)
    .map((item) => {
      const report: PendingApprovalReportItem = { id: item.id };
      if (item.title != null && String(item.title).trim()) {
        report.title = String(item.title).trim();
      }
      if (item.summary != null && String(item.summary).trim()) {
        report.summary = String(item.summary).trim();
      }
      if (item.kind != null && String(item.kind).trim()) {
        report.kind = String(item.kind).trim();
      }
      return report;
    });
}

/**
 * Workspace-scoped poll bridge: fetch pending approvals and report to Tauri.
 * Returns the payload items sent (or null when skipped).
 *
 * Always scopes listing by `workspaceId` first (never query-then-filter).
 * Optionally forwards `workspace_slug` for desktop shell deep links (F5).
 */
export async function syncPendingApprovalsToDesktop(opts: {
  workspaceId: string | null | undefined;
  /** Workspace URL slug for desktop deep links / chrome. */
  workspaceSlug?: string | null;
  listApprovals: ListPendingApprovalsFn;
  invoke: TauriInvokeFn;
  /** Max rows to pull; default 50. */
  limit?: number;
}): Promise<PendingApprovalReportItem[] | null> {
  const workspaceId = opts.workspaceId?.trim();
  if (!workspaceId) return null;

  const limit = opts.limit ?? 50;
  const result = await opts.listApprovals(workspaceId, {
    status: "pending",
    limit,
  });
  const items = toPendingApprovalReports(result.items ?? []);

  const args: Record<string, unknown> = { items };
  const slug = opts.workspaceSlug?.trim();
  if (slug) {
    args.workspace_slug = slug;
  }

  await opts.invoke("report_pending_approvals", args);
  return items;
}
