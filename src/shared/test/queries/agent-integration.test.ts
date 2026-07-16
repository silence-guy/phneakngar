import { describe, it, expect, vi } from "vitest";
import * as integrationQueries from "../../src/db/queries/agent-integration";

function createMock(rows: any[]) {
  const chain: any = {};
  chain.insert = vi.fn(() => chain);
  chain.values = vi.fn(() => chain);
  chain.returning = vi.fn(() => Promise.resolve(rows));
  chain.select = vi.fn(() => chain);
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => Promise.resolve(rows));
  chain.delete = vi.fn(() => chain);
  return chain;
}

describe("agent-integration queries", () => {
  it("createIntegration defaults status active", async () => {
    const row = { id: "int_1", secretRef: "sec_ref" };
    const mockDb = createMock([row]);
    await integrationQueries.createIntegration(mockDb, {
      workspaceId: "w1",
      agentId: "a1",
      provider: "github",
      secretRef: "sec_ref",
    });
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "w1",
        agentId: "a1",
        provider: "github",
        status: "active",
        secretRef: "sec_ref",
      })
    );
  });

  it("toPublicIntegration never exposes secretRef", () => {
    const pub = integrationQueries.toPublicIntegration({
      id: "int_1",
      workspaceId: "w1",
      agentId: "a1",
      provider: "github",
      status: "active",
      config: { repo: "org/repo" },
      secretRef: "raw-secret-should-not-leak",
      createdAt: "t",
      updatedAt: "t",
    });
    expect(pub).not.toHaveProperty("secretRef");
    expect(pub).not.toHaveProperty("secret_ref");
    expect(pub.has_secret).toBe(true);
    expect(pub.provider).toBe("github");
  });

  it("deleteIntegration scopes by workspace and agent", async () => {
    const mockDb = createMock([]);
    const result = await integrationQueries.deleteIntegration(mockDb, "int_1", "w1", "a1");
    expect(result).toBeNull();
    expect(mockDb.where).toHaveBeenCalled();
  });
});
