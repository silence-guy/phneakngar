import { describe, it, expect, vi } from "vitest";
import { drizzle } from "drizzle-orm/d1";
import { conversationMember } from "../../src/db/schema";
import * as conversationMemberQueries from "../../src/db/queries/conversation-member";

const fakeDb = drizzle({} as never);

function createMock(rows: any[]) {
  const chain: any = {};
  chain.insert = vi.fn(() => chain);
  chain.values = vi.fn(() => chain);
  chain.onConflictDoNothing = vi.fn(() => chain);
  chain.returning = vi.fn(() => Promise.resolve(rows));
  chain.select = vi.fn(() => chain);
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => {
    return Object.assign(Promise.resolve(rows), chain);
  });
  chain.delete = vi.fn(() => chain);
  return chain;
}

function createCapturingDb(rows: any[]) {
  const calls: { where?: unknown; onConflict?: unknown; values?: unknown } = {};
  const chain: any = {};
  chain.insert = vi.fn(() => chain);
  chain.values = vi.fn((v: unknown) => {
    calls.values = v;
    return chain;
  });
  chain.onConflictDoNothing = vi.fn((opts?: unknown) => {
    calls.onConflict = opts;
    return chain;
  });
  chain.returning = vi.fn(() => Promise.resolve(rows));
  chain.select = vi.fn(() => chain);
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn((cond: unknown) => {
    calls.where = cond;
    return Object.assign(Promise.resolve(rows), chain);
  });
  chain.delete = vi.fn(() => chain);
  return { chain, calls };
}

function whereSql(where: unknown) {
  return fakeDb
    .select()
    .from(conversationMember)
    .where(where as any)
    .toSQL();
}

