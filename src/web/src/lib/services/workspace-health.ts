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
  };
  issues: WorkspaceHealthIssue[];
};

type HealthOptions = {
  userId?: string;
  now?: Date;
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

function headroomSettings(runtimeConfig: unknown) {
  const config = asJsonRecord(runtimeConfig);
  const headroom = asRecord(config?.headroom);
  return {
    enabled: headroom?.enabled === true,
    requireOptimization: headroom?.requireOptimization === true,
  };
}

function headroomAvailableFromMetadata(metadata: unknown): boolean | null {
  const meta = asJsonRecord(metadata);
  const headroom = asRecord(meta?.headroom);
  if (!headroom || typeof headroom.available !== "boolean") return null;
  return headroom.available;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function headroomNextActionsFromMetadata(metadata: unknown): string[] {
  const meta = asJsonRecord(metadata);
  const headroom = asRecord(meta?.headroom);
  if (!headroom) return [];

  const actions = Array.isArray(headroom.next_actions) ? headroom.next_actions : [];
  const sanitized = actions.filter(
    (action): action is string => typeof action === "string" && HEADROOM_NEXT_ACTIONS.has(action),
  );
  if (sanitized.length > 0) return unique(sanitized);

  if (headroom.available === false) {
    return headroom.configured === false
      ? ["enable_headroom", "install_headroom"]
      : ["install_headroom", "configure_headroom_path"];
  }

  return [];
}

export async function getWorkspaceHealth(
  db: Database,
  workspaceId: string,
  opts: HealthOptions = {},
): Promise<WorkspaceHealthReport> {
  const now = opts.now ?? new Date();
  const nowMs = now.getTime();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const [runtimes, agents, taskStats] = await Promise.all([
    queries.runtime.listAgentRuntimes(db, workspaceId, opts.userId),
    queries.agent.getAllAgentsForWorkspace(db, workspaceId),
    queries.overview.getTaskStatsByWorkspace(db, workspaceId, todayStart.toISOString()),
  ]);

  const runtimeIds = new Set(runtimes.map((runtime) => runtime.id));
  const online = runtimes.filter((runtime) => isOnline(runtime.machineLastSeenAt, nowMs)).length;
  const offline = runtimes.length - online;
  const assignedAgents = agents.filter((agent) => Boolean(agent.runtimeId)).length;
  const agentsWithMissingRuntime = agents.filter(
    (agent) => agent.runtimeId && !runtimeIds.has(agent.runtimeId),
  ).length;
  const unassignedAgents = agents.length - assignedAgents;
  const runtimeById = new Map(runtimes.map((runtime) => [runtime.id, runtime]));
  const headroomAgentSettings = agents
    .map((agent) => ({
      runtimeId: agent.runtimeId,
      ...headroomSettings(agent.runtimeConfig),
    }))
    .filter((agent) => agent.enabled);
  const headroomUnavailableAgents = headroomAgentSettings.filter((agent) => {
    const runtime = agent.runtimeId ? runtimeById.get(agent.runtimeId) : null;
    return runtime ? headroomAvailableFromMetadata(runtime.metadata) !== true : true;
  });
  const headroomRequiredUnavailableAgents = headroomUnavailableAgents.filter(
    (agent) => agent.requireOptimization,
  );
  const headroomUnavailableNextActions = unique(headroomUnavailableAgents.flatMap((agent) => {
    const runtime = agent.runtimeId ? runtimeById.get(agent.runtimeId) : null;
    return runtime ? headroomNextActionsFromMetadata(runtime.metadata) : [];
  }));
  const headroomIssueGuidance = headroomUnavailableNextActions.length > 0
    ? { next_actions: headroomUnavailableNextActions }
    : {};
  const headroomReportingRuntimes = runtimes.filter(
    (runtime) => headroomAvailableFromMetadata(runtime.metadata) !== null,
  ).length;
  const headroomAvailableRuntimes = runtimes.filter(
    (runtime) => headroomAvailableFromMetadata(runtime.metadata) === true,
  ).length;

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
    },
    issues,
  };
}
