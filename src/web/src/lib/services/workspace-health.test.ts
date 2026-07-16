import { describe, it, expect, vi, beforeEach } from "vitest";

const mockListAgentRuntimes = vi.fn();
const mockGetAllAgentsForWorkspace = vi.fn();
const mockGetTaskStatsByWorkspace = vi.fn();
const mockListGatewayBindings = vi.fn();

vi.mock("@phneakngar/shared", async () => {
  const real = await import("@phneakngar/shared");
  return {
    ...real,
    OFFLINE_THRESHOLD_MS: 20_000,
    queries: {
      ...real.queries,
      runtime: {
        listAgentRuntimes: (...args: unknown[]) => mockListAgentRuntimes(...args),
      },
      agent: {
        getAllAgentsForWorkspace: (...args: unknown[]) => mockGetAllAgentsForWorkspace(...args),
      },
      overview: {
        getTaskStatsByWorkspace: (...args: unknown[]) => mockGetTaskStatsByWorkspace(...args),
      },
      gatewayBinding: {
        ...real.queries.gatewayBinding,
        listGatewayBindings: (...args: unknown[]) => mockListGatewayBindings(...args),
      },
    },
  };
});

import { getWorkspaceHealth } from "./workspace-health";

const now = new Date("2026-06-24T10:00:00.000Z");

function taskStats(overrides: Record<string, number> = {}) {
  return {
    completed: 0,
    failed: 0,
    cancelled: 0,
    queued: 0,
    stale: 0,
    ...overrides,
  };
}

