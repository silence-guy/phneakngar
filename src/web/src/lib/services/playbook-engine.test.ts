import { describe, it, expect, vi, beforeEach } from "vitest";

interface FakeRun {
  id: string;
  workspaceId: string;
  playbookId: string;
  playbookVersion: number;
  agentId: string;
  runtimeId: string | null;
  conversationId: string | null;
  status: string;
  currentStepId: string | null;
  snapshot: unknown;
  input: unknown;
  output: unknown;
  startedByUserId: string | null;
  currentTaskId: string | null;
  currentApprovalId: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
}

interface FakeStepRun {
  id: string;
  runId: string;
  workspaceId: string;
  stepId: string;
  stepKind: string;
  status: string;
  output: string | null;
  taskId: string | null;
  approvalId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
}

const state = {
  playbooks: new Map<string, any>(),
  runs: new Map<string, FakeRun>(),
  stepRuns: new Map<string, FakeStepRun>(),
  approvals: [] as any[],
  enqueuedTasks: [] as any[],
  supersededTasks: [] as string[],
  activities: [] as any[],
  conversations: new Map<string, { id: string; workspaceId: string; agentId: string }>(),
  taskServiceEmailDomains: [] as (string | undefined)[],
  getAgentCalls: [] as unknown[][],
  expiredApprovals: [] as string[],
  agent: { id: "ag1", workspaceId: "w1", runtimeId: "rt1", ownerId: "u1" } as any,
  conversationSeq: 0,
};

const mockEnqueueTask = vi.fn(async (...args: unknown[]) => {
  const task = { id: `task_${state.enqueuedTasks.length + 1}`, args };
  state.enqueuedTasks.push(task);
  return task;
});

vi.mock("@phneakngar/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@phneakngar/shared")>();
  return {
    ...actual,
    queries: {
      playbook: {
        getPlaybook: async (_db: unknown, id: string, workspaceId: string) => {
          const pb = state.playbooks.get(id);
          return pb && pb.workspaceId === workspaceId ? pb : null;
        },
      },
      playbookRun: {
        createPlaybookRun: async (_db: unknown, data: any) => {
          const run: FakeRun = {
            id: `pbr_${state.runs.size + 1}`,
            workspaceId: data.workspaceId,
            playbookId: data.playbookId,
            playbookVersion: data.playbookVersion,
            agentId: data.agentId,
            runtimeId: data.runtimeId ?? null,
            conversationId: data.conversationId ?? null,
            status: "running",
            currentStepId: data.firstStepId,
            snapshot: data.snapshot,
            input: data.input ?? null,
            output: null,
            startedByUserId: data.startedByUserId ?? null,
            currentTaskId: null,
            currentApprovalId: null,
            createdAt: new Date().toISOString(),
            startedAt: new Date().toISOString(),
            finishedAt: null,
            error: null,
          };
          state.runs.set(run.id, run);
          return run;
        },
        getPlaybookRun: async (_db: unknown, id: string, workspaceId: string) => {
          const run = state.runs.get(id);
          return run && run.workspaceId === workspaceId ? run : null;
        },
        updatePlaybookRun: async (_db: unknown, id: string, workspaceId: string, patch: any) => {
          const run = state.runs.get(id);
          if (!run || run.workspaceId !== workspaceId) return null;
          Object.assign(run, patch);
          return run;
        },
        updatePlaybookRunIfActive: async (
          _db: unknown,
          id: string,
          workspaceId: string,
          patch: any,
        ) => {
          const run = state.runs.get(id);
          if (!run || run.workspaceId !== workspaceId) return null;
          if (["completed", "failed", "cancelled"].includes(run.status)) return null;
          Object.assign(run, patch);
          return run;
        },
        ensureStepRun: async (_db: unknown, data: any) => {
          const key = `${data.runId}:${data.stepId}`;
          const existing = state.stepRuns.get(key);
          if (existing) return existing;
          const sr: FakeStepRun = {
            id: `pbsr_${state.stepRuns.size + 1}`,
            runId: data.runId,
            workspaceId: data.workspaceId,
            stepId: data.stepId,
            stepKind: data.stepKind,
            status: "pending",
            output: null,
            taskId: null,
            approvalId: null,
            startedAt: null,
            finishedAt: null,
            error: null,
          };
          state.stepRuns.set(key, sr);
          return sr;
        },
        getStepRun: async (_db: unknown, runId: string, stepId: string, workspaceId: string) => {
          const sr = state.stepRuns.get(`${runId}:${stepId}`);
          return sr && sr.workspaceId === workspaceId ? sr : null;
        },
        updateStepRun: async (
          _db: unknown,
          runId: string,
          stepId: string,
          workspaceId: string,
          patch: any,
        ) => {
          const sr = state.stepRuns.get(`${runId}:${stepId}`);
          if (!sr || sr.workspaceId !== workspaceId) return null;
          Object.assign(sr, patch);
          return sr;
        },
        resolveStepRunIfStatus: async (
          _db: unknown,
          runId: string,
          stepId: string,
          workspaceId: string,
          expectedStatus: string,
          patch: any,
        ) => {
          const sr = state.stepRuns.get(`${runId}:${stepId}`);
          if (!sr || sr.workspaceId !== workspaceId) return null;
          if (sr.status !== expectedStatus) return null;
          Object.assign(sr, patch);
          return sr;
        },
      },
      agent: {
        getAgent: (...args: unknown[]) => {
          state.getAgentCalls.push(args);
          return Promise.resolve(state.agent);
        },
      },
      conversation: {
        createConversation: async () => {
          state.conversationSeq += 1;
          return { id: `conv_${state.conversationSeq}` };
        },
        getConversation: async (_db: unknown, id: string, workspaceId: string) => {
          const conv = state.conversations.get(id);
          return conv && conv.workspaceId === workspaceId ? conv : null;
        },
      },
      approval: {
        createApproval: async (_db: unknown, data: any) => {
          const approval = { id: `ap_${state.approvals.length + 1}`, ...data };
          state.approvals.push(approval);
          return approval;
        },
        expireApproval: async (_db: unknown, id: string) => {
          state.expiredApprovals.push(id);
          return { id, status: "expired" };
        },
      },
      activityEvent: {
        createActivityEvent: async (_db: unknown, data: any) => {
          state.activities.push(data);
          return { id: `ae_${state.activities.length}` };
        },
      },
      task: {
        supersedeTask: async (_db: unknown, id: string) => {
          state.supersededTasks.push(id);
          return { id };
        },
      },
    },
  };
});

