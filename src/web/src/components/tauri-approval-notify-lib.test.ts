import { describe, it, expect, vi } from "vitest";
import {
  toPendingApprovalReports,
  syncPendingApprovalsToDesktop,
} from "./tauri-approval-notify-lib";

describe("toPendingApprovalReports", () => {
  it("maps pending approval rows for Tauri report_pending_approvals", () => {
    const reports = toPendingApprovalReports([
      {
        id: "ap_1",
        title: "  Send reply  ",
        summary: " to alice@example.com ",
        kind: "email_send",
      },
      {
        id: "ap_2",
        title: null,
        summary: null,
        kind: "skill_install",
      },
    ]);

    expect(reports).toEqual([
      {
        id: "ap_1",
        title: "Send reply",
        summary: "to alice@example.com",
        kind: "email_send",
      },
      {
        id: "ap_2",
        kind: "skill_install",
      },
    ]);
  });

  it("drops rows without ids", () => {
    expect(
      toPendingApprovalReports([
        { id: "", title: "x" },
        { id: "ok", title: "y" },
      ])
    ).toEqual([{ id: "ok", title: "y" }]);
  });

  it("returns empty for empty input", () => {
    expect(toPendingApprovalReports([])).toEqual([]);
  });

  it("omits whitespace-only optional fields", () => {
    expect(
      toPendingApprovalReports([
        { id: "ap_ws", title: "   ", summary: "\t", kind: "  " },
      ])
    ).toEqual([{ id: "ap_ws" }]);
  });

  it("accepts undefined optional fields", () => {
    expect(toPendingApprovalReports([{ id: "only" }])).toEqual([{ id: "only" }]);
  });
});

describe("syncPendingApprovalsToDesktop", () => {
  it("lists pending approvals scoped by workspaceId then invokes report_pending_approvals", async () => {
    const listApprovals = vi.fn().mockResolvedValue({
      items: [
        {
          id: "ap_new",
          title: " Install skill ",
          summary: " package-x ",
          kind: "skill_install",
        },
      ],
    });
    const invoke = vi.fn().mockResolvedValue({ notified: 1, pending: 1, seeded: false });

    const items = await syncPendingApprovalsToDesktop({
      workspaceId: "ws_1",
      workspaceSlug: "acme",
      listApprovals,
      invoke,
    });

    expect(listApprovals).toHaveBeenCalledTimes(1);
    expect(listApprovals).toHaveBeenCalledWith("ws_1", {
      status: "pending",
      limit: 50,
    });
    // Workspace scope first — never list-then-check ownership.
    expect(listApprovals.mock.calls[0][0]).toBe("ws_1");

    expect(invoke).toHaveBeenCalledWith("report_pending_approvals", {
      items: [
        {
          id: "ap_new",
          title: "Install skill",
          summary: "package-x",
          kind: "skill_install",
        },
      ],
      workspace_slug: "acme",
    });
    expect(items).toEqual([
      {
        id: "ap_new",
        title: "Install skill",
        summary: "package-x",
        kind: "skill_install",
      },
    ]);
  });

  it("invokes with empty items when API returns none (seed path)", async () => {
    const listApprovals = vi.fn().mockResolvedValue({ items: [] });
    const invoke = vi.fn().mockResolvedValue({ notified: 0, pending: 0, seeded: true });

    const items = await syncPendingApprovalsToDesktop({
      workspaceId: "ws_seed",
      listApprovals,
      invoke,
    });

    expect(invoke).toHaveBeenCalledWith("report_pending_approvals", { items: [] });
    expect(items).toEqual([]);
  });

  it("treats missing items as empty array", async () => {
    const listApprovals = vi.fn().mockResolvedValue({});
    const invoke = vi.fn().mockResolvedValue({ notified: 0, pending: 0, seeded: true });

    await syncPendingApprovalsToDesktop({
      workspaceId: "ws_2",
      listApprovals,
      invoke,
    });

    expect(invoke).toHaveBeenCalledWith("report_pending_approvals", { items: [] });
  });

  it("skips list+invoke when workspaceId is missing", async () => {
    const listApprovals = vi.fn();
    const invoke = vi.fn();

    expect(
      await syncPendingApprovalsToDesktop({
        workspaceId: null,
        listApprovals,
        invoke,
      })
    ).toBeNull();
    expect(
      await syncPendingApprovalsToDesktop({
        workspaceId: "   ",
        listApprovals,
        invoke,
      })
    ).toBeNull();
    expect(listApprovals).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("propagates listApprovals errors for the caller to swallow", async () => {
    const listApprovals = vi.fn().mockRejectedValue(new Error("offline"));
    const invoke = vi.fn();

    await expect(
      syncPendingApprovalsToDesktop({
        workspaceId: "ws_err",
        listApprovals,
        invoke,
      })
    ).rejects.toThrow("offline");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("honors custom limit while keeping status pending", async () => {
    const listApprovals = vi.fn().mockResolvedValue({ items: null });
    const invoke = vi.fn().mockResolvedValue({});

    await syncPendingApprovalsToDesktop({
      workspaceId: "ws_lim",
      listApprovals,
      invoke,
      limit: 10,
    });

    expect(listApprovals).toHaveBeenCalledWith("ws_lim", {
      status: "pending",
      limit: 10,
    });
  });

  it("omits workspace_slug when slug is blank", async () => {
    const listApprovals = vi.fn().mockResolvedValue({ items: [] });
    const invoke = vi.fn().mockResolvedValue({});

    await syncPendingApprovalsToDesktop({
      workspaceId: "ws_3",
      workspaceSlug: "  ",
      listApprovals,
      invoke,
    });

    expect(invoke).toHaveBeenCalledWith("report_pending_approvals", { items: [] });
  });
});
