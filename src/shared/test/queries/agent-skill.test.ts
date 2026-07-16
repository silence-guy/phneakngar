import { describe, it, expect, vi } from "vitest";
import * as agentSkillQueries from "../../src/db/queries/agent-skill";

function createMockDb(rows: any[]) {
  const chain: any = {};
  chain.select = vi.fn(() => chain);
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => Promise.resolve(rows));
  return chain;
}

function createInstallMockDb(opts: {
  existing?: any[];
  updated?: any[];
  inserted?: any[];
}) {
  const chain: any = {};
  chain.select = vi.fn(() => chain);
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.limit = vi.fn(() => Promise.resolve(opts.existing ?? []));
  chain.update = vi.fn(() => chain);
  chain.set = vi.fn(() => chain);
  chain.returning = vi.fn(() =>
    Promise.resolve(opts.updated ?? opts.inserted ?? []),
  );
  chain.insert = vi.fn(() => chain);
  chain.values = vi.fn(() => chain);
  return chain;
}

describe("agent-skill query module exports", () => {
  it("exports syncGlobalSkills", () => {
    expect(typeof agentSkillQueries.syncGlobalSkills).toBe("function");
  });
  it("exports syncAgentSkills", () => {
    expect(typeof agentSkillQueries.syncAgentSkills).toBe("function");
  });
  it("exports getSkills", () => {
    expect(typeof agentSkillQueries.getSkills).toBe("function");
  });
  it("exports installAgentSkill", () => {
    expect(typeof agentSkillQueries.installAgentSkill).toBe("function");
  });
});

describe("agent-skill query function signatures", () => {
  it("syncGlobalSkills accepts (db, workspaceId, runtime, skills, chhlatId?)", () => {
    expect(agentSkillQueries.syncGlobalSkills.length).toBe(5);
  });
  it("syncAgentSkills accepts (db, agentId, runtime, workspaceId, skills)", () => {
    expect(agentSkillQueries.syncAgentSkills.length).toBe(5);
  });
  it("getSkills accepts (db, agentId, runtime, workspaceId)", () => {
    expect(agentSkillQueries.getSkills.length).toBe(4);
  });
  it("installAgentSkill accepts (db, data)", () => {
    expect(agentSkillQueries.installAgentSkill.length).toBe(2);
  });
});

describe("getSkills", () => {
  it("returns empty array when no skills found", async () => {
    const mockDb = createMockDb([]);
    const result = await agentSkillQueries.getSkills(mockDb, "ag_1", "local", "ws_1");
    expect(result).toEqual([]);
  });

  it("returns skills and deduplicates global skills by name", async () => {
    const rows = [
      { name: "code-review", description: "Reviews code", isGlobal: true },
      { name: "code-review", description: "Reviews code (dup)", isGlobal: true },
      { name: "deploy", description: "Deploys apps", isGlobal: false },
    ];
    const mockDb = createMockDb(rows);
    const result = await agentSkillQueries.getSkills(mockDb, "ag_1", "local", "ws_1");
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("code-review");
    expect(result[0].description).toBe("Reviews code");
    expect(result[1].name).toBe("deploy");
  });

  it("does not deduplicate across global and agent scopes", async () => {
    const rows = [
      { name: "review", description: "Global review", isGlobal: true },
      { name: "review", description: "Agent review", isGlobal: false },
    ];
    const mockDb = createMockDb(rows);
    const result = await agentSkillQueries.getSkills(mockDb, "ag_1", "local", "ws_1");
    expect(result).toHaveLength(2);
  });
});

describe("installAgentSkill", () => {
  it("inserts when no matching agent-scoped skill exists", async () => {
    const inserted = {
      id: "as_new",
      workspaceId: "ws_1",
      agentId: "ag_1",
      chhlatId: null,
      runtime: "claude",
      name: "deploy-helper",
      description: "Deploys apps",
    };
    const mockDb = createInstallMockDb({ existing: [], inserted: [inserted] });
    const result = await agentSkillQueries.installAgentSkill(mockDb, {
      workspaceId: "ws_1",
      agentId: "ag_1",
      runtime: "claude",
      name: "deploy-helper",
      description: "Deploys apps",
    });
    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws_1",
        agentId: "ag_1",
        chhlatId: null,
        runtime: "claude",
        name: "deploy-helper",
        description: "Deploys apps",
      }),
    );
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(result).toEqual(inserted);
  });

  it("updates description on reinstall (idempotent upsert)", async () => {
    const existing = {
      id: "as_1",
      workspaceId: "ws_1",
      agentId: "ag_1",
      chhlatId: null,
      runtime: "claude",
      name: "deploy-helper",
      description: "old",
    };
    const updated = { ...existing, description: "new desc" };
    const mockDb = createInstallMockDb({ existing: [existing], updated: [updated] });
    const result = await agentSkillQueries.installAgentSkill(mockDb, {
      workspaceId: "ws_1",
      agentId: "ag_1",
      runtime: "claude",
      name: "deploy-helper",
      description: "new desc",
    });
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({ description: "new desc" }),
    );
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(result).toEqual(updated);
  });

  it("scopes select and update by workspaceId before mutating", async () => {
    const existing = {
      id: "as_1",
      workspaceId: "ws_1",
      agentId: "ag_1",
      chhlatId: null,
      runtime: "claude",
      name: "deploy-helper",
      description: "old",
    };
    const mockDb = createInstallMockDb({
      existing: [existing],
      updated: [{ ...existing, description: "refreshed" }],
    });

    await agentSkillQueries.installAgentSkill(mockDb, {
      workspaceId: "ws_1",
      agentId: "ag_1",
      runtime: "claude",
      name: "deploy-helper",
      description: "refreshed",
    });

    // select → where → limit path for existence check
    expect(mockDb.select).toHaveBeenCalled();
    expect(mockDb.where).toHaveBeenCalled();
    expect(mockDb.limit).toHaveBeenCalledWith(1);
    // update path also uses where (id + workspaceId)
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.where.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("is idempotent across repeated installs of the same skill key", async () => {
    const existing = {
      id: "as_1",
      workspaceId: "ws_1",
      agentId: "ag_1",
      chhlatId: null,
      runtime: "claude",
      name: "deploy-helper",
      description: "v1",
    };
    const mockDb = createInstallMockDb({
      existing: [existing],
      updated: [{ ...existing, description: "v2" }],
    });

    const first = await agentSkillQueries.installAgentSkill(mockDb, {
      workspaceId: "ws_1",
      agentId: "ag_1",
      runtime: "claude",
      name: "deploy-helper",
      description: "v2",
    });
    expect(first.description).toBe("v2");
    expect(mockDb.insert).not.toHaveBeenCalled();

    // second call still updates (no insert) when row exists
    mockDb.limit.mockResolvedValueOnce([existing]);
    mockDb.returning.mockResolvedValueOnce([{ ...existing, description: "v3" }]);
    const second = await agentSkillQueries.installAgentSkill(mockDb, {
      workspaceId: "ws_1",
      agentId: "ag_1",
      runtime: "claude",
      name: "deploy-helper",
      description: "v3",
    });
    expect(second.description).toBe("v3");
    expect(mockDb.insert).not.toHaveBeenCalled();
  });
});