vi.mock("@/lib/services/task", () => ({
  TaskService: function (_db: unknown, emailDomain?: string) {
    state.taskServiceEmailDomains.push(emailDomain);
    return { enqueueTask: mockEnqueueTask };
  },
}));

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import {
  startPlaybookRun,
  advancePlaybookRun,
  handlePlaybookTaskTerminal,
  handlePlaybookApprovalDecided,
  answerPlaybookHumanInput,
  cancelPlaybookRun,
  PlaybookEngineError,
} from "./playbook-engine";

const db = {} as never;

function seedPlaybook(definition: unknown[], overrides: Record<string, unknown> = {}) {
  const pb = {
    id: "pb1",
    workspaceId: "w1",
    agentId: null,
    title: "Release checklist",
    description: "",
    definition,
    version: 1,
    status: "published",
    ...overrides,
  };
  state.playbooks.set(pb.id, pb);
  return pb;
}

function resetState() {
  state.playbooks.clear();
  state.runs.clear();
  state.stepRuns.clear();
  state.approvals.length = 0;
  state.enqueuedTasks.length = 0;
  state.supersededTasks.length = 0;
  state.activities.length = 0;
  state.conversations.clear();
  state.taskServiceEmailDomains.length = 0;
  state.getAgentCalls.length = 0;
  state.expiredApprovals.length = 0;
  state.conversationSeq = 0;
  state.agent = { id: "ag1", workspaceId: "w1", runtimeId: "rt1", ownerId: "u1" };
}

beforeEach(() => {
  resetState();
  vi.clearAllMocks();
});