describe("conversation-member queries", () => {
  it("addConversationMember inserts membership scoped to workspace", async () => {
    const row = {
      id: "cvm_1",
      conversationId: "c1",
      memberType: "agent",
      memberId: "a1",
    };
    const mockDb = createMock([row]);
    const result = await conversationMemberQueries.addConversationMember(mockDb, {
      workspaceId: "w1",
      conversationId: "c1",
      memberType: "agent",
      memberId: "a1",
    });
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "w1",
        conversationId: "c1",
        memberType: "agent",
        memberId: "a1",
      }),
    );
    expect(mockDb.onConflictDoNothing).toHaveBeenCalledWith(
      expect.objectContaining({ target: expect.any(Array) }),
    );
    expect(result).toEqual(row);
  });

  it("listConversationMembers filters by workspace and conversation", async () => {
    const { chain, calls } = createCapturingDb([]);
    await conversationMemberQueries.listConversationMembers(chain, "w1", "c1");
    expect(calls.where).toBeDefined();
    const sql = whereSql(calls.where);
    expect(sql.sql).toContain("workspace_id");
    expect(sql.sql).toContain("conversation_id");
    expect(sql.params).toEqual(expect.arrayContaining(["w1", "c1"]));
  });

  it("listConversationsForMember filters by workspace and member", async () => {
    const { chain, calls } = createCapturingDb([]);
    await conversationMemberQueries.listConversationsForMember(
      chain,
      "w1",
      "user",
      "u1",
    );
    expect(calls.where).toBeDefined();
    const sql = whereSql(calls.where);
    expect(sql.sql).toContain("workspace_id");
    expect(sql.sql).toContain("member_type");
    expect(sql.sql).toContain("member_id");
    expect(sql.params).toEqual(expect.arrayContaining(["w1", "user", "u1"]));
  });

  it("removeConversationMember is workspace-scoped", async () => {
    const { chain, calls } = createCapturingDb([]);
    const result = await conversationMemberQueries.removeConversationMember(
      chain,
      "w1",
      "c1",
      "agent",
      "a1",
    );
    expect(result).toBeNull();
    expect(calls.where).toBeDefined();
    const sql = whereSql(calls.where);
    expect(sql.sql).toContain("workspace_id");
    expect(sql.params).toEqual(
      expect.arrayContaining(["w1", "c1", "agent", "a1"]),
    );
  });

  it("agent membership round-trip: add then list includes agent", async () => {
    const row = {
      id: "cvm_agent",
      workspaceId: "w1",
      conversationId: "c_dm",
      memberType: "agent",
      memberId: "ag_1",
    };
    const addDb = createMock([row]);
    const added = await conversationMemberQueries.addConversationMember(addDb, {
      workspaceId: "w1",
      conversationId: "c_dm",
      memberType: "agent",
      memberId: "ag_1",
    });
    expect(added).toEqual(row);

    const listDb = createMock([row]);
    const listed = await conversationMemberQueries.listConversationMembers(
      listDb,
      "w1",
      "c_dm",
    );
    expect(listed).toEqual([row]);
    expect(listed[0].memberType).toBe("agent");
    expect(listed[0].memberId).toBe("ag_1");
  });

  it("unique conflict soft: onConflictDoNothing then re-selects existing", async () => {
    const existing = {
      id: "cvm_existing",
      workspaceId: "w1",
      conversationId: "c1",
      memberType: "user",
      memberId: "u1",
    };
    const chain: any = {};
    chain.insert = vi.fn(() => chain);
    chain.values = vi.fn(() => chain);
    chain.onConflictDoNothing = vi.fn(() => chain);
    chain.returning = vi.fn(() => Promise.resolve([]));
    chain.select = vi.fn(() => chain);
    chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => Promise.resolve([existing]));
    chain.delete = vi.fn(() => chain);

    const result = await conversationMemberQueries.addConversationMember(chain, {
      workspaceId: "w1",
      conversationId: "c1",
      memberType: "user",
      memberId: "u1",
    });
    expect(chain.onConflictDoNothing).toHaveBeenCalledWith(
      expect.objectContaining({ target: expect.any(Array) }),
    );
    expect(chain.select).toHaveBeenCalled();
    expect(result).toEqual(existing);
  });

  it("unique conflict returns null when existing row is other workspace", async () => {
    // Insert conflict (unique on conversation+type+id), but re-select with
    // caller's workspaceId finds nothing — never leak cross-workspace rows.
    const chain: any = {};
    chain.insert = vi.fn(() => chain);
    chain.values = vi.fn(() => chain);
    chain.onConflictDoNothing = vi.fn(() => chain);
    chain.returning = vi.fn(() => Promise.resolve([]));
    chain.select = vi.fn(() => chain);
    chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => Promise.resolve([]));

    const result = await conversationMemberQueries.addConversationMember(chain, {
      workspaceId: "w_other",
      conversationId: "c1",
      memberType: "user",
      memberId: "u1",
    });
    expect(result).toBeNull();
    const sql = whereSql(chain.where.mock.calls[0][0]);
    expect(sql.params).toEqual(
      expect.arrayContaining(["w_other", "c1", "user", "u1"]),
    );
  });

  it("ensurePrimaryConversationMembers seeds agent+user then lists", async () => {
    const agentRow = {
      id: "cvm_a",
      workspaceId: "w1",
      conversationId: "c1",
      memberType: "agent",
      memberId: "ag_1",
    };
    const userRow = {
      id: "cvm_u",
      workspaceId: "w1",
      conversationId: "c1",
      memberType: "user",
      memberId: "u_1",
    };

    let insertCount = 0;
    const chain: any = {};
    chain.insert = vi.fn(() => chain);
    chain.values = vi.fn(() => chain);
    chain.onConflictDoNothing = vi.fn(() => chain);
    chain.returning = vi.fn(() => {
      insertCount += 1;
      return Promise.resolve([insertCount === 1 ? agentRow : userRow]);
    });
    chain.select = vi.fn(() => chain);
    chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => Promise.resolve([agentRow, userRow]));

    const listed = await conversationMemberQueries.ensurePrimaryConversationMembers(
      chain,
      "w1",
      { id: "c1", agentId: "ag_1", userId: "u_1" },
    );
    expect(chain.insert).toHaveBeenCalledTimes(2);
    expect(listed).toEqual([agentRow, userRow]);
  });

  it("listConversationMembershipsForMember aliases listConversationsForMember", () => {
    expect(conversationMemberQueries.listConversationMembershipsForMember).toBe(
      conversationMemberQueries.listConversationsForMember,
    );
  });
});
