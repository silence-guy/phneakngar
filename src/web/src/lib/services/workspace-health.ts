import {
  OFFLINE_THRESHOLD_MS,
  queries,
  type Database,
} from "@phneakngar/shared";

export type WorkspaceHealthStatus = "ok" | "warning" | "critical";

export type WorkspaceHealthIssue = {
  code: string;
  severity: Exclude<WorkspaceHealthStatus, "ok">;
  message: string;
  next_actions?: string[];
};

export type WorkspaceHealthReport = {
  status: WorkspaceHealthStatus;
  generated_at: string;
  checks: {
    machines: {
      status: WorkspaceHealthStatus;
      total: number;
      online: number;
      offline: number;
    };
    runtimes: {
      status: WorkspaceHealthStatus;
      total: number;
      providers: string[];
    };
    queue: {
      status: WorkspaceHealthStatus;
      queued: number;
      stale: number;
      failed_today: number;
    };
    configuration: {
      status: WorkspaceHealthStatus;
      total_agents: number;
      assigned_agents: number;
      unassigned_agents: number;
      agents_with_missing_runtime: number;
    };
    headroom: {
      status: WorkspaceHealthStatus;
      enabled_agents: number;
      required_agents: number;
      unavailable_agents: number;
      runtimes_reporting: number;
      runtimes_available: number;
    };
    /**
     * Dry-config gateway doctor (no live provider API probes).
     * Live badges are not send-readiness; full commercial parity is not claimed.
     */
    gateway: {
      status: WorkspaceHealthStatus;
      total: number;
      active: number;
      disabled: number;
      live: number;
      preview: number;
      live_without_token_risk: number;
      missing_team_id: number;
      missing_agent_ref: number;
      webhook_map_configured: boolean;
      webhook_secret_configured: boolean;
      webhook_fail_closed: boolean;
    };
  };
  issues: WorkspaceHealthIssue[];
};

type HealthOptions = {
  now?: Date;
  /** Optional env snapshot for webhook secret fail-closed dry-config. */
  gatewayEnv?: {
    GATEWAY_TEAM_MAP?: string | null;
    GATEWAY_WEBHOOK_SECRET?: string | null;
  };
};

const HEADROOM_NEXT_ACTIONS = new Set([
  "enable_headroom",
  "install_headroom",
  "configure_headroom_path",
]);

function isOnline(lastSeenAt: string | null | undefined, nowMs: number) {
  if (!lastSeenAt) return false;
  const lastSeenMs = Date.parse(lastSeenAt);
  return Number.isFinite(lastSeenMs) && nowMs - lastSeenMs < OFFLINE_THRESHOLD_MS;
}

function worstStatus(issues: WorkspaceHealthIssue[]): WorkspaceHealthStatus {
  if (issues.some((issue) => issue.severity === "critical")) return "critical";
  return issues.length > 0 ? "warning" : "ok";
}