describe("startPlaybookRun", () => {
  it("starts a run, creates a conversation, and dispatches the first agent step", async () => {
    seedPlaybook([{ id: "s1", kind: "agent", title: "Test", prompt: "release {{input.version}}" }]);
    const run = await startPlaybookRun(db, {
      workspaceId: "w1",
      playbookId: "pb1",
      agentId: "ag1",
      input: { version: "0.0.4" },
      startedByUserId: "u1",
    });
    expect(run?.status).toBe("running");
    expect(run?.conversationId).toBe("conv_1");
    expect(state.enqueuedTasks).toHaveLength(1);
    const prompt = state.enqueuedTasks[0].args[3];
    expect(prompt).toBe("release 0.0.4");
    const type = state.enqueuedTasks[0].args[4];
    expect(type).toBe("playbook_step");
    const stepRun = state.stepRuns.get(`${run!.id}:s1`);
    expect(stepRun?.status).toBe("running");
    expect(state.activities.some((a) => a.kind === "playbook_run_started")).toBe(true);
  });

  it("rejects draft playbooks", async () => {
    seedPlaybook([{ id: "s1", kind: "agent", title: "T", prompt: "p" }], { status: "draft" });
    await expect(
      startPlaybookRun(db, {
        workspaceId: "w1",
        playbookId: "pb1",
        agentId: "ag1",
        startedByUserId: "u1",
      }),
    ).rejects.toThrow(PlaybookEngineError);
  });

  it("rejects when playbook is bound to another agent", async () => {
    seedPlaybook([{ id: "s1", kind: "agent", title: "T", prompt: "p" }], { agentId: "other" });
    await expect(
      startPlaybookRun(db, {
        workspaceId: "w1",
        playbookId: "pb1",
        agentId: "ag1",
        startedByUserId: "u1",
      }),
    ).rejects.toThrow(/different agent/);
  });

  it("parks the run at awaiting_approval for a first approval step", async () => {
    seedPlaybook([{ id: "s1", kind: "approval", title: "Gate", approvalTitle: "Confirm?" }]);
    const run = await startPlaybookRun(db, {
      workspaceId: "w1",
      playbookId: "pb1",
      agentId: "ag1",
      startedByUserId: "u1",
    });
    expect(run?.status).toBe("awaiting_approval");
    expect(state.approvals).toHaveLength(1);
    expect(state.approvals[0].kind).toBe("playbook_step_gate");
    expect(state.enqueuedTasks).toHaveLength(0);
  });
});

describe("advancePlaybookRun", () => {
  async function startTwoStep() {
    seedPlaybook([
      { id: "s1", kind: "agent", title: "One", prompt: "first" },
      { id: "s2", kind: "agent", title: "Two", prompt: "second after {{steps.s1.output}}" },
    ]);
    const run = await startPlaybookRun(db, {
      workspaceId: "w1",
      playbookId: "pb1",
      agentId: "ag1",
      startedByUserId: "u1",
    });
    return run!;
  }

  it("is a no-op while the current step is still running", async () => {
    const run = await startTwoStep();
    const before = state.enqueuedTasks.length;
    await advancePlaybookRun(db, "w1", run.id);
    expect(state.enqueuedTasks.length).toBe(before);
    expect(state.runs.get(run.id)?.status).toBe("running");
  });

  it("advances to the next step when the current step completes", async () => {
    const run = await startTwoStep();
    const sr = state.stepRuns.get(`${run.id}:s1`)!;
    sr.status = "completed";
    sr.output = "done-one";
    await advancePlaybookRun(db, "w1", run.id);
    expect(state.enqueuedTasks).toHaveLength(2);
    expect(state.enqueuedTasks[1].args[3]).toBe("second after done-one");
    expect(state.runs.get(run.id)?.currentStepId).toBe("s2");
  });

  it("completes the run after the last step", async () => {
    const run = await startTwoStep();
    const s1 = state.stepRuns.get(`${run.id}:s1`)!;
    s1.status = "completed";
    s1.output = "one";
    await advancePlaybookRun(db, "w1", run.id);
    const s2 = state.stepRuns.get(`${run.id}:s2`)!;
    s2.status = "completed";
    s2.output = "two";
    const final = await advancePlaybookRun(db, "w1", run.id);
    expect(final?.status).toBe("completed");
    expect(final?.output).toEqual({ s1: "one", s2: "two" });
    expect(state.activities.some((a) => a.kind === "playbook_run_completed")).toBe(true);
  });

  it("fails the run when a step fails", async () => {
    const run = await startTwoStep();
    const s1 = state.stepRuns.get(`${run.id}:s1`)!;
    s1.status = "failed";
    s1.error = "boom";
    const final = await advancePlaybookRun(db, "w1", run.id);
    expect(final?.status).toBe("failed");
    expect(final?.error).toBe("boom");
    expect(state.enqueuedTasks).toHaveLength(1);
  });

  it("duplicate advance delivery does not double-dispatch", async () => {
    const run = await startTwoStep();
    const s1 = state.stepRuns.get(`${run.id}:s1`)!;
    s1.status = "completed";
    s1.output = "one";
    await advancePlaybookRun(db, "w1", run.id);
    const after = state.enqueuedTasks.length;
    // Second delivery: s1 still completed but current step is now s2 (running) → no-op.
    await advancePlaybookRun(db, "w1", run.id);
    expect(state.enqueuedTasks.length).toBe(after);
  });
});

