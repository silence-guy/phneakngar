import {
  ApprovalKind,
  proposeSkillFromSuccess,
  queries,
  TaskStatus,
  type Database,
  type ProposeSkillFromTaskRequestInput,
  type SkillProposal,
} from "@phneakngar/shared";

const KNOWN_RUNTIMES = ["claude", "codex", "opencode", "grok"] as const;
type KnownRuntime = (typeof KNOWN_RUNTIMES)[number];

export type ProposeSkillFromTaskOptions = ProposeSkillFromTaskRequestInput & {
  workspaceId: string;
  userId: string;
};

export type ProposeSkillFromTaskResult =
  | {
      ok: true;
      approval: Awaited<ReturnType<typeof queries.approval.createApproval>>;
      proposal: SkillProposal;
      reused: boolean;
    }
  | {
      ok: false;
      status: 404 | 422;
      error: string;
    };

function isKnownRuntime(value: string): value is KnownRuntime {
  return (KNOWN_RUNTIMES as readonly string[]).includes(value);
}

function firstLine(text: string): string {
  return text.split(/\r?\n/, 1)[0]?.trim() ?? "";
}

function summaryFromResult(result: unknown): string | null {
  if (typeof result === "string") {
    const t = result.replace(/\s+/g, " ").trim();
    return t || null;
  }
  if (result && typeof result === "object" && !Array.isArray(result)) {
    const o = result as Record<string, unknown>;
    for (const key of ["summary", "message", "text", "output"] as const) {
      const v = o[key];
      if (typeof v === "string") {
        const t = v.replace(/\s+/g, " ").trim();
        if (t) return t;
      }
    }
    try {
      const json = JSON.stringify(result);
      if (json && json !== "{}" && json !== "null") {
        return json.slice(0, 280);
      }
    } catch {
      return null;
    }
  }
  return null;
}

async function resolveRuntime(
  db: Database,
  opts: {
    explicit?: string;
    agentRuntimeId: string | null | undefined;
    workspaceId: string;
  },
): Promise<KnownRuntime> {
  if (opts.explicit && isKnownRuntime(opts.explicit)) {
    return opts.explicit;
  }
  if (opts.agentRuntimeId) {
    // Scope runtime by workspace first (never resolve cross-workspace runtimes).
    const rt = await queries.runtime.getAgentRuntimeForWorkspace(
      db,
      opts.agentRuntimeId,
      opts.workspaceId,
    );
    if (rt?.provider && isKnownRuntime(rt.provider)) {
      return rt.provider;
    }
  }
  return "claude";
}

/**
 * Explicit propose path: completed task → skill proposal → pending skill_install approval.
 * Does not auto-hook completeTask (avoids approval spam).
 */
export async function proposeSkillFromCompletedTask(
  db: Database,
  opts: ProposeSkillFromTaskOptions,
): Promise<ProposeSkillFromTaskResult> {
  const task = await queries.task.getTask(db, opts.task_id, opts.workspaceId);
  if (!task) {
    return { ok: false, status: 404, error: "task not found" };
  }
  if (task.status !== TaskStatus.COMPLETED) {
    return {
      ok: false,
      status: 422,
      error: "task must be completed before proposing a skill",
    };
  }

  const agentId = opts.agent_id ?? task.agentId;
  if (!agentId) {
    return { ok: false, status: 422, error: "agent_id is required for skill install" };
  }

  const agent = await queries.agent.getAgent(
    db,
    agentId,
    opts.workspaceId,
    opts.userId,
  );
  if (!agent) {
    return { ok: false, status: 404, error: "agent not found in workspace" };
  }

  const runtime = await resolveRuntime(db, {
    explicit: opts.runtime,
    agentRuntimeId: agent.runtimeId,
    workspaceId: opts.workspaceId,
  });

  const title = firstLine(task.prompt) || task.prompt;
  const summary = summaryFromResult(task.result);
  const proposal = proposeSkillFromSuccess({
    taskId: task.id,
    traceId: task.traceId ?? task.id,
    title,
    summary,
    description: summary,
  });

  if (!proposal) {
    return {
      ok: false,
      status: 422,
      error: "task metadata is insufficient to propose a skill",
    };
  }

  const existing = await queries.approval.findPendingSkillInstall(
    db,
    opts.workspaceId,
    proposal.source_trace_id,
  );
  if (existing) {
    return {
      ok: true,
      approval: existing,
      proposal,
      reused: true,
    };
  }

  const approval = await queries.approval.createApproval(db, {
    workspaceId: opts.workspaceId,
    agentId,
    kind: ApprovalKind.SKILL_INSTALL,
    title: proposal.name,
    summary: proposal.description,
    payload: {
      name: proposal.name,
      description: proposal.description,
      source_trace_id: proposal.source_trace_id,
      runtime,
      agentId,
      taskId: task.id,
    },
  });

  return {
    ok: true,
    approval,
    proposal,
    reused: false,
  };
}
