import { describe, it, expect, vi } from "vitest";
import * as approvalQueries from "../../src/db/queries/approval";

function createMock(rows: any[]) {
  const chain: any = {};
  chain.insert = vi.fn(() => chain);
  chain.values = vi.fn(() => chain);
  chain.returning = vi.fn(() => Promise.resolve(rows));
  chain.select = vi.fn(() => chain);
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(() => Promise.resolve(rows));
  chain.update = vi.fn(() => chain);
  chain.set = vi.fn(() => chain);
  return chain;
}

describe("approval queries", () => {
  it("createApproval defaults status pending", async () => {
    const row = { id: "ap_1", status: "pending" };
    const mockDb = createMock([row]);
    const result = await approvalQueries.createApproval(mockDb, {
      workspaceId: "w1",
      kind: "outbound_email",
      title: "Send reply",
    });
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "w1",
        kind: "outbound_email",
        status: "pending",
      })
    );
    expect(result).toEqual(row);
  });

  it("decideApproval only updates pending rows", async () => {
    const mockDb = createMock([]);
    const result = await approvalQueries.decideApproval(
      mockDb,
      "ap_1",
      "w1",
      "approved",
      "u1"
    );
    expect(result).toBeNull();
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "approved", decidedByUserId: "u1" })
    );
  });

  it("listApprovals supports status filter", async () => {
    const mockDb = createMock([]);
    await approvalQueries.listApprovals(mockDb, "w1", { status: "pending", limit: 5 });
    expect(mockDb.where).toHaveBeenCalled();
    expect(mockDb.limit).toHaveBeenCalledWith(5);
  });

  it("listApprovals supports kind filter", async () => {
    const mockDb = createMock([]);
    await approvalQueries.listApprovals(mockDb, "w1", {
      status: "pending",
      kind: "skill_install",
      limit: 10,
    });
    expect(mockDb.where).toHaveBeenCalled();
    expect(mockDb.limit).toHaveBeenCalledWith(10);
  });

  it("findPendingSkillInstall matches source_trace_id in payload", async () => {
    const match = {
      id: "ap_skill",
      status: "pending",
      kind: "skill_install",
      payload: { source_trace_id: "trace_1", name: "deploy-helper" },
    };
    const other = {
      id: "ap_other",
      status: "pending",
      kind: "skill_install",
      payload: { source_trace_id: "trace_2" },
    };
    const mockDb = createMock([other, match]);
    const result = await approvalQueries.findPendingSkillInstall(
      mockDb,
      "w1",
      "trace_1",
    );
    expect(result).toEqual(match);
  });

  it("findPendingSkillInstall returns null when no match", async () => {
    const mockDb = createMock([
      {
        id: "ap_1",
        status: "pending",
        kind: "skill_install",
        payload: { source_trace_id: "other" },
      },
    ]);
    const result = await approvalQueries.findPendingSkillInstall(
      mockDb,
      "w1",
      "trace_missing",
    );
    expect(result).toBeNull();
  });

  it("findPendingSkillInstall returns null for empty sourceTraceId", async () => {
    const mockDb = createMock([{ id: "ap_1" }]);
    const result = await approvalQueries.findPendingSkillInstall(mockDb, "w1", "");
    expect(result).toBeNull();
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("findPendingSkillInstall ignores non-object payloads", async () => {
    const mockDb = createMock([
      {
        id: "ap_bad",
        status: "pending",
        kind: "skill_install",
        payload: "not-an-object",
      },
      {
        id: "ap_arr",
        status: "pending",
        kind: "skill_install",
        payload: ["trace_1"],
      },
      {
        id: "ap_ok",
        status: "pending",
        kind: "skill_install",
        payload: { source_trace_id: "trace_1" },
      },
    ]);
    const result = await approvalQueries.findPendingSkillInstall(
      mockDb,
      "w1",
      "trace_1",
    );
    expect(result?.id).toBe("ap_ok");
  });

  it("getApproval scopes by id and workspaceId", async () => {
    const row = { id: "ap_1", workspaceId: "w1" };
    const mockDb = createMock([row]);
    // getApproval uses select().from().where() and awaits where directly
    mockDb.where = vi.fn(() => Promise.resolve([row]));
    const result = await approvalQueries.getApproval(mockDb, "ap_1", "w1");
    expect(result).toEqual(row);
    expect(mockDb.select).toHaveBeenCalled();
    expect(mockDb.where).toHaveBeenCalled();
  });
});