describe("handlePlaybookTaskTerminal", () => {
  it("ignores non-playbook tasks", async () => {
    await handlePlaybookTaskTerminal(
      db,
      { id: "t1", workspaceId: "w1", type: "user_dm_message", context: {} },
      "completed",
    );
    expect(state.runs.size).toBe(0);
  });

  it("resolves the step and advances the run", async () => {
    seedPlaybook([
      { id: "s1", kind: "agent", title: "One", prompt: "first" },
      { id: "s2", kind: "approval", title: "Gate" },
    ]);
    const run = await startPlaybookRun(db, {
      workspaceId: "w1",
      playbookId: "pb1",
      agentId: "ag1",
      startedByUserId: "u1",
    });
    await handlePlaybookTaskTerminal(
      db,
      {
        id: "task_1",
        workspaceId: "w1",
        type: "playbook_step",
        context: { playbook_run_id: run!.id, playbook_step_id: "s1" },
      },
      "completed",
      { output: "step one done" },
    );
    expect(state.runs.get(run!.id)?.status).toBe("awaiting_approval");
    expect(state.stepRuns.get(`${run!.id}:s1`)?.status).toBe("completed");
  });

  it("is idempotent for duplicate completion delivery", async () => {
    seedPlaybook([{ id: "s1", kind: "agent", title: "One", prompt: "first" }]);
    const run = await startPlaybookRun(db, {
      workspaceId: "w1",
      playbookId: "pb1",
      agentId: "ag1",
      startedByUserId: "u1",
    });
    const task = {
      id: "task_1",
      workspaceId: "w1",
      type: "playbook_step",
      context: { playbook_run_id: run!.id, playbook_step_id: "s1" },
    };
    await handlePlaybookTaskTerminal(db, task, "completed", { output: "ok" });
    expect(state.runs.get(run!.id)?.status).toBe("completed");
    await handlePlaybookTaskTerminal(db, task, "completed", { output: "ok" });
    expect(state.runs.get(run!.id)?.status).toBe("completed");
  });
});

describe("handlePlaybookApprovalDecided", () => {
  it("advances on approve and fails on reject", async () => {
    seedPlaybook([
      { id: "s1", kind: "approval", title: "Gate" },
      { id: "s2", kind: "agent", title: "After", prompt: "go" },
    ]);
    const run = await startPlaybookRun(db, {
      workspaceId: "w1",
      playbookId: "pb1",
      agentId: "ag1",
      startedByUserId: "u1",
    });
    const approval = state.approvals[0];
    await handlePlaybookApprovalDecided(db, {
      ...approval,
      status: "approved",
    });
    expect(state.runs.get(run!.id)?.status).toBe("running");
    expect(state.stepRuns.get(`${run!.id}:s2`)?.status).toBe("running");

    // Second run, rejected gate.
    resetState();
    seedPlaybook([
      { id: "s1", kind: "approval", title: "Gate" },
      { id: "s2", kind: "agent", title: "After", prompt: "go" },
    ]);
    const run2 = await startPlaybookRun(db, {
      workspaceId: "w1",
      playbookId: "pb1",
      agentId: "ag1",
      startedByUserId: "u1",
    });
    await handlePlaybookApprovalDecided(db, { ...state.approvals[0], status: "rejected" });
    expect(state.runs.get(run2!.id)?.status).toBe("failed");
  });
});

describe("answerPlaybookHumanInput", () => {
  it("records the answer and advances", async () => {
    seedPlaybook([
      { id: "s1", kind: "human_input", title: "Ask", question: "Which version?" },
      { id: "s2", kind: "agent", title: "Use it", prompt: "bump {{steps.s1.output}}" },
    ]);
    const run = await startPlaybookRun(db, {
      workspaceId: "w1",
      playbookId: "pb1",
      agentId: "ag1",
      startedByUserId: "u1",
    });
    expect(run?.status).toBe("awaiting_input");
    await answerPlaybookHumanInput(db, "w1", run!.id, "0.0.5");
    expect(state.stepRuns.get(`${run!.id}:s1`)?.output).toBe("0.0.5");
    expect(state.enqueuedTasks[0].args[3]).toBe("bump 0.0.5");
  });

  it("rejects answering a run that is not awaiting input", async () => {
    seedPlaybook([{ id: "s1", kind: "agent", title: "One", prompt: "first" }]);
    const run = await startPlaybookRun(db, {
      workspaceId: "w1",
      playbookId: "pb1",
      agentId: "ag1",
      startedByUserId: "u1",
    });
    await expect(answerPlaybookHumanInput(db, "w1", run!.id, "x")).rejects.toThrow(
      PlaybookEngineError,
    );
  });
});