function checkStatus(
  issues: WorkspaceHealthIssue[],
  codes: string[],
): WorkspaceHealthStatus {
  return worstStatus(issues.filter((issue) => codes.includes(issue.code)));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asJsonRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "string") return asRecord(value);
  try {
    return asRecord(JSON.parse(value));
  } catch {
    return null;
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

type ParsedMetadata = {
  parsed: Record<string, unknown>;
  headroomAvailable: boolean | null;
  headroomNextActions: string[];
};

function parseMetadataOnce(runtime: { metadata: unknown }): ParsedMetadata {
  const parsed = asJsonRecord(runtime.metadata) ?? {};
  const headroom = asRecord(parsed.headroom);
  const actions = Array.isArray(headroom?.next_actions)
    ? (headroom.next_actions as unknown[]).filter(
        (a): a is string => typeof a === "string" && HEADROOM_NEXT_ACTIONS.has(a),
      )
    : [];
  let headroomNextActions: string[] = actions.length > 0 ? unique(actions) : [];
  if (headroomNextActions.length === 0 && headroom?.available === false) {
    headroomNextActions = headroom.configured === false
      ? ["enable_headroom", "install_headroom"]
      : ["install_headroom", "configure_headroom_path"];
  }
  return {
    parsed,
    headroomAvailable:
      headroom && typeof headroom.available === "boolean"
        ? headroom.available
        : null,
    headroomNextActions,
  };
}

export async function getWorkspaceHealth(
  db: Database,
  workspaceId: string,
  opts: HealthOptions = {},
): Promise<WorkspaceHealthReport> {
  const now = opts.now ?? new Date();
  const nowMs = now.getTime();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  // Health is a workspace-level view: runtimes MUST be scoped to the workspace,
  // not the viewing user. Scoping runtimes by user while agents stay
  // workspace-wide makes another member's runtimes vanish, falsely reporting
  // "no_runtime_registered" and "headroom_required_unavailable" criticals.
  const [runtimes, agents, taskStats, gatewayBindings] = await Promise.all([
    queries.runtime.listAgentRuntimes(db, workspaceId),
    queries.agent.getAllAgentsForWorkspace(db, workspaceId),
    queries.overview.getTaskStatsByWorkspace(db, workspaceId, todayStart.toISOString()),
    queries.gatewayBinding.listGatewayBindings(db, workspaceId),
  ]);

  const runtimeIds = new Set(runtimes.map((runtime) => runtime.id));
  const online = runtimes.filter((runtime) => isOnline(runtime.machineLastSeenAt, nowMs)).length;
  const offline = runtimes.length - online;
  const assignedAgents = agents.filter((agent) => Boolean(agent.runtimeId)).length;
  const agentsWithMissingRuntime = agents.filter(
    (agent) => agent.runtimeId && !runtimeIds.has(agent.runtimeId),
  ).length;
  const unassignedAgents = agents.length - assignedAgents;

  // Pre-parse metadata once per runtime; accumulate reporting/available counts.
  let headroomReportingRuntimes = 0;
  let headroomAvailableRuntimes = 0;
  const runtimeParsed = new Map<string, ParsedMetadata>();
  for (const runtime of runtimes) {
    const parsed = parseMetadataOnce(runtime);
    runtimeParsed.set(runtime.id, parsed);
    if (parsed.headroomAvailable !== null) {
      headroomReportingRuntimes++;
      if (parsed.headroomAvailable) headroomAvailableRuntimes++;
    }
  }

  const headroomAgentSettings = agents
    .map((agent) => {
      const meta = agent.runtimeId ? runtimeParsed.get(agent.runtimeId) : null;
      const config = asJsonRecord(agent.runtimeConfig);
      const headroomConfig = asRecord(config?.headroom);
      const enabled = headroomConfig?.enabled === true;
      const requireOptimization = headroomConfig?.requireOptimization === true;
      return { runtimeId: agent.runtimeId, enabled, requireOptimization, meta };
    })
    .filter((agent) => agent.enabled);
  const headroomUnavailableAgents = headroomAgentSettings.filter((agent) => {
    return agent.meta ? agent.meta.headroomAvailable !== true : true;
  });
  const headroomRequiredUnavailableAgents = headroomUnavailableAgents.filter(
    (agent) => agent.requireOptimization,
  );
  const headroomUnavailableNextActions = unique(
    headroomUnavailableAgents.flatMap((agent) =>
      agent.meta ? agent.meta.headroomNextActions : [],
    ),
  );
  const headroomIssueGuidance = headroomUnavailableNextActions.length > 0
    ? { next_actions: headroomUnavailableNextActions }
    : {};

  const issues: WorkspaceHealthIssue[] = [];
  if (runtimes.length === 0) {
    issues.push({
      code: "no_runtime_registered",
      severity: "critical",
      message: "No runtime is registered for this workspace.",
    });
  } else if (online === 0) {
    issues.push({
      code: "all_machines_offline",
      severity: "critical",
      message: "All registered machines are offline.",
    });
  } else if (offline > 0) {
    issues.push({
      code: "some_machines_offline",
      severity: "warning",
      message: "One or more registered machines are offline.",
    });
  }

  if (taskStats.queued > 0 && online === 0) {
    issues.push({
      code: "queued_without_online_machine",
      severity: "critical",
      message: "Queued work cannot run because there is no online machine.",
    });
  }
  if (taskStats.stale > 0) {
    issues.push({
      code: "stale_running_tasks",
      severity: "warning",
      message: "One or more running tasks appear stale.",
    });
  }
  if (taskStats.failed > 0) {
    issues.push({
      code: "failed_tasks_today",
      severity: "warning",
      message: "One or more tasks failed today.",
    });
  }

  if (unassignedAgents > 0) {
    issues.push({
      code: "agents_without_runtime",
      severity: "warning",
      message: "One or more agents do not have a runtime assigned.",
    });
  }
  if (agentsWithMissingRuntime > 0) {
    issues.push({
      code: "agents_with_missing_runtime",
      severity: "warning",
      message: "One or more agents reference a runtime that is no longer registered.",
    });
  }
  if (headroomRequiredUnavailableAgents.length > 0) {
    issues.push({
      code: "headroom_required_unavailable",
      severity: "critical",
      message: "One or more agents require Headroom optimization, but their assigned runtime has not reported an available Headroom executable.",
      ...headroomIssueGuidance,
    });
  } else if (headroomUnavailableAgents.length > 0) {
    issues.push({
      code: "headroom_runtime_unavailable",
      severity: "warning",
      message: "One or more agents enable Headroom optimization, but their assigned runtime has not reported an available Headroom executable.",
      ...headroomIssueGuidance,
    });
  }

  // Dry-config gateway doctor: binding misconfig + secret-missing fail-closed.
  // No Telegram/Slack HTTP probes. Live is a risk flag, not send-readiness.
  const gatewayBindingReport = queries.gatewayBinding.assessGatewayBindingsDryConfig(
    gatewayBindings.map((binding) => ({
      id: binding.id,
      provider: binding.provider,
      externalTeamId: binding.externalTeamId,
      agentId: binding.agentId,
      status: binding.status,
      dmPolicy: binding.dmPolicy,
      outboundMode: binding.outboundMode,
    })),
    { knownAgentIds: agents.map((agent) => agent.id) },
  );
  const gatewayWebhookReport = queries.gatewayBinding.assessGatewayWebhookSecretConfig(
    opts.gatewayEnv ?? {},
  );
  for (const issue of [...gatewayBindingReport.issues, ...gatewayWebhookReport.issues]) {
    issues.push({
      code: issue.code,
      severity: issue.severity,
      message: issue.message,
      ...(issue.next_actions ? { next_actions: issue.next_actions } : {}),
    });
  }

  return {
    status: worstStatus(issues),
    generated_at: now.toISOString(),
    checks: {
      machines: {
        status: checkStatus(issues, [
          "no_runtime_registered",
          "all_machines_offline",
          "some_machines_offline",
        ]),
        total: runtimes.length,
        online,
        offline,
      },
      runtimes: {
        status: runtimes.length === 0 ? "critical" : "ok",
        total: runtimes.length,
        providers: [...new Set(runtimes.map((runtime) => runtime.provider))].sort(),
      },
      queue: {
        status: checkStatus(issues, [
          "queued_without_online_machine",
          "stale_running_tasks",
          "failed_tasks_today",
        ]),
        queued: taskStats.queued,
        stale: taskStats.stale,
        failed_today: taskStats.failed,
      },
      configuration: {
        status: checkStatus(issues, [
          "agents_without_runtime",
          "agents_with_missing_runtime",
        ]),
        total_agents: agents.length,
        assigned_agents: assignedAgents,
        unassigned_agents: unassignedAgents,
        agents_with_missing_runtime: agentsWithMissingRuntime,
      },
      headroom: {
        status: checkStatus(issues, [
          "headroom_runtime_unavailable",
          "headroom_required_unavailable",
        ]),
        enabled_agents: headroomAgentSettings.length,
        required_agents: headroomAgentSettings.filter((agent) => agent.requireOptimization).length,
        unavailable_agents: headroomUnavailableAgents.length,
        runtimes_reporting: headroomReportingRuntimes,
        runtimes_available: headroomAvailableRuntimes,
      },
      gateway: {
        status: checkStatus(issues, [
          "gateway_binding_missing_team_id",
          "gateway_binding_missing_agent",
          "gateway_live_without_token_risk",
          "gateway_webhook_secret_missing",
        ]),
        total: gatewayBindingReport.total,
        active: gatewayBindingReport.active,
        disabled: gatewayBindingReport.disabled,
        live: gatewayBindingReport.live,
        preview: gatewayBindingReport.preview,
        live_without_token_risk: gatewayBindingReport.live_without_token_risk,
        missing_team_id: gatewayBindingReport.missing_team_id,
        missing_agent_ref: gatewayBindingReport.missing_agent_ref,
        webhook_map_configured: gatewayWebhookReport.map_configured,
        webhook_secret_configured: gatewayWebhookReport.secret_configured,
        webhook_fail_closed: gatewayWebhookReport.fail_closed,
      },
    },
    issues,
  };
}
