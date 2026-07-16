import { describe, it, expect, vi } from "vitest";
import { drizzle } from "drizzle-orm/d1";
import { gatewayBinding, gatewayPeerAllowlist } from "../../src/db/schema";
import * as gatewayBindingQueries from "../../src/db/queries/gateway-binding";

const fakeDb = drizzle({} as never);

function createMock(rows: any[]) {
  const chain: any = {};
  chain.insert = vi.fn(() => chain);
  chain.values = vi.fn(() => chain);
  chain.onConflictDoNothing = vi.fn(() => chain);
  chain.returning = vi.fn(() => Promise.resolve(rows));
  chain.select = vi.fn(() => chain);
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => Object.assign(Promise.resolve(rows), chain));
  chain.update = vi.fn(() => chain);
  chain.set = vi.fn(() => chain);
  chain.delete = vi.fn(() => chain);
  return chain;
}

function whereSql(where: unknown) {
  return fakeDb
    .select()
    .from(gatewayBinding)
    .where(where as any)
    .toSQL();
}

describe("gateway-binding queries", () => {
  it("listGatewayBindings scopes by workspace", async () => {
    const rows = [{ id: "gb1", workspaceId: "w1" }];
    const mockDb = createMock(rows);
    const result = await gatewayBindingQueries.listGatewayBindings(mockDb, "w1");
    expect(result).toEqual(rows);
    expect(mockDb.from).toHaveBeenCalledWith(gatewayBinding);
    const sql = whereSql(mockDb.where.mock.calls[0][0]);
    expect(sql.sql).toContain("workspace_id");
  });

  it("createGatewayBinding inserts preview default", async () => {
    const row = {
      id: "gb1",
      workspaceId: "w1",
      provider: "slack",
      externalTeamId: "T1",
      agentId: "a1",
      userId: "u1",
      status: "active",
      dmPolicy: "open",
      outboundMode: "preview",
    };
    const mockDb = createMock([row]);
    const result = await gatewayBindingQueries.createGatewayBinding(mockDb, {
      workspaceId: "w1",
      provider: "slack",
      externalTeamId: "T1",
      agentId: "a1",
      userId: "u1",
    });
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "w1",
        provider: "slack",
        externalTeamId: "T1",
        outboundMode: "preview",
        dmPolicy: "open",
      }),
    );
    expect(result).toEqual(row);
  });

  it("isPeerAllowed returns true for allow/paired", async () => {
    const mockDb = createMock([{ status: "allow" }]);
    await expect(
      gatewayBindingQueries.isPeerAllowed(mockDb, "w1", "gb1", "U1"),
    ).resolves.toBe(true);

    const denyDb = createMock([{ status: "deny" }]);
    await expect(
      gatewayBindingQueries.isPeerAllowed(denyDb, "w1", "gb1", "U1"),
    ).resolves.toBe(false);

    const emptyDb = createMock([]);
    await expect(
      gatewayBindingQueries.isPeerAllowed(emptyDb, "w1", "gb1", "U1"),
    ).resolves.toBe(false);
  });

  it("claimIngressDedupe returns claimed true on insert", async () => {
    const row = { id: "d1", provider: "slack", externalMessageId: "slack:C:1" };
    const mockDb = createMock([row]);
    const result = await gatewayBindingQueries.claimIngressDedupe(mockDb, {
      workspaceId: "w1",
      provider: "slack",
      externalMessageId: "slack:C:1",
    });
    expect(result).toEqual({ claimed: true, row });
    expect(mockDb.onConflictDoNothing).toHaveBeenCalled();
  });

  it("addPeerAllowlist inserts allow status", async () => {
    const row = { id: "gpa1", peerId: "U1", status: "allow" };
    const mockDb = createMock([row]);
    const result = await gatewayBindingQueries.addPeerAllowlist(mockDb, {
      workspaceId: "w1",
      bindingId: "gb1",
      peerId: "U1",
    });
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "w1",
        bindingId: "gb1",
        peerId: "U1",
        status: "allow",
      }),
    );
    expect(result).toEqual(row);
    expect(mockDb.from).not.toHaveBeenCalledWith(gatewayPeerAllowlist); // insert path
  });
});

describe("gateway dry-config doctor assessors", () => {
  it("flags live without token risk and missing team/agent (no network)", () => {
    const report = gatewayBindingQueries.assessGatewayBindingsDryConfig(
      [
        {
          provider: "telegram",
          externalTeamId: "c1",
          agentId: "a1",
          status: "active",
          outboundMode: "live",
        },
        {
          provider: "slack",
          externalTeamId: "  ",
          agentId: "missing",
          status: "active",
          outboundMode: "preview",
        },
      ],
      { knownAgentIds: ["a1"] },
    );

    expect(report).toMatchObject({
      total: 2,
      live: 1,
      preview: 1,
      live_without_token_risk: 1,
      missing_team_id: 1,
      missing_agent_ref: 1,
      status: "critical",
    });
    expect(report.issues.map((i) => i.code)).toEqual(
      expect.arrayContaining([
        "gateway_live_without_token_risk",
        "gateway_binding_missing_team_id",
        "gateway_binding_missing_agent",
      ]),
    );
  });

  it("is ok for empty bindings", () => {
    const report = gatewayBindingQueries.assessGatewayBindingsDryConfig([]);
    expect(report.status).toBe("ok");
    expect(report.total).toBe(0);
    expect(report.issues).toEqual([]);
  });

  it("fail-closed when team map set without webhook secret", () => {
    const bad = gatewayBindingQueries.assessGatewayWebhookSecretConfig({
      GATEWAY_TEAM_MAP: '{"slack:T1":{}}',
      GATEWAY_WEBHOOK_SECRET: "",
    });
    expect(bad.fail_closed).toBe(true);
    expect(bad.status).toBe("critical");
    expect(bad.issues[0]?.code).toBe("gateway_webhook_secret_missing");

    const ok = gatewayBindingQueries.assessGatewayWebhookSecretConfig({
      GATEWAY_TEAM_MAP: '{"slack:T1":{}}',
      GATEWAY_WEBHOOK_SECRET: "secret",
    });
    expect(ok.fail_closed).toBe(false);
    expect(ok.status).toBe("ok");
  });
});