describe("cancelPlaybookRun", () => {
  it("supersedes the outstanding task and marks the run cancelled", async () => {
    seedPlaybook([{ id: "s1", kind: "agent", title: "One", prompt: "first" }]);
    const run = await startPlaybookRun(db, {
      workspaceId: "w1",
      playbookId: "pb1",
      agentId: "ag1",
      startedByUserId: "u1",
    });
    const outstandingTaskId = state.runs.get(run!.id)?.currentTaskId;
    expect(outstandingTaskId).toBeTruthy();
    const cancelled = await cancelPlaybookRun(db, "w1", run!.id);
    expect(cancelled?.status).toBe("cancelled");
    expect(state.supersededTasks).toContain(outstandingTaskId);
  });

  it("late task completion after cancel is a no-op", async () => {
    seedPlaybook([{ id: "s1", kind: "agent", title: "One", prompt: "first" }]);
    const run = await startPlaybookRun(db, {
      workspaceId: "w1",
      playbookId: "pb1",
      agentId: "ag1",
      startedByUserId: "u1",
    });
    await cancelPlaybookRun(db, "w1", run!.id);
    await handlePlaybookTaskTerminal(
      db,
      {
        id: "task_1",
        workspaceId: "w1",
        type: "playbook_step",
        context: { playbook_run_id: run!.id, playbook_step_id: "s1" },
      },
      "completed",
      { output: "late" },
    );
    expect(state.runs.get(run!.id)?.status).toBe("cancelled");
  });

  it("concurrent cancel wins over an in-flight advance (no dispatch on cancelled run)", async () => {
    seedPlaybook([
      { id: "s1", kind: "agent", title: "One", prompt: "first" },
      { id: "s2", kind: "agent", title: "Two", prompt: "second" },
    ]);
    const run = await startPlaybookRun(db, {
      workspaceId: "w1",
      playbookId: "pb1",
      agentId: "ag1",
      startedByUserId: "u1",
    });
    // Resolve s1, then cancel before advance runs.
    const s1 = state.stepRuns.get(`${run!.id}:s1`)!;
    s1.status = "completed";
    s1.output = "one";
    await cancelPlaybookRun(db, "w1", run!.id);
    const enqueuedBefore = state.enqueuedTasks.length;
    await advancePlaybookRun(db, "w1", run!.id);
    expect(state.runs.get(run!.id)?.status).toBe("cancelled");
    expect(state.enqueuedTasks.length).toBe(enqueuedBefore);
    expect(state.stepRuns.get(`${run!.id}:s2`)).toBeUndefined();
  });
});

describe("dispatch failure handling (no stuck runs)", () => {
  it("fails the run when enqueueTask rejects during start", async () => {
    seedPlaybook([{ id: "s1", kind: "agent", title: "One", prompt: "first" }]);
    mockEnqueueTask.mockRejectedValueOnce(new Error("agent has no runtime"));
    await expect(
      startPlaybookRun(db, {
        workspaceId: "w1",
        playbookId: "pb1",
        agentId: "ag1",
        startedByUserId: "u1",
      }),
    ).rejects.toThrow(PlaybookEngineError);
    const run = [...state.runs.values()][0]!;
    expect(run.status).toBe("failed");
    expect(run.error).toContain("agent has no runtime");
    expect(state.stepRuns.get(`${run.id}:s1`)?.status).toBe("failed");
  });

  it("fails the run when the next step dispatch rejects during advance", async () => {
    seedPlaybook([
      { id: "s1", kind: "agent", title: "One", prompt: "first" },
      { id: "s2", kind: "agent", title: "Two", prompt: "second" },
    ]);
    const run = await startPlaybookRun(db, {
      workspaceId: "w1",
      playbookId: "pb1",
      agentId: "ag1",
      startedByUserId: "u1",
    });
    mockEnqueueTask.mockRejectedValueOnce(new Error("agent not found"));
    await handlePlaybookTaskTerminal(
      db,
      {
        id: "task_1",
        workspaceId: "w1",
        type: "playbook_step",
        context: { playbook_run_id: run!.id, playbook_step_id: "s1" },
      },
      "completed",
      { output: "one" },
    );
    expect(state.runs.get(run!.id)?.status).toBe("failed");
    expect(state.stepRuns.get(`${run!.id}:s2`)?.status).toBe("failed");
    expect(state.activities.some((a) => a.kind === "playbook_run_failed")).toBe(true);
  });
});

