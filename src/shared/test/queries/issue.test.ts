import { describe, it, expect, vi } from "vitest";
import * as issueQueries from "../../src/db/queries/issue";

function createSelectMock(rows: any[]) {
  const chain: any = {};
  chain.select = vi.fn(() => chain);
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => Promise.resolve(rows));
  chain.orderBy = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.values = vi.fn(() => chain);
  chain.returning = vi.fn(() => Promise.resolve(rows));
  return chain;
}

describe("issue exports", () => {
  it("exports createIssue", () => { expect(typeof issueQueries.createIssue).toBe("function"); });
  it("exports getIssue", () => { expect(typeof issueQueries.getIssue).toBe("function"); });
  it("exports getIssueByConversation", () => { expect(typeof issueQueries.getIssueByConversation).toBe("function"); });
  it("exports listIssues", () => { expect(typeof issueQueries.listIssues).toBe("function"); });
  it("exports updateIssue", () => { expect(typeof issueQueries.updateIssue).toBe("function"); });
  it("exports setLatestTask", () => { expect(typeof issueQueries.setLatestTask).toBe("function"); });
  it("exports deleteIssue", () => { expect(typeof issueQueries.deleteIssue).toBe("function"); });
  it("exports listIssueMessages", () => { expect(typeof issueQueries.listIssueMessages).toBe("function"); });
});

describe("createIssue", () => {
  it("creates with default status todo", async () => {
    const iss = { id: "iss_1" };
    const mockDb = createSelectMock([iss]);
    const result = await issueQueries.createIssue(mockDb, { workspaceId: "w", agentId: "a", creatorUserId: "u", conversationId: "c", title: "T", description: "D" });
    expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({ status: "todo" }));
    expect(result).toEqual(iss);
  });
  it("uses custom status", async () => {
    const mockDb = createSelectMock([{ id: "iss_1" }]);
    await issueQueries.createIssue(mockDb, { workspaceId: "w", agentId: null, creatorUserId: "u", conversationId: null, title: "T", description: "D", status: "in_progress" });
    expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({ status: "in_progress" }));
  });
});

describe("getIssue", () => {
  it("returns null when not found", async () => { expect(await issueQueries.getIssue(createSelectMock([]), "x", "w")).toBeNull(); });
  it("returns issue", async () => { const i = { id: "iss_1" }; expect(await issueQueries.getIssue(createSelectMock([i]), "iss_1", "w")).toEqual(i); });
  it("returns null when userId does not match (where adds creatorUserId condition)", async () => {
    expect(await issueQueries.getIssue(createSelectMock([]), "iss_1", "w", "other_user")).toBeNull();
  });
  it("returns issue without userId (backwards compat for chhlat)", async () => {
    const i = { id: "iss_1" };
    expect(await issueQueries.getIssue(createSelectMock([i]), "iss_1", "w")).toEqual(i);
  });
});

describe("getIssueByConversation", () => {
  it("returns null when not found", async () => { expect(await issueQueries.getIssueByConversation(createSelectMock([]), "x", "w")).toBeNull(); });
  it("returns issue", async () => { const i = { id: "iss_1" }; expect(await issueQueries.getIssueByConversation(createSelectMock([i]), "c", "w")).toEqual(i); });
});

describe("listIssues", () => {
  function createListMock() {
    const chain: any = {};
    chain.select = vi.fn(() => chain); chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => chain); chain.orderBy = vi.fn(() => Promise.resolve([]));
    return chain;
  }
  it("lists with userId filter", async () => {
    const mockDb = createListMock();
    await issueQueries.listIssues(mockDb, "w", { userId: "u1" });
    expect(mockDb.orderBy).toHaveBeenCalled();
  });
  it("filters by agentId", async () => { await issueQueries.listIssues(createListMock(), "w", { userId: "u1", agentId: "a" }); });
  it("filters by status", async () => { await issueQueries.listIssues(createListMock(), "w", { userId: "u1", status: "todo" }); });
  it("filters terminal=true", async () => { await issueQueries.listIssues(createListMock(), "w", { userId: "u1", terminal: true }); });
  it("filters terminal=false", async () => { await issueQueries.listIssues(createListMock(), "w", { userId: "u1", terminal: false }); });
});

describe("updateIssue", () => {
  it("returns null when not found", async () => {
    const chain: any = {};
    chain.update = vi.fn(() => chain); chain.set = vi.fn(() => chain);
    chain.where = vi.fn(() => chain); chain.returning = vi.fn(() => Promise.resolve([]));
    expect(await issueQueries.updateIssue(chain, "x", "w", { title: "T" })).toBeNull();
  });
  it("returns updated issue", async () => {
    const i = { id: "iss_1" };
    const chain: any = {};
    chain.update = vi.fn(() => chain); chain.set = vi.fn(() => chain);
    chain.where = vi.fn(() => chain); chain.returning = vi.fn(() => Promise.resolve([i]));
    expect(await issueQueries.updateIssue(chain, "iss_1", "w", { title: "T" })).toEqual(i);
  });
  it("sets completedAt for terminal status", async () => {
    const chain: any = {};
    chain.update = vi.fn(() => chain); chain.set = vi.fn(() => chain);
    chain.where = vi.fn(() => chain); chain.returning = vi.fn(() => Promise.resolve([{ id: "iss_1" }]));
    await issueQueries.updateIssue(chain, "iss_1", "w", { status: "done" });
    expect(chain.set).toHaveBeenCalledWith(expect.objectContaining({ completedAt: expect.any(String) }));
  });
  it("sets completedAt null for active status", async () => {
    const chain: any = {};
    chain.update = vi.fn(() => chain); chain.set = vi.fn(() => chain);
    chain.where = vi.fn(() => chain); chain.returning = vi.fn(() => Promise.resolve([{ id: "iss_1" }]));
    await issueQueries.updateIssue(chain, "iss_1", "w", { status: "todo" });
    expect(chain.set).toHaveBeenCalledWith(expect.objectContaining({ completedAt: null }));
  });
});

