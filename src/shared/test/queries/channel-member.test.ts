import { describe, it, expect, vi } from "vitest";
import * as channelMemberQueries from "../../src/db/queries/channel-member";

function createMock(rows: any[]) {
  const chain: any = {};
  chain.insert = vi.fn(() => chain);
  chain.values = vi.fn(() => chain);
  chain.onConflictDoNothing = vi.fn(() => chain);
  chain.returning = vi.fn(() => Promise.resolve(rows));
  chain.select = vi.fn(() => chain);
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => {
    // select().where() resolves rows; delete().where().returning() needs chain
    return Object.assign(Promise.resolve(rows), chain);
  });
  chain.delete = vi.fn(() => chain);
  return chain;
}

describe("channel-member queries", () => {
  it("addChannelMember inserts membership scoped to workspace", async () => {
    const row = { id: "cm_1", channelId: "ch1", memberType: "agent", memberId: "a1" };
    const mockDb = createMock([row]);
    const result = await channelMemberQueries.addChannelMember(mockDb, {
      workspaceId: "w1",
      channelId: "ch1",
      memberType: "agent",
      memberId: "a1",
    });
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "w1",
        channelId: "ch1",
        memberType: "agent",
        memberId: "a1",
      })
    );
    expect(result).toEqual(row);
  });

  it("listChannelMembers filters by workspace and channel", async () => {
    const mockDb = createMock([]);
    await channelMemberQueries.listChannelMembers(mockDb, "w1", "ch1");
    expect(mockDb.where).toHaveBeenCalled();
  });

  it("removeChannelMember is workspace-scoped", async () => {
    const mockDb = createMock([]);
    const result = await channelMemberQueries.removeChannelMember(
      mockDb,
      "w1",
      "ch1",
      "agent",
      "a1"
    );
    expect(result).toBeNull();
  });

  it("agent membership round-trip: add then list includes agent", async () => {
    const row = {
      id: "cm_agent",
      workspaceId: "w1",
      channelId: "ch_dm_like",
      memberType: "agent",
      memberId: "ag_1",
    };
    const addDb = createMock([row]);
    const added = await channelMemberQueries.addChannelMember(addDb, {
      workspaceId: "w1",
      channelId: "ch_dm_like",
      memberType: "agent",
      memberId: "ag_1",
    });
    expect(added).toEqual(row);

    const listDb = createMock([row]);
    const listed = await channelMemberQueries.listChannelMembers(
      listDb,
      "w1",
      "ch_dm_like"
    );
    expect(listed).toEqual([row]);
    expect(listed[0].memberType).toBe("agent");
    expect(listed[0].memberId).toBe("ag_1");
  });
});