describe("conversation validation", () => {
  it("rejects a conversation from another workspace", async () => {
    seedPlaybook([{ id: "s1", kind: "agent", title: "One", prompt: "first" }]);
    state.conversations.set("conv_foreign", { id: "conv_foreign", workspaceId: "w2", agentId: "ag1" });
    await expect(
      startPlaybookRun(db, {
        workspaceId: "w1",
        playbookId: "pb1",
        agentId: "ag1",
        startedByUserId: "u1",
        conversationId: "conv_foreign",
      }),
    ).rejects.toThrow(PlaybookEngineError);
    expect(state.runs.size).toBe(0);
  });

  it("rejects a conversation belonging to another agent", async () => {
    seedPlaybook([{ id: "s1", kind: "agent", title: "One", prompt: "first" }]);
    state.conversations.set("conv_other_agent", {
      id: "conv_other_agent",
      workspaceId: "w1",
      agentId: "ag_other",
    });
    await expect(
      startPlaybookRun(db, {
        workspaceId: "w1",
        playbookId: "pb1",
        agentId: "ag1",
        startedByUserId: "u1",
        conversationId: "conv_other_agent",
      }),
    ).rejects.toThrow(/conversation not found/);
  });

  it("uses a valid supplied conversation without creating one", async () => {
    seedPlaybook([{ id: "s1", kind: "agent", title: "One", prompt: "first" }]);
    state.conversations.set("conv_mine", { id: "conv_mine", workspaceId: "w1", agentId: "ag1" });
    const run = await startPlaybookRun(db, {
      workspaceId: "w1",
      playbookId: "pb1",
      agentId: "ag1",
      startedByUserId: "u1",
      conversationId: "conv_mine",
    });
    expect(run?.conversationId).toBe("conv_mine");
    expect(state.conversationSeq).toBe(0);
  });
});

describe("duplicate delivery safety (compare-and-swap)", () => {
  it("concurrent duplicate completions resolve the step exactly once", async () => {
    seedPlaybook([
      { id: "s1", kind: "agent", title: "One", prompt: "first" },
      { id: "s2", kind: "approval", title: "Gate" },
    ]);
    const run = await startPlaybookRun(db, {
      workspaceId: "w1",
      playbookId: "pb1",
      agentId: "ag1",
      startedByUserId: "u1",
    });
    const task = {
      id: "task_1",
      workspaceId: "w1",
      type: "playbook_step",
      context: { playbook_run_id: run!.id, playbook_step_id: "s1" },
    };
    await Promise.all([
      handlePlaybookTaskTerminal(db, task, "completed", { output: "a" }),
      handlePlaybookTaskTerminal(db, task, "completed", { output: "b" }),
    ]);
    // Exactly one approval gate created despite two concurrent deliveries.
    expect(state.approvals).toHaveLength(1);
    expect(state.runs.get(run!.id)?.status).toBe("awaiting_approval");
  });

  it("duplicate approval decision callbacks advance only once", async () => {
    seedPlaybook([
      { id: "s1", kind: "approval", title: "Gate" },
      { id: "s2", kind: "agent", title: "After", prompt: "go" },
    ]);
    const run = await startPlaybookRun(db, {
      workspaceId: "w1",
      playbookId: "pb1",
      agentId: "ag1",
      startedByUserId: "u1",
    });
    const approval = { ...state.approvals[0], status: "approved" };
    await Promise.all([
      handlePlaybookApprovalDecided(db, approval),
      handlePlaybookApprovalDecided(db, approval),
    ]);
    expect(state.runs.get(run!.id)?.status).toBe("running");
    expect(state.enqueuedTasks).toHaveLength(1);
  });
});

describe("emailDomain propagation", () => {
  it("passes emailDomain to the TaskService used for advance dispatch", async () => {
    seedPlaybook([
      { id: "s1", kind: "agent", title: "One", prompt: "first" },
      { id: "s2", kind: "agent", title: "Two", prompt: "second" },
    ]);
    const run = await startPlaybookRun(db, {
      workspaceId: "w1",
      playbookId: "pb1",
      agentId: "ag1",
      startedByUserId: "u1",
      emailDomain: "start.dev",
    });
    state.taskServiceEmailDomains.length = 0;
    await handlePlaybookTaskTerminal(
      db,
      {
        id: "task_1",
        workspaceId: "w1",
        type: "playbook_step",
        context: { playbook_run_id: run!.id, playbook_step_id: "s1" },
      },
      "completed",
      { output: "one", emailDomain: "advance.dev" },
    );
    expect(state.taskServiceEmailDomains).toContain("advance.dev");
  });
});

