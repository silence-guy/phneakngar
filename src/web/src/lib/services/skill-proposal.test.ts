import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetTask = vi.fn();
const mockGetAgent = vi.fn();
const mockGetAgentRuntimeForWorkspace = vi.fn();
const mockFindPending = vi.fn();
const mockCreateApproval = vi.fn();

vi.mock("@phneakngar/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@phneakngar/shared")>();
  return {
    ...actual,
    queries: {
      task: {
        getTask: (...a: unknown[]) => mockGetTask(...a),
      },
      agent: {
        getAgent: (...a: unknown[]) => mockGetAgent(...a),
      },
      runtime: {
        getAgentRuntimeForWorkspace: (...a: unknown[]) =>
          mockGetAgentRuntimeForWorkspace(...a),
      },
      approval: {
        findPendingSkillInstall: (...a: unknown[]) => mockFindPending(...a),
        createApproval: (...a: unknown[]) => mockCreateApproval(...a),
      },
    },
  };
});

import { proposeSkillFromCompletedTask } from "./skill-proposal";

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAgentRuntimeForWorkspace.mockResolvedValue(null);
  mockFindPending.mockResolvedValue(null);
});

describe("proposeSkillFromCompletedTask", () => {
  it("proposes skill_install approval from a completed task", async () => {
    mockGetTask.mockResolvedValue({
      id: "task_1",
      agentId: "ag_1",
      workspaceId: "w1",
      status: "completed",
      prompt: "Deploy helper for staging",
      result: { summary: "Ran deploy successfully" },
      traceId: "trace_1",
    });
    mockGetAgent.mockResolvedValue({
      id: "ag_1",
      workspaceId: "w1",
      runtimeId: "rt_1",
    });
    mockGetAgentRuntimeForWorkspace.mockResolvedValue({
      id: "rt_1",
      provider: "claude",
    });
    mockCreateApproval.mockResolvedValue({
      id: "ap_1",
      kind: "skill_install",
      status: "pending",
      title: "deploy-helper-for-staging",
    });

    const result = await proposeSkillFromCompletedTask({} as any, {
      workspaceId: "w1",
      userId: "u1",
      task_id: "task_1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reused).toBe(false);
    expect(result.proposal.name).toBe("deploy-helper-for-staging");
    expect(result.proposal.source_trace_id).toBe("trace_1");
    expect(mockGetAgentRuntimeForWorkspace).toHaveBeenCalledWith(
      {},
      "rt_1",
      "w1",
    );
    expect(mockCreateApproval).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        workspaceId: "w1",
        agentId: "ag_1",
        kind: "skill_install",
        title: "deploy-helper-for-staging",
        payload: expect.objectContaining({
          name: "deploy-helper-for-staging",
          source_trace_id: "trace_1",
          runtime: "claude",
          agentId: "ag_1",
          taskId: "task_1",
        }),
      }),
    );
  });

  it("returns existing pending approval for same source_trace_id", async () => {
    mockGetTask.mockResolvedValue({
      id: "task_1",
      agentId: "ag_1",
      status: "completed",
      prompt: "Deploy helper",
      result: "ok",
      traceId: "trace_1",
    });
    mockGetAgent.mockResolvedValue({ id: "ag_1", runtimeId: null });
    mockFindPending.mockResolvedValue({
      id: "ap_existing",
      kind: "skill_install",
      status: "pending",
    });

    const result = await proposeSkillFromCompletedTask({} as any, {
      workspaceId: "w1",
      userId: "u1",
      task_id: "task_1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reused).toBe(true);
    expect(result.approval.id).toBe("ap_existing");
    expect(mockCreateApproval).not.toHaveBeenCalled();
  });

  it("returns 404 when task is outside workspace", async () => {
    mockGetTask.mockResolvedValue(null);
    const result = await proposeSkillFromCompletedTask({} as any, {
      workspaceId: "w1",
      userId: "u1",
      task_id: "missing",
    });
    expect(result).toEqual({
      ok: false,
      status: 404,
      error: "task not found",
    });
  });

  it("returns 422 when task is not completed", async () => {
    mockGetTask.mockResolvedValue({
      id: "task_1",
      agentId: "ag_1",
      status: "running",
      prompt: "Deploy",
    });
    const result = await proposeSkillFromCompletedTask({} as any, {
      workspaceId: "w1",
      userId: "u1",
      task_id: "task_1",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(422);
    expect(result.error).toMatch(/completed/i);
  });

  it("returns 404 when agent is not in workspace", async () => {
    mockGetTask.mockResolvedValue({
      id: "task_1",
      agentId: "ag_1",
      status: "completed",
      prompt: "Deploy helper",
      result: "ok",
    });
    mockGetAgent.mockResolvedValue(null);
    const result = await proposeSkillFromCompletedTask({} as any, {
      workspaceId: "w1",
      userId: "u1",
      task_id: "task_1",
    });
    expect(result).toEqual({
      ok: false,
      status: 404,
      error: "agent not found in workspace",
    });
  });

  it("uses explicit agent_id and runtime overrides", async () => {
    mockGetTask.mockResolvedValue({
      id: "task_1",
      agentId: "ag_task",
      status: "completed",
      prompt: "Review PR",
      result: "done",
      traceId: null,
    });
    mockGetAgent.mockResolvedValue({ id: "ag_override", runtimeId: "rt_x" });
    mockCreateApproval.mockResolvedValue({ id: "ap_1", status: "pending" });

    const result = await proposeSkillFromCompletedTask({} as any, {
      workspaceId: "w1",
      userId: "u1",
      task_id: "task_1",
      agent_id: "ag_override",
      runtime: "codex",
    });

    expect(result.ok).toBe(true);
    expect(mockGetAgent).toHaveBeenCalledWith({}, "ag_override", "w1", "u1");
    expect(mockCreateApproval).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        agentId: "ag_override",
        payload: expect.objectContaining({
          runtime: "codex",
          agentId: "ag_override",
          source_trace_id: "task_1",
        }),
      }),
    );
  });

  it("scopes task lookup by workspaceId first", async () => {
    mockGetTask.mockResolvedValue(null);
    await proposeSkillFromCompletedTask({} as any, {
      workspaceId: "ws_scope",
      userId: "u1",
      task_id: "task_x",
    });
    expect(mockGetTask).toHaveBeenCalledWith({}, "task_x", "ws_scope");
  });

  it("returns 422 when agent cannot be resolved", async () => {
    mockGetTask.mockResolvedValue({
      id: "task_1",
      agentId: null,
      status: "completed",
      prompt: "Something useful",
      result: "ok",
    });
    const result = await proposeSkillFromCompletedTask({} as any, {
      workspaceId: "w1",
      userId: "u1",
      task_id: "task_1",
    });
    expect(result).toEqual({
      ok: false,
      status: 422,
      error: "agent_id is required for skill install",
    });
    expect(mockCreateApproval).not.toHaveBeenCalled();
  });

  it("returns 422 when task metadata cannot form a proposal", async () => {
    mockGetTask.mockResolvedValue({
      id: "task_1",
      agentId: "ag_1",
      status: "completed",
      prompt: "   ",
      result: null,
      traceId: "trace_1",
    });
    mockGetAgent.mockResolvedValue({ id: "ag_1", runtimeId: null });
    const result = await proposeSkillFromCompletedTask({} as any, {
      workspaceId: "w1",
      userId: "u1",
      task_id: "task_1",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(422);
    expect(result.error).toMatch(/insufficient/i);
    expect(mockCreateApproval).not.toHaveBeenCalled();
  });

  it("defaults runtime to claude when agent runtime is unknown", async () => {
    mockGetTask.mockResolvedValue({
      id: "task_1",
      agentId: "ag_1",
      status: "completed",
      prompt: "Build weekly digest",
      result: "ok",
      traceId: "trace_9",
    });
    mockGetAgent.mockResolvedValue({ id: "ag_1", runtimeId: "rt_weird" });
    mockGetAgentRuntimeForWorkspace.mockResolvedValue({
      id: "rt_weird",
      provider: "mystery",
    });
    mockCreateApproval.mockResolvedValue({ id: "ap_1", status: "pending" });

    const result = await proposeSkillFromCompletedTask({} as any, {
      workspaceId: "w1",
      userId: "u1",
      task_id: "task_1",
    });

    expect(result.ok).toBe(true);
    expect(mockGetAgentRuntimeForWorkspace).toHaveBeenCalledWith(
      {},
      "rt_weird",
      "w1",
    );
    expect(mockCreateApproval).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        payload: expect.objectContaining({ runtime: "claude" }),
      }),
    );
  });

  it("defaults runtime when agent runtime is outside workspace", async () => {
    mockGetTask.mockResolvedValue({
      id: "task_1",
      agentId: "ag_1",
      status: "completed",
      prompt: "Build digest",
      result: "ok",
      traceId: "trace_out",
    });
    mockGetAgent.mockResolvedValue({ id: "ag_1", runtimeId: "rt_other_ws" });
    mockGetAgentRuntimeForWorkspace.mockResolvedValue(null);
    mockCreateApproval.mockResolvedValue({ id: "ap_1", status: "pending" });

    const result = await proposeSkillFromCompletedTask({} as any, {
      workspaceId: "w1",
      userId: "u1",
      task_id: "task_1",
    });

    expect(result.ok).toBe(true);
    expect(mockCreateApproval).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        payload: expect.objectContaining({ runtime: "claude" }),
      }),
    );
  });

  it("dedupes pending skill_install by source_trace_id before create", async () => {
    mockGetTask.mockResolvedValue({
      id: "task_1",
      agentId: "ag_1",
      status: "completed",
      prompt: "Deploy helper",
      result: "ok",
      traceId: "trace_dup",
    });
    mockGetAgent.mockResolvedValue({ id: "ag_1", runtimeId: null });
    mockFindPending.mockResolvedValue({
      id: "ap_pending",
      status: "pending",
      kind: "skill_install",
    });

    await proposeSkillFromCompletedTask({} as any, {
      workspaceId: "w1",
      userId: "u1",
      task_id: "task_1",
    });

    expect(mockFindPending).toHaveBeenCalledWith({}, "w1", "trace_dup");
    expect(mockCreateApproval).not.toHaveBeenCalled();
  });
});