describe("claimIssue", () => {
  it("exports claimIssue and handBackIssue", () => {
    expect(typeof issueQueries.claimIssue).toBe("function");
    expect(typeof issueQueries.handBackIssue).toBe("function");
  });
  it("returns null when claim lost race", async () => {
    const chain: any = {};
    chain.update = vi.fn(() => chain);
    chain.set = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.returning = vi.fn(() => Promise.resolve([]));
    expect(await issueQueries.claimIssue(chain, "iss_1", "w", "a1")).toBeNull();
  });
  it("claims for agent and scopes by workspace", async () => {
    const i = { id: "iss_1", claimedByAgentId: "a1" };
    const chain: any = {};
    chain.update = vi.fn(() => chain);
    chain.set = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.returning = vi.fn(() => Promise.resolve([i]));
    const result = await issueQueries.claimIssue(chain, "iss_1", "w", "a1");
    expect(result).toEqual(i);
    expect(chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ claimedByAgentId: "a1", agentId: "a1" })
    );
  });
  it("dual-agent race: first winner claims, second concurrent claim fails cleanly", async () => {
    // Simulates two agents racing claimIssue on the same issue. Only one
    // UPDATE returns a row (D1/SQLite compare-and-set); the loser gets null.
    const winner = { id: "iss_race", claimedByAgentId: "agent_a", workspaceId: "w" };
    const chainA: any = {};
    chainA.update = vi.fn(() => chainA);
    chainA.set = vi.fn(() => chainA);
    chainA.where = vi.fn(() => chainA);
    chainA.returning = vi.fn(() => Promise.resolve([winner]));

    const chainB: any = {};
    chainB.update = vi.fn(() => chainB);
    chainB.set = vi.fn(() => chainB);
    chainB.where = vi.fn(() => chainB);
    chainB.returning = vi.fn(() => Promise.resolve([]));

    const [a, b] = await Promise.all([
      issueQueries.claimIssue(chainA, "iss_race", "w", "agent_a"),
      issueQueries.claimIssue(chainB, "iss_race", "w", "agent_b"),
    ]);

    const results = [a, b];
    const winners = results.filter((r) => r != null);
    const losers = results.filter((r) => r == null);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(winners[0]?.claimedByAgentId).toBe("agent_a");
    expect(chainA.set).toHaveBeenCalledWith(
      expect.objectContaining({ claimedByAgentId: "agent_a", agentId: "agent_a" })
    );
    expect(chainB.set).toHaveBeenCalledWith(
      expect.objectContaining({ claimedByAgentId: "agent_b", agentId: "agent_b" })
    );
  });
  it("handBack clears claim", async () => {
    const i = { id: "iss_1", claimedByAgentId: null };
    const chain: any = {};
    chain.update = vi.fn(() => chain);
    chain.set = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.returning = vi.fn(() => Promise.resolve([i]));
    const result = await issueQueries.handBackIssue(chain, "iss_1", "w", "a1");
    expect(result).toEqual(i);
    expect(chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ claimedByAgentId: null, claimedAt: null })
    );
  });
});

describe("deleteIssue", () => {
  it("returns null when not found", async () => {
    const chain: any = {};
    chain.delete = vi.fn(() => chain); chain.where = vi.fn(() => chain);
    chain.returning = vi.fn(() => Promise.resolve([]));
    expect(await issueQueries.deleteIssue(chain, "x", "w")).toBeNull();
  });
  it("returns deleted issue", async () => {
    const i = { id: "iss_1" };
    const chain: any = {};
    chain.delete = vi.fn(() => chain); chain.where = vi.fn(() => chain);
    chain.returning = vi.fn(() => Promise.resolve([i]));
    expect(await issueQueries.deleteIssue(chain, "iss_1", "w")).toEqual(i);
  });
});

describe("listIssueMessages", () => {
  it("returns null when issue not found", async () => { expect(await issueQueries.listIssueMessages(createSelectMock([]), "x", "w")).toBeNull(); });
  it("returns empty when no conversationId", async () => {
    const chain: any = {};
    chain.select = vi.fn(() => chain); chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => Promise.resolve([{ id: "iss_1", conversationId: null }]));
    expect(await issueQueries.listIssueMessages(chain, "iss_1", "w")).toEqual([]);
  });
});