describe("snapshot isolation and task context", () => {
  it("in-flight runs keep their snapshot after the playbook is edited", async () => {
    seedPlaybook([{ id: "s1", kind: "agent", title: "One", prompt: "original {{input.v}}" }]);
    const run = await startPlaybookRun(db, {
      workspaceId: "w1",
      playbookId: "pb1",
      agentId: "ag1",
      input: { v: "A" },
      startedByUserId: "u1",
    });
    // Edit the playbook definition after the run started.
    state.playbooks.get("pb1")!.definition = [
      { id: "s1", kind: "agent", title: "One", prompt: "edited {{input.v}}" },
    ];
    expect(state.enqueuedTasks[0].args[3]).toBe("original A");
    const stored = state.runs.get(run!.id)!;
    expect((stored.snapshot as any[])[0].prompt).toBe("original {{input.v}}");
  });

  it("rejects starting when the agent is outside the workspace", async () => {
    seedPlaybook([{ id: "s1", kind: "agent", title: "One", prompt: "p" }]);
    state.agent = null as any;
    await expect(
      startPlaybookRun(db, {
        workspaceId: "w1",
        playbookId: "pb1",
        agentId: "agX",
        startedByUserId: "u1",
      }),
    ).rejects.toThrow(PlaybookEngineError);
  });

  it("enqueues agent steps with run/step context and a deterministic idempotency id", async () => {
    seedPlaybook([{ id: "s1", kind: "agent", title: "One", prompt: "first" }]);
    const run = await startPlaybookRun(db, {
      workspaceId: "w1",
      playbookId: "pb1",
      agentId: "ag1",
      startedByUserId: "u1",
    });
    const opts = state.enqueuedTasks[0].args[5];
    expect(opts.context).toEqual({ playbook_run_id: run!.id, playbook_step_id: "s1" });
    expect(opts.idempotencyId).toBe(`pbrun_${run!.id}_s1`);
  });

  it("late completion delivery after a failed run is a no-op", async () => {
    seedPlaybook([{ id: "s1", kind: "agent", title: "One", prompt: "first" }]);
    const run = await startPlaybookRun(db, {
      workspaceId: "w1",
      playbookId: "pb1",
      agentId: "ag1",
      startedByUserId: "u1",
    });
    const task = {
      id: "task_1",
      workspaceId: "w1",
      type: "playbook_step",
      context: { playbook_run_id: run!.id, playbook_step_id: "s1" },
    };
    await handlePlaybookTaskTerminal(db, task, "failed", { error: "boom" });
    expect(state.runs.get(run!.id)?.status).toBe("failed");
    await handlePlaybookTaskTerminal(db, task, "completed", { output: "late" });
    expect(state.runs.get(run!.id)?.status).toBe("failed");
    expect(state.stepRuns.get(`${run!.id}:s1`)?.status).toBe("failed");
  });

  it("runs agent -> approval -> agent to completion and records the failed activity on failures", async () => {
    seedPlaybook([
      { id: "s1", kind: "agent", title: "One", prompt: "first" },
      { id: "s2", kind: "approval", title: "Gate" },
      { id: "s3", kind: "agent", title: "Three", prompt: "third after {{steps.s1.output}}" },
    ]);
    const run = await startPlaybookRun(db, {
      workspaceId: "w1",
      playbookId: "pb1",
      agentId: "ag1",
      startedByUserId: "u1",
    });
    await handlePlaybookTaskTerminal(
      db,
      {
        id: "task_1",
        workspaceId: "w1",
        type: "playbook_step",
        context: { playbook_run_id: run!.id, playbook_step_id: "s1" },
      },
      "completed",
      { output: "one" },
    );
    expect(state.runs.get(run!.id)?.status).toBe("awaiting_approval");
    await handlePlaybookApprovalDecided(db, { ...state.approvals[0], status: "approved" });
    expect(state.runs.get(run!.id)?.status).toBe("running");
    expect(state.enqueuedTasks[1].args[3]).toBe("third after one");
    await handlePlaybookTaskTerminal(
      db,
      {
        id: "task_2",
        workspaceId: "w1",
        type: "playbook_step",
        context: { playbook_run_id: run!.id, playbook_step_id: "s3" },
      },
      "completed",
      { output: "three" },
    );
    const final = state.runs.get(run!.id)!;
    expect(final.status).toBe("completed");
    expect(final.output).toEqual({ s1: "one", s2: "approved", s3: "three" });
    expect(
      state.activities.filter((a) => a.kind === "playbook_run_completed").length,
    ).toBe(1);

    // Failed-run activity event on a separate run.
    resetState();
    seedPlaybook([{ id: "s1", kind: "agent", title: "One", prompt: "first" }]);
    const run2 = await startPlaybookRun(db, {
      workspaceId: "w1",
      playbookId: "pb1",
      agentId: "ag1",
      startedByUserId: "u1",
    });
    await handlePlaybookTaskTerminal(
      db,
      {
        id: "task_1",
        workspaceId: "w1",
        type: "playbook_step",
        context: { playbook_run_id: run2!.id, playbook_step_id: "s1" },
      },
      "failed",
      { error: "boom" },
    );
    expect(state.activities.some((a) => a.kind === "playbook_run_failed")).toBe(true);
  });
});