describe("getWorkspaceHealth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListAgentRuntimes.mockResolvedValue([]);
    mockGetAllAgentsForWorkspace.mockResolvedValue([]);
    mockGetTaskStatsByWorkspace.mockResolvedValue(taskStats());
    mockListGatewayBindings.mockResolvedValue([]);
  });

  it("reports ok when a machine is online and agents are configured", async () => {
    mockListAgentRuntimes.mockResolvedValue([
      {
        id: "rt1",
        provider: "claude",
        machineLastSeenAt: new Date(now.getTime() - 1_000).toISOString(),
      },
    ]);
    mockGetAllAgentsForWorkspace.mockResolvedValue([{ id: "a1", runtimeId: "rt1" }]);

    const report = await getWorkspaceHealth({} as any, "w1", { now });

    expect(report.status).toBe("ok");
    expect(report.checks.machines).toMatchObject({ total: 1, online: 1, offline: 0 });
    expect(report.checks.runtimes.providers).toEqual(["claude"]);
    expect(mockListAgentRuntimes).toHaveBeenCalledWith({}, "w1");
    expect(mockGetTaskStatsByWorkspace).toHaveBeenCalledWith({}, "w1", "2026-06-24T00:00:00.000Z");
  });

  it("scopes runtimes to the workspace, not the viewing user (no false alarms in multi-member workspaces)", async () => {
    // Runtimes are listed at workspace scope so another member's runtime is
    // visible; an agent assigned to it must NOT be flagged as missing-runtime
    // or Headroom-unavailable just because a different member is viewing.
    mockListAgentRuntimes.mockResolvedValue([
      {
        id: "rt-memberB",
        provider: "claude",
        machineLastSeenAt: new Date(now.getTime() - 1_000).toISOString(),
        metadata: { headroom: { available: true, configured: true } },
      },
    ]);
    mockGetAllAgentsForWorkspace.mockResolvedValue([
      {
        id: "a1",
        runtimeId: "rt-memberB",
        runtimeConfig: { headroom: { enabled: true, requireOptimization: true } },
      },
    ]);

    const report = await getWorkspaceHealth({} as any, "w1", { now });

    expect(mockListAgentRuntimes).toHaveBeenCalledWith({}, "w1");
    expect(report.status).toBe("ok");
    expect(report.checks.configuration.agents_with_missing_runtime).toBe(0);
    expect(report.issues.map((issue) => issue.code)).not.toContain("headroom_required_unavailable");
  });

  it("reports critical when queued tasks have no online machine", async () => {
    mockListAgentRuntimes.mockResolvedValue([
      {
        id: "rt1",
        provider: "codex",
        machineLastSeenAt: new Date(now.getTime() - 60_000).toISOString(),
      },
    ]);
    mockGetTaskStatsByWorkspace.mockResolvedValue(taskStats({ queued: 3 }));

    const report = await getWorkspaceHealth({} as any, "w1", { now });

    expect(report.status).toBe("critical");
    expect(report.checks.machines.status).toBe("critical");
    expect(report.checks.queue.status).toBe("critical");
    expect(report.issues.map((issue) => issue.code)).toContain("queued_without_online_machine");
  });

  it("reports warnings for stale, failed, unassigned, and missing-runtime agents", async () => {
    mockListAgentRuntimes.mockResolvedValue([
      {
        id: "rt1",
        provider: "opencode",
        machineLastSeenAt: new Date(now.getTime() - 1_000).toISOString(),
      },
    ]);
    mockGetAllAgentsForWorkspace.mockResolvedValue([
      { id: "a1", runtimeId: "rt1" },
      { id: "a2", runtimeId: null },
      { id: "a3", runtimeId: "missing" },
    ]);
    mockGetTaskStatsByWorkspace.mockResolvedValue(taskStats({ failed: 1, stale: 2 }));

    const report = await getWorkspaceHealth({} as any, "w1", { now });

    expect(report.status).toBe("warning");
    expect(report.checks.queue).toMatchObject({ status: "warning", failed_today: 1, stale: 2 });
    expect(report.checks.configuration).toMatchObject({
      status: "warning",
      total_agents: 3,
      assigned_agents: 2,
      unassigned_agents: 1,
      agents_with_missing_runtime: 1,
    });
    expect(report.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "stale_running_tasks",
      "failed_tasks_today",
      "agents_without_runtime",
      "agents_with_missing_runtime",
    ]));
  });

  it("reports ok when Headroom-enabled agents have an available runtime", async () => {
    mockListAgentRuntimes.mockResolvedValue([
      {
        id: "rt1",
        provider: "claude",
        machineLastSeenAt: new Date(now.getTime() - 1_000).toISOString(),
        metadata: {
          headroom: {
            status: "available",
            configured: false,
            available: true,
            mode: "proxy",
            port: 8787,
            executable: "headroom",
          },
        },
      },
    ]);
    mockGetAllAgentsForWorkspace.mockResolvedValue([
      { id: "a1", runtimeId: "rt1", runtimeConfig: { headroom: { enabled: true } } },
    ]);

    const report = await getWorkspaceHealth({} as any, "w1", { now });

    expect(report.status).toBe("ok");
    expect(report.checks.headroom).toMatchObject({
      status: "ok",
      enabled_agents: 1,
      required_agents: 0,
      unavailable_agents: 0,
      runtimes_reporting: 1,
      runtimes_available: 1,
    });
  });

  it("warns when optional Headroom agents lack an available runtime", async () => {
    mockListAgentRuntimes.mockResolvedValue([
      {
        id: "rt1",
        provider: "codex",
        machineLastSeenAt: new Date(now.getTime() - 1_000).toISOString(),
        metadata: {
          headroom: {
            available: false,
            configured: true,
            next_actions: ["install_headroom", "configure_headroom_path"],
          },
        },
      },
    ]);
    mockGetAllAgentsForWorkspace.mockResolvedValue([
      { id: "a1", runtimeId: "rt1", runtimeConfig: { headroom: { enabled: true } } },
    ]);

    const report = await getWorkspaceHealth({} as any, "w1", { now });

    expect(report.status).toBe("warning");
    expect(report.checks.headroom).toMatchObject({
      status: "warning",
      enabled_agents: 1,
      required_agents: 0,
      unavailable_agents: 1,
      runtimes_reporting: 1,
      runtimes_available: 0,
    });
    const issue = report.issues.find((item) => item.code === "headroom_runtime_unavailable");
    expect(issue?.next_actions).toEqual(["install_headroom", "configure_headroom_path"]);
  });

  it("reports critical when required Headroom optimization is unavailable", async () => {
    mockListAgentRuntimes.mockResolvedValue([
      {
        id: "rt1",
        provider: "opencode",
        machineLastSeenAt: new Date(now.getTime() - 1_000).toISOString(),
        metadata: {
          headroom: {
            available: false,
            configured: false,
            next_actions: ["enable_headroom", "install_headroom"],
          },
        },
      },
    ]);
    mockGetAllAgentsForWorkspace.mockResolvedValue([
      {
        id: "a1",
        runtimeId: "rt1",
        runtimeConfig: { headroom: { enabled: true, requireOptimization: true } },
      },
    ]);

    const report = await getWorkspaceHealth({} as any, "w1", { now });

    expect(report.status).toBe("critical");
    expect(report.checks.headroom).toMatchObject({
      status: "critical",
      enabled_agents: 1,
      required_agents: 1,
      unavailable_agents: 1,
    });
    const issue = report.issues.find((item) => item.code === "headroom_required_unavailable");
    expect(issue?.next_actions).toEqual(["enable_headroom", "install_headroom"]);
  });

  it("falls back to install guidance for older Headroom metadata without next actions", async () => {
    mockListAgentRuntimes.mockResolvedValue([
      {
        id: "rt1",
        provider: "codex",
        machineLastSeenAt: new Date(now.getTime() - 1_000).toISOString(),
        metadata: { headroom: { available: false } },
      },
    ]);
    mockGetAllAgentsForWorkspace.mockResolvedValue([
      { id: "a1", runtimeId: "rt1", runtimeConfig: { headroom: { enabled: true } } },
    ]);

    const report = await getWorkspaceHealth({} as any, "w1", { now });
    const issue = report.issues.find((item) => item.code === "headroom_runtime_unavailable");

    expect(issue?.next_actions).toEqual(["install_headroom", "configure_headroom_path"]);
  });

  it("reports dry-config gateway binding counts and live-without-token risk (no live probes)", async () => {
    mockListAgentRuntimes.mockResolvedValue([
      {
        id: "rt1",
        provider: "claude",
        machineLastSeenAt: new Date(now.getTime() - 1_000).toISOString(),
      },
    ]);
    mockGetAllAgentsForWorkspace.mockResolvedValue([{ id: "a1", runtimeId: "rt1" }]);
    mockListGatewayBindings.mockResolvedValue([
      {
        id: "gb1",
        provider: "telegram",
        externalTeamId: "chat-1",
        agentId: "a1",
        status: "active",
        dmPolicy: "open",
        outboundMode: "live",
      },
      {
        id: "gb2",
        provider: "slack",
        externalTeamId: "T1",
        agentId: "a1",
        status: "active",
        dmPolicy: "open",
        outboundMode: "preview",
      },
    ]);

    const report = await getWorkspaceHealth({} as any, "w1", { now });

    expect(mockListGatewayBindings).toHaveBeenCalledWith({}, "w1");
    expect(report.checks.gateway).toMatchObject({
      status: "warning",
      total: 2,
      active: 2,
      live: 1,
      preview: 1,
      live_without_token_risk: 1,
      webhook_fail_closed: false,
    });
    expect(report.issues.map((issue) => issue.code)).toContain("gateway_live_without_token_risk");
    expect(report.status).toBe("warning");
  });

  it("reports critical when gateway bindings misconfig or webhook secret fail-closed", async () => {
    mockListAgentRuntimes.mockResolvedValue([
      {
        id: "rt1",
        provider: "claude",
        machineLastSeenAt: new Date(now.getTime() - 1_000).toISOString(),
      },
    ]);
    mockGetAllAgentsForWorkspace.mockResolvedValue([{ id: "a1", runtimeId: "rt1" }]);
    mockListGatewayBindings.mockResolvedValue([
      {
        id: "gb-bad",
        provider: "discord",
        externalTeamId: "",
        agentId: "missing-agent",
        status: "active",
        dmPolicy: "open",
        outboundMode: "preview",
      },
    ]);

    const report = await getWorkspaceHealth({} as any, "w1", {
      now,
      gatewayEnv: {
        GATEWAY_TEAM_MAP: JSON.stringify({ "slack:T1": { workspaceId: "w1" } }),
        GATEWAY_WEBHOOK_SECRET: "",
      },
    });

    expect(report.checks.gateway).toMatchObject({
      status: "critical",
      missing_team_id: 1,
      missing_agent_ref: 1,
      webhook_map_configured: true,
      webhook_secret_configured: false,
      webhook_fail_closed: true,
    });
    expect(report.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "gateway_binding_missing_team_id",
        "gateway_binding_missing_agent",
        "gateway_webhook_secret_missing",
      ]),
    );
    expect(report.status).toBe("critical");
  });
});