describe("cancel racing the dispatch window (round-2 audit)", () => {
  it("keeps the run cancelled and supersedes the task when cancel lands mid-dispatch", async () => {
    seedPlaybook([
      { id: "s1", kind: "agent", title: "One", prompt: "first" },
      { id: "s2", kind: "agent", title: "Two", prompt: "second" },
    ]);
    const run = await startPlaybookRun(db, {
      workspaceId: "w1",
      playbookId: "pb1",
      agentId: "ag1",
      startedByUserId: "u1",
    });
    // While dispatching s2, a cancel commits between enqueue and run-CAS.
    mockEnqueueTask.mockImplementationOnce(async () => {
      await cancelPlaybookRun(db, "w1", run!.id);
      const task = { id: `task_${state.enqueuedTasks.length + 1}` };
      state.enqueuedTasks.push(task);
      return task;
    });
    await handlePlaybookTaskTerminal(
      db,
      {
        id: "task_1",
        workspaceId: "w1",
        type: "playbook_step",
        context: { playbook_run_id: run!.id, playbook_step_id: "s1" },
      },
      "completed",
      { output: "one" },
    );
    const final = state.runs.get(run!.id)!;
    expect(final.status).toBe("cancelled");
    expect(state.supersededTasks.length).toBeGreaterThan(0);
    expect(final.currentTaskId).toBeNull();
  });

  it("expires the orphan approval when cancel lands mid-dispatch of an approval step", async () => {
    seedPlaybook([
      { id: "s1", kind: "agent", title: "One", prompt: "first" },
      { id: "s2", kind: "approval", title: "Gate" },
    ]);
    const run = await startPlaybookRun(db, {
      workspaceId: "w1",
      playbookId: "pb1",
      agentId: "ag1",
      startedByUserId: "u1",
    });
    const originalApprovals = state.approvals.length;
    const s1 = state.stepRuns.get(`${run!.id}:s1`)!;
    s1.status = "completed";
    s1.output = "one";
    // Intercept: when the gate approval is created, cancel the run first.
    const { queries: q } = await import("@phneakngar/shared");
    const origCreate = q.approval.createApproval;
    (q.approval as any).createApproval = async (...args: unknown[]) => {
      const approval = await (origCreate as any)(...args);
      await cancelPlaybookRun(db, "w1", run!.id);
      return approval;
    };
    try {
      await advancePlaybookRun(db, "w1", run!.id);
    } finally {
      (q.approval as any).createApproval = origCreate;
    }
    expect(state.approvals.length).toBe(originalApprovals + 1);
    expect(state.expiredApprovals).toContain(state.approvals[originalApprovals]!.id);
    expect(state.runs.get(run!.id)!.status).toBe("cancelled");
    expect(state.runs.get(run!.id)!.currentApprovalId).toBeNull();
  });

  it("passes the starter user id to the agent access check", async () => {
    seedPlaybook([{ id: "s1", kind: "agent", title: "One", prompt: "first" }]);
    await startPlaybookRun(db, {
      workspaceId: "w1",
      playbookId: "pb1",
      agentId: "ag1",
      startedByUserId: "u1",
    });
    const lastCall = state.getAgentCalls[state.getAgentCalls.length - 1]!;
    expect(lastCall[1]).toBe("ag1");
    expect(lastCall[2]).toBe("w1");
    expect(lastCall[3]).toBe("u1");
  });

  it("caps stored step output length", async () => {
    seedPlaybook([{ id: "s1", kind: "agent", title: "One", prompt: "first" }]);
    const run = await startPlaybookRun(db, {
      workspaceId: "w1",
      playbookId: "pb1",
      agentId: "ag1",
      startedByUserId: "u1",
    });
    const huge = "x".repeat(250_000);
    await handlePlaybookTaskTerminal(
      db,
      {
        id: "task_1",
        workspaceId: "w1",
        type: "playbook_step",
        context: { playbook_run_id: run!.id, playbook_step_id: "s1" },
      },
      "completed",
      { output: huge },
    );
    expect(state.stepRuns.get(`${run!.id}:s1`)!.output!.length).toBe(100_000);
  });
});
