import { describe, it, expect, vi, beforeEach } from "vitest";

const mockListAutomations = vi.fn();
const mockCreateAutomation = vi.fn();
const mockListIssues = vi.fn();
const mockGetEmailsByAgent = vi.fn();
const mockEnsureDayPlanner = vi.fn();

vi.mock("@phneakngar/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@phneakngar/shared")>();
  return {
    ...actual,
    queries: {
      automation: {
        listAutomations: (...a: unknown[]) => mockListAutomations(...a),
        createAutomation: (...a: unknown[]) => mockCreateAutomation(...a),
      },
      issue: {
        listIssues: (...a: unknown[]) => mockListIssues(...a),
      },
      email: {
        getEmailsByAgent: (...a: unknown[]) => mockGetEmailsByAgent(...a),
      },
    },
  };
});

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/services/morning-brief", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/services/morning-brief")>();
  return {
    ...actual,
    ensureDayPlannerMorningBriefPath: (...a: unknown[]) =>
      mockEnsureDayPlanner(...a),
  };
});

import {
  SCENARIO_RUNTIME_IDS,
  buildInboxAiTaskContext,
  buildLightScenarioTaskContext,
  buildScenarioAutomationContext,
  buildScenarioDeliveryPrompt,
  buildTaskDigestTaskContext,
  detectScenarioRuntime,
  ensureDayPlannerCreateAll,
  ensureScenarioAutomation,
  ensureScenarioRuntimePath,
  formatBoardSnapshot,
  formatInboxSnapshot,
  getScenarioRuntimeSpec,
  isInboxAiAutomation,
  isScenarioRuntimeId,
  isTaskDigestAutomation,
  listScenarioRuntimeSpecs,
  loadBoardSnapshot,
  loadInboxSnapshot,
  toDigestIssueItems,
  toInboxDigestItems,
} from "./scenario-runtime";
import { HELIO_SCENARIO_TEMPLATE_IDS } from "@/lib/templates/types";

beforeEach(() => vi.clearAllMocks());

describe("scenario runtime registry", () => {
  it("aligns runtime ids with Helio template ids", () => {
    expect([...SCENARIO_RUNTIME_IDS]).toEqual([...HELIO_SCENARIO_TEMPLATE_IDS]);
    for (const id of SCENARIO_RUNTIME_IDS) {
      expect(isScenarioRuntimeId(id)).toBe(true);
      const spec = getScenarioRuntimeSpec(id);
      expect(spec.templateId).toBe(id);
      expect(spec.skillName).toBe(id);
      // minute hour day-of-month month day-of-week (day-of-week may be * or 1-5 / 1)
      expect(spec.defaultSchedule).toMatch(
        /^\d{1,2}\s+\d{1,2}\s+\*\s+\*\s+(\*|[0-7](-[0-7])?)$/,
      );
    }
    expect(listScenarioRuntimeSpecs()).toHaveLength(6);
    expect(getScenarioRuntimeSpec("research-brief").relatedTemplateId).toBe(
      "research-analyst",
    );
  });
});

describe("detectScenarioRuntime", () => {
  it("detects by skill name", () => {
    expect(
      detectScenarioRuntime({ title: "x", skillName: "task-digest" }),
    ).toBe("task-digest");
    expect(detectScenarioRuntime({ title: "x", skillName: "inbox-ai" })).toBe(
      "inbox-ai",
    );
    expect(
      detectScenarioRuntime({ title: "x", skillName: "day-planner" }),
    ).toBe("day-planner");
    expect(
      detectScenarioRuntime({ title: "x", skillName: "feedback-loop" }),
    ).toBe("feedback-loop");
    expect(
      detectScenarioRuntime({ title: "x", skillName: "content-pipeline" }),
    ).toBe("content-pipeline");
    expect(
      detectScenarioRuntime({ title: "x", skillName: "research-brief" }),
    ).toBe("research-brief");
  });

  it("prefers skill name over conflicting title hints", () => {
    expect(
      detectScenarioRuntime({
        title: "Task digest routine",
        skillName: "inbox-ai",
      }),
    ).toBe("inbox-ai");
  });

  it("detects morning brief / day planner hints", () => {
    expect(detectScenarioRuntime({ title: "Morning brief" })).toBe(
      "day-planner",
    );
    expect(
      detectScenarioRuntime({
        title: "Routine",
        sopMarkdown: "Post the morning brief",
      }),
    ).toBe("day-planner");
    expect(detectScenarioRuntime({ title: "អ្នករៀបចំថ្ងៃ" })).toBe(
      "day-planner",
    );
  });

  it("detects task digest and inbox ai by title/sop", () => {
    expect(detectScenarioRuntime({ title: "Task digest" })).toBe("task-digest");
    expect(isTaskDigestAutomation({ title: "Board digest" })).toBe(true);
    expect(detectScenarioRuntime({ title: "Inbox triage" })).toBe("inbox-ai");
    expect(isInboxAiAutomation({ title: "Email digest" })).toBe(true);
    expect(
      detectScenarioRuntime({
        title: "Nightly",
        sopMarkdown: "Run issue digest for the board",
      }),
    ).toBe("task-digest");
  });

  it("detects feedback-loop / content-pipeline / research-brief by title", () => {
    expect(detectScenarioRuntime({ title: "Feedback loop" })).toBe(
      "feedback-loop",
    );
    expect(detectScenarioRuntime({ title: "Content pipeline" })).toBe(
      "content-pipeline",
    );
    expect(detectScenarioRuntime({ title: "Research brief" })).toBe(
      "research-brief",
    );
    expect(detectScenarioRuntime({ title: "Product feedback themes" })).toBe(
      "feedback-loop",
    );
  });

  it("returns null for unrelated automations", () => {
    expect(detectScenarioRuntime({ title: "Weekly ops check" })).toBeNull();
    expect(isTaskDigestAutomation({ title: "Weekly ops check" })).toBe(false);
    expect(isScenarioRuntimeId("not-a-scenario")).toBe(false);
  });
});

describe("board snapshot pure helpers", () => {
  it("computes aging and formats sections", () => {
    const items = toDigestIssueItems(
      [
        {
          id: "i1",
          title: "Ship release",
          status: "blocked",
          claimedByAgentId: "a1",
          updatedAt: "2026-07-10T00:00:00.000Z",
        },
        {
          id: "i2",
          title: "Docs",
          status: "in_progress",
          claimedByAgentId: null,
          updatedAt: "2026-07-16T06:00:00.000Z",
        },
        {
          id: "i3",
          title: "  ",
          status: "todo",
          claimedByAgentId: null,
          updatedAt: "not-a-date",
        },
        {
          id: "i4",
          title: "Old review",
          status: "review",
          claimedByAgentId: "a2",
          updatedAt: "2026-07-01T00:00:00.000Z",
        },
      ],
      { nowIso: "2026-07-16T12:00:00.000Z", agingThresholdHours: 72 },
    );
    expect(items[0]!.is_aging).toBe(true);
    expect(items[0]!.aging_hours).toBeGreaterThanOrEqual(72);
    expect(items[1]!.is_aging).toBe(false);
    expect(items[2]!.title).toBe("(untitled)");
    expect(items[2]!.aging_hours).toBe(0);
    expect(items[2]!.is_aging).toBe(false);

    const board = formatBoardSnapshot(items, {
      nowIso: "2026-07-16T12:00:00.000Z",
      agingThresholdHours: 72,
    });
    expect(board.counts.blocked).toBe(1);
    expect(board.counts.todo).toBe(1);
    expect(board.summary).toContain("Blocked");
    expect(board.summary).toContain("Ship release");
    expect(board.summary).toContain("In motion");
    expect(board.summary).toContain("Aging");
    expect(board.summary).toContain("Old review");
    expect(board.summary).toContain("Todo");
    // Blocked aging items appear under Blocked, not double-listed as Aging.
    expect(board.summary).not.toMatch(/Aging[\s\S]*Ship release/);
  });

  it("empty board summary", () => {
    const board = formatBoardSnapshot([]);
    expect(board.items).toEqual([]);
    expect(board.summary).toMatch(/No active issues/i);
    expect(board.summary).toMatch(/workspace-scoped/i);
  });

  it("buildTaskDigestTaskContext tags scenario and nests board_snapshot", () => {
    const board = formatBoardSnapshot([]);
    const ctx = buildTaskDigestTaskContext({
      automationId: "au1",
      schedule: "0 17 * * *",
      deliveryMode: "channel",
      deliveryChannelId: "ch1",
      deliveryChannelName: "ops",
      skillName: "task-digest",
      observedNextRunAt: "2026-07-16T17:00:00.000Z",
      board,
    });
    expect(ctx.scenario).toBe("task-digest");
    expect(ctx.task_digest).toBe(true);
    expect(ctx.delivery_channel_name).toBe("ops");
    expect(ctx.deliver_to_channel).toBe(true);
    expect(ctx.board_snapshot).toMatchObject({
      generated_at: board.generated_at,
      items: [],
      summary: board.summary,
    });
  });
});

describe("inbox snapshot pure helpers", () => {
  it("flags pending approval and formats", () => {
    const items = toInboxDigestItems([
      {
        id: "e1",
        direction: "outbound",
        status: "pending_approval",
        fromEmail: "agent@x.com",
        toEmail: "client@x.com",
        subject: "Proposal",
        createdAt: "2026-07-16T10:00:00.000Z",
      },
      {
        id: "e2",
        direction: "inbound",
        status: "unread",
        fromEmail: "client@x.com",
        toEmail: "agent@x.com",
        subject: "Re: Proposal",
        createdAt: "2026-07-16T11:00:00.000Z",
      },
      {
        id: "e3",
        direction: "outbound",
        status: "sent",
        fromEmail: "agent@x.com",
        toEmail: "other@x.com",
        subject: null,
        createdAt: "2026-07-16T09:00:00.000Z",
      },
      {
        id: "e4",
        direction: "inbound",
        status: "pending_approval",
        fromEmail: "weird@x.com",
        toEmail: "agent@x.com",
        subject: "Odd dual tag",
        createdAt: "2026-07-16T08:00:00.000Z",
      },
    ]);
    expect(items[0]!.needs_approval).toBe(true);
    expect(items[1]!.is_inbound).toBe(true);
    expect(items[2]!.subject).toBe("(no subject)");
    expect(items[3]!.needs_approval).toBe(true);
    expect(items[3]!.is_inbound).toBe(true);

    const snap = formatInboxSnapshot(items, {
      nowIso: "2026-07-16T12:00:00.000Z",
    });
    expect(snap.counts.total).toBe(4);
    expect(snap.counts.pending_approval).toBe(2);
    expect(snap.counts.inbound).toBe(2);
    // other must not go negative when a row is both inbound + pending.
    expect(snap.counts.other).toBe(1);
    expect(snap.summary).toContain("Awaiting approval");
    expect(snap.summary).toContain("Proposal");
    expect(snap.summary).toContain("Inbound");
  });

  it("empty inbox summary", () => {
    const snap = formatInboxSnapshot([]);
    expect(snap.items).toEqual([]);
    expect(snap.summary).toMatch(/No recent emails/i);
    expect(snap.summary).toMatch(/workspace-scoped/i);
  });

  it("buildInboxAiTaskContext tags scenario and nests inbox_snapshot", () => {
    const inbox = formatInboxSnapshot([]);
    const ctx = buildInboxAiTaskContext({
      automationId: "au1",
      schedule: "0 16 * * *",
      deliveryMode: "channel",
      deliveryChannelId: "ch1",
      deliveryChannelName: "inbox",
      skillName: "inbox-ai",
      observedNextRunAt: "2026-07-16T16:00:00.000Z",
      inbox,
    });
    expect(ctx.scenario).toBe("inbox-ai");
    expect(ctx.inbox_ai).toBe(true);
    expect(ctx.deliver_to_channel).toBe(true);
    expect(ctx.inbox_snapshot).toMatchObject({
      generated_at: inbox.generated_at,
      counts: inbox.counts,
      summary: inbox.summary,
    });
  });
});

describe("buildScenarioDeliveryPrompt", () => {
  it("includes channel delivery instruction", () => {
    const prompt = buildScenarioDeliveryPrompt("Task digest", {
      snapshotSummary: "Board snapshot...",
      deliveryMode: "channel",
      deliveryChannelName: "ops",
      scenarioLabel: "task-digest",
    });
    expect(prompt).toContain("Task digest");
    expect(prompt).toContain("Board snapshot");
    expect(prompt).toContain('channel "ops"');
    expect(prompt).toContain("task-digest");
  });

  it("includes DM delivery instruction", () => {
    const prompt = buildScenarioDeliveryPrompt("Inbox digest", {
      deliveryMode: "dm",
      scenarioLabel: "inbox-ai",
    });
    expect(prompt).toContain("direct message");
    expect(prompt).toContain("inbox-ai");
  });

  it("includes generic delivery mode when not channel/dm", () => {
    const prompt = buildScenarioDeliveryPrompt("Digest", {
      deliveryMode: "none",
      deliveryChannelName: "unused",
    });
    expect(prompt).toContain("Delivery mode: none");
    expect(prompt).toContain("channel: unused");
  });
});

describe("loadBoardSnapshot / loadInboxSnapshot", () => {
  it("loads issues workspace-scoped with owner first", async () => {
    mockListIssues.mockResolvedValue([
      {
        id: "i1",
        title: "Blocked item",
        status: "blocked",
        claimedByAgentId: null,
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    ]);
    const board = await loadBoardSnapshot({} as any, "w1", {
      ownerUserId: "u1",
      nowIso: "2026-07-16T12:00:00.000Z",
    });
    expect(mockListIssues).toHaveBeenCalledWith(
      {},
      "w1",
      expect.objectContaining({ userId: "u1", terminal: false }),
    );
    expect(board.items).toHaveLength(1);
    expect(board.summary).toContain("Blocked");
  });

  it("loads agent emails workspace-scoped", async () => {
    mockGetEmailsByAgent.mockResolvedValue([
      {
        id: "e1",
        direction: "inbound",
        status: "unread",
        fromEmail: "a@x.com",
        toEmail: "b@x.com",
        subject: "Hi",
        createdAt: "2026-07-16T10:00:00.000Z",
      },
    ]);
    const inbox = await loadInboxSnapshot({} as any, "w1", "a1", {
      nowIso: "2026-07-16T12:00:00.000Z",
      limit: 20,
    });
    expect(mockGetEmailsByAgent).toHaveBeenCalledWith(
      {},
      "a1",
      "w1",
      undefined,
      { limit: 20, offset: 0 },
    );
    expect(inbox.counts.inbound).toBe(1);
  });
});

describe("ensureScenarioAutomation / ensureScenarioRuntimePath", () => {
  it("delegates day-planner to morning-brief path", async () => {
    mockEnsureDayPlanner.mockResolvedValue({
      automation: { id: "au_dp" },
      automationCreated: true,
      calendarEvent: { id: "ce1" },
      calendarCreated: true,
    });
    const path = await ensureScenarioRuntimePath({} as any, {
      workspaceId: "w1",
      agentId: "a1",
      scenarioId: "day-planner",
      deliveryChannelId: "ch1",
    });
    expect(path.scenarioId).toBe("day-planner");
    expect(path.automationCreated).toBe(true);
    expect(path.calendarCreated).toBe(true);
    expect(mockEnsureDayPlanner).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        workspaceId: "w1",
        agentId: "a1",
        deliveryChannelId: "ch1",
      }),
    );

    // ensureScenarioAutomation also delegates day-planner (no createAutomation).
    const auto = await ensureScenarioAutomation({} as any, {
      workspaceId: "w1",
      agentId: "a1",
      scenarioId: "day-planner",
    });
    expect(auto.created).toBe(true);
    expect(auto.automation).toEqual({ id: "au_dp" });
    expect(mockCreateAutomation).not.toHaveBeenCalled();
  });

  it("ensureDayPlannerCreateAll wires automation + calendar and is idempotent", async () => {
    mockEnsureDayPlanner
      .mockResolvedValueOnce({
        automation: { id: "au_dp" },
        automationCreated: true,
        calendarEvent: { id: "ce1" },
        calendarCreated: true,
      })
      .mockResolvedValueOnce({
        automation: { id: "au_dp" },
        automationCreated: false,
        calendarEvent: { id: "ce1" },
        calendarCreated: false,
      });

    const first = await ensureDayPlannerCreateAll({} as any, {
      workspaceId: "w1",
      agentId: "a1",
      deliveryChannelId: "ch1",
      nowIso: "2026-07-16T07:00:00.000Z",
    });
    expect(first.anyCreated).toBe(true);
    expect(first.automationCreated).toBe(true);
    expect(first.calendarCreated).toBe(true);
    expect(first.automation.id).toBe("au_dp");
    expect(first.calendarEvent?.id).toBe("ce1");

    const second = await ensureDayPlannerCreateAll({} as any, {
      workspaceId: "w1",
      agentId: "a1",
      deliveryChannelId: "ch1",
    });
    expect(second.anyCreated).toBe(false);
    expect(second.automationCreated).toBe(false);
    expect(second.calendarCreated).toBe(false);
    expect(mockEnsureDayPlanner).toHaveBeenCalledTimes(2);
  });

  it("creates task-digest automation when absent", async () => {
    mockListAutomations.mockResolvedValue([]);
    mockCreateAutomation.mockResolvedValue({
      id: "au_td",
      title: "Task digest",
      skillName: "task-digest",
    });
    const result = await ensureScenarioAutomation({} as any, {
      workspaceId: "w1",
      agentId: "a1",
      scenarioId: "task-digest",
      deliveryChannelId: "ch1",
      nowIso: "2026-07-16T18:00:00.000Z",
    });
    expect(result.created).toBe(true);
    expect(mockListAutomations).toHaveBeenCalledWith(
      {},
      "w1",
      expect.objectContaining({ agentId: "a1" }),
    );
    expect(mockCreateAutomation).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        workspaceId: "w1",
        agentId: "a1",
        title: "Task digest",
        skillName: "task-digest",
        deliveryMode: "channel",
        deliveryChannelId: "ch1",
        schedule: "0 17 * * *",
        nextRunAt: "2026-07-17T17:00:00.000Z",
        enabled: true,
      }),
    );
  });

  it("creates inbox-ai automation with default schedule when absent", async () => {
    mockListAutomations.mockResolvedValue([]);
    mockCreateAutomation.mockResolvedValue({
      id: "au_ia",
      title: "Inbox digest",
      skillName: "inbox-ai",
    });
    const result = await ensureScenarioAutomation({} as any, {
      workspaceId: "w1",
      agentId: "a1",
      scenarioId: "inbox-ai",
      deliveryChannelId: "ch1",
      nowIso: "2026-07-16T10:00:00.000Z",
    });
    expect(result.created).toBe(true);
    expect(mockCreateAutomation).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        workspaceId: "w1",
        agentId: "a1",
        title: "Inbox digest",
        skillName: "inbox-ai",
        schedule: "0 16 * * *",
        nextRunAt: "2026-07-16T16:00:00.000Z",
        deliveryMode: "channel",
      }),
    );
  });

  it("returns existing inbox-ai automation without creating", async () => {
    mockListAutomations.mockResolvedValue([
      { id: "au_existing", title: "Inbox digest", skillName: "inbox-ai" },
    ]);
    const result = await ensureScenarioAutomation({} as any, {
      workspaceId: "w1",
      agentId: "a1",
      scenarioId: "inbox-ai",
    });
    expect(result.created).toBe(false);
    expect(result.automation.id).toBe("au_existing");
    expect(mockCreateAutomation).not.toHaveBeenCalled();
  });

  it("is idempotent for task-digest when title-detected existing exists", async () => {
    mockListAutomations.mockResolvedValue([
      {
        id: "au_td_title",
        title: "Board digest",
        skillName: null,
        sopMarkdown: null,
      },
    ]);
    const result = await ensureScenarioAutomation({} as any, {
      workspaceId: "w1",
      agentId: "a1",
      scenarioId: "task-digest",
    });
    expect(result.created).toBe(false);
    expect(result.automation.id).toBe("au_td_title");
    expect(mockCreateAutomation).not.toHaveBeenCalled();
  });

  it("ensureScenarioRuntimePath for task-digest has no calendar cue", async () => {
    mockListAutomations.mockResolvedValue([]);
    mockCreateAutomation.mockResolvedValue({ id: "au_td" });
    const result = await ensureScenarioRuntimePath({} as any, {
      workspaceId: "w1",
      agentId: "a1",
      scenarioId: "task-digest",
      deliveryChannelId: "ch1",
      nowIso: "2026-07-16T12:00:00.000Z",
    });
    expect(result.scenarioId).toBe("task-digest");
    expect(result.automationCreated).toBe(true);
    expect(result.calendarEvent).toBeNull();
    expect(result.calendarCreated).toBe(false);
  });

  it("creates feedback-loop automation with weekday schedule", async () => {
    mockListAutomations.mockResolvedValue([]);
    mockCreateAutomation.mockResolvedValue({ id: "au_fl" });
    const result = await ensureScenarioAutomation({} as any, {
      workspaceId: "w1",
      agentId: "a1",
      scenarioId: "feedback-loop",
      deliveryChannelId: "ch1",
      nowIso: "2026-07-16T12:00:00.000Z",
    });
    expect(result.created).toBe(true);
    expect(mockCreateAutomation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        skillName: "feedback-loop",
        schedule: "0 15 * * 1-5",
        deliveryMode: "channel",
      }),
    );
  });

  it("is idempotent for content-pipeline when skill exists", async () => {
    mockListAutomations.mockResolvedValue([
      { id: "au_cp", title: "Content pipeline", skillName: "content-pipeline" },
    ]);
    const result = await ensureScenarioAutomation({} as any, {
      workspaceId: "w1",
      agentId: "a1",
      scenarioId: "content-pipeline",
    });
    expect(result.created).toBe(false);
    expect(result.automation.id).toBe("au_cp");
    expect(mockCreateAutomation).not.toHaveBeenCalled();
  });

  it("ensureScenarioRuntimePath for research-brief has no calendar cue", async () => {
    mockListAutomations.mockResolvedValue([]);
    mockCreateAutomation.mockResolvedValue({ id: "au_rb" });
    const result = await ensureScenarioRuntimePath({} as any, {
      workspaceId: "w1",
      agentId: "a1",
      scenarioId: "research-brief",
      deliveryChannelId: "ch1",
      nowIso: "2026-07-16T12:00:00.000Z",
    });
    expect(result.scenarioId).toBe("research-brief");
    expect(result.automationCreated).toBe(true);
    expect(result.calendarEvent).toBeNull();
    expect(result.calendarCreated).toBe(false);
    expect(mockCreateAutomation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        skillName: "research-brief",
        schedule: "0 10 * * 1",
      }),
    );
  });

  it("ensureScenarioRuntimePath for inbox-ai has no calendar cue", async () => {
    mockListAutomations.mockResolvedValue([]);
    mockCreateAutomation.mockResolvedValue({ id: "au_ia" });
    const result = await ensureScenarioRuntimePath({} as any, {
      workspaceId: "w1",
      agentId: "a1",
      scenarioId: "inbox-ai",
      nowIso: "2026-07-16T12:00:00.000Z",
    });
    expect(result.scenarioId).toBe("inbox-ai");
    expect(result.automationCreated).toBe(true);
    expect(result.calendarEvent).toBeNull();
    expect(result.calendarCreated).toBe(false);
  });
});

describe("buildScenarioAutomationContext", () => {
  it("returns null for day-planner (owned by morning-brief path)", async () => {
    const result = await buildScenarioAutomationContext(
      {} as any,
      "w1",
      {
        id: "au1",
        agentId: "a1",
        title: "Morning brief",
        sopMarkdown: "",
        skillName: "day-planner",
        schedule: "0 8 * * *",
        nextRunAt: "2026-07-16T08:00:00.000Z",
        deliveryMode: "channel",
        deliveryChannelId: "ch1",
      },
      {
        nowIso: "2026-07-16T08:05:00.000Z",
        deliveryChannelName: "general",
        ownerUserId: "u1",
      },
    );
    expect(result).toBeNull();
  });

  it("returns null for non-scenario automations", async () => {
    const result = await buildScenarioAutomationContext(
      {} as any,
      "w1",
      {
        id: "au1",
        agentId: "a1",
        title: "Weekly ops check",
        sopMarkdown: "Ping ops",
        skillName: null,
        schedule: "0 9 * * 1",
        nextRunAt: "2026-07-20T09:00:00.000Z",
        deliveryMode: "channel",
        deliveryChannelId: "ch1",
      },
      {
        nowIso: "2026-07-20T09:05:00.000Z",
        deliveryChannelName: "ops",
        ownerUserId: "u1",
      },
    );
    expect(result).toBeNull();
  });

  it("attaches board snapshot for task-digest", async () => {
    mockListIssues.mockResolvedValue([
      {
        id: "i1",
        title: "Stuck",
        status: "blocked",
        claimedByAgentId: "a1",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    ]);
    const result = await buildScenarioAutomationContext(
      {} as any,
      "w1",
      {
        id: "au1",
        agentId: "a1",
        title: "Task digest",
        sopMarkdown: "Scan board",
        skillName: "task-digest",
        schedule: "0 17 * * *",
        nextRunAt: "2026-07-16T17:00:00.000Z",
        deliveryMode: "channel",
        deliveryChannelId: "ch1",
      },
      {
        nowIso: "2026-07-16T17:05:00.000Z",
        deliveryChannelName: "ops",
        ownerUserId: "u1",
      },
    );
    expect(result?.scenarioId).toBe("task-digest");
    expect(result?.prompt).toContain("Stuck");
    expect(result?.prompt).toContain('channel "ops"');
    expect(result?.context).toMatchObject({
      scenario: "task-digest",
      task_digest: true,
      delivery_channel_name: "ops",
    });
    expect(result?.context.board_snapshot).toMatchObject({
      counts: expect.objectContaining({ blocked: 1 }),
    });
    expect(mockListIssues).toHaveBeenCalledWith(
      {},
      "w1",
      expect.objectContaining({ userId: "u1", terminal: false }),
    );
  });

  it("uses empty board when task-digest owner is missing", async () => {
    const result = await buildScenarioAutomationContext(
      {} as any,
      "w1",
      {
        id: "au1",
        agentId: "a1",
        title: "Task digest",
        sopMarkdown: "Scan board",
        skillName: "task-digest",
        schedule: "0 17 * * *",
        nextRunAt: "2026-07-16T17:00:00.000Z",
        deliveryMode: "channel",
        deliveryChannelId: "ch1",
      },
      {
        nowIso: "2026-07-16T17:05:00.000Z",
        deliveryChannelName: "ops",
        ownerUserId: null,
      },
    );
    expect(result?.scenarioId).toBe("task-digest");
    expect(mockListIssues).not.toHaveBeenCalled();
    expect(result?.prompt).toMatch(/No active issues/i);
    expect(result?.context).toMatchObject({
      task_digest: true,
      board_snapshot: expect.objectContaining({ items: [] }),
    });
  });

  it("degrades to empty board when issue load fails", async () => {
    mockListIssues.mockRejectedValue(new Error("d1 timeout"));
    const result = await buildScenarioAutomationContext(
      {} as any,
      "w1",
      {
        id: "au1",
        agentId: "a1",
        title: "Task digest",
        sopMarkdown: "Scan board",
        skillName: "task-digest",
        schedule: "0 17 * * *",
        nextRunAt: "2026-07-16T17:00:00.000Z",
        deliveryMode: "channel",
        deliveryChannelId: "ch1",
      },
      {
        nowIso: "2026-07-16T17:05:00.000Z",
        deliveryChannelName: "ops",
        ownerUserId: "u1",
      },
    );
    expect(result?.scenarioId).toBe("task-digest");
    expect(result?.prompt).toMatch(/No active issues/i);
    expect(result?.context).toMatchObject({
      task_digest: true,
      board_snapshot: expect.objectContaining({ items: [] }),
    });
  });

  it("attaches inbox snapshot for inbox-ai", async () => {
    mockGetEmailsByAgent.mockResolvedValue([
      {
        id: "e1",
        direction: "inbound",
        status: "unread",
        fromEmail: "c@x.com",
        toEmail: "a@x.com",
        subject: "Need reply",
        createdAt: "2026-07-16T10:00:00.000Z",
      },
    ]);
    const result = await buildScenarioAutomationContext(
      {} as any,
      "w1",
      {
        id: "au1",
        agentId: "a1",
        title: "Inbox digest",
        sopMarkdown: "Triage",
        skillName: "inbox-ai",
        schedule: "0 16 * * *",
        nextRunAt: "2026-07-16T16:00:00.000Z",
        deliveryMode: "channel",
        deliveryChannelId: "ch1",
      },
      {
        nowIso: "2026-07-16T16:05:00.000Z",
        deliveryChannelName: "inbox",
        ownerUserId: "u1",
      },
    );
    expect(result?.scenarioId).toBe("inbox-ai");
    expect(result?.prompt).toContain("Need reply");
    expect(result?.prompt).toContain('channel "inbox"');
    expect(result?.context).toMatchObject({
      scenario: "inbox-ai",
      inbox_ai: true,
    });
    expect(result?.context.inbox_snapshot).toMatchObject({
      counts: expect.objectContaining({ inbound: 1 }),
    });
    expect(mockGetEmailsByAgent).toHaveBeenCalledWith(
      {},
      "a1",
      "w1",
      undefined,
      expect.objectContaining({ limit: 40, offset: 0 }),
    );
  });

  it("degrades to empty inbox when email load fails", async () => {
    mockGetEmailsByAgent.mockRejectedValue(new Error("d1 unavailable"));
    const result = await buildScenarioAutomationContext(
      {} as any,
      "w1",
      {
        id: "au1",
        agentId: "a1",
        title: "Inbox digest",
        sopMarkdown: "Triage",
        skillName: "inbox-ai",
        schedule: "0 16 * * *",
        nextRunAt: "2026-07-16T16:00:00.000Z",
        deliveryMode: "channel",
        deliveryChannelId: "ch1",
      },
      {
        nowIso: "2026-07-16T16:05:00.000Z",
        deliveryChannelName: "inbox",
        ownerUserId: "u1",
      },
    );
    expect(result?.scenarioId).toBe("inbox-ai");
    expect(result?.prompt).toMatch(/No recent emails/i);
    expect(result?.context).toMatchObject({
      inbox_ai: true,
      inbox_snapshot: expect.objectContaining({ items: [] }),
    });
  });

  it("buildLightScenarioTaskContext tags scenario flags and optional board", () => {
    const board = formatBoardSnapshot([]);
    const withBoard = buildLightScenarioTaskContext({
      automationId: "au1",
      schedule: "0 15 * * 1-5",
      deliveryMode: "channel",
      deliveryChannelId: "ch1",
      deliveryChannelName: "product",
      skillName: "feedback-loop",
      observedNextRunAt: "2026-07-16T15:00:00.000Z",
      scenarioId: "feedback-loop",
      board,
    });
    expect(withBoard).toMatchObject({
      scenario: "feedback-loop",
      feedback_loop: true,
      deliver_to_channel: true,
      board_snapshot: expect.objectContaining({ summary: board.summary }),
    });
    expect(withBoard.inbox_ai).toBeUndefined();

    const research = buildLightScenarioTaskContext({
      automationId: "au2",
      schedule: "0 10 * * 1",
      deliveryMode: "channel",
      deliveryChannelId: "ch1",
      deliveryChannelName: "research",
      skillName: "research-brief",
      observedNextRunAt: "2026-07-20T10:00:00.000Z",
      scenarioId: "research-brief",
      board: null,
    });
    expect(research).toMatchObject({
      scenario: "research-brief",
      research_brief: true,
      board_snapshot: null,
    });
    expect(research.inbox_ai).toBeUndefined();
    expect(research.task_digest).toBeUndefined();
  });

  it("attaches thin board snapshot for feedback-loop (not inbox)", async () => {
    mockListIssues.mockResolvedValue([
      {
        id: "i1",
        title: "Users hate onboarding",
        status: "todo",
        claimedByAgentId: null,
        updatedAt: "2026-07-15T00:00:00.000Z",
      },
    ]);
    const result = await buildScenarioAutomationContext(
      {} as any,
      "w1",
      {
        id: "au1",
        agentId: "a1",
        title: "Feedback loop",
        sopMarkdown: "Cluster themes",
        skillName: "feedback-loop",
        schedule: "0 15 * * 1-5",
        nextRunAt: "2026-07-16T15:00:00.000Z",
        deliveryMode: "channel",
        deliveryChannelId: "ch1",
      },
      {
        nowIso: "2026-07-16T15:05:00.000Z",
        deliveryChannelName: "product",
        ownerUserId: "u1",
      },
    );
    expect(result?.scenarioId).toBe("feedback-loop");
    expect(result?.prompt).toContain("feedback-loop");
    expect(result?.prompt).toMatch(/Todo|Board snapshot/i);
    expect(result?.context).toMatchObject({
      scenario: "feedback-loop",
      feedback_loop: true,
      deliver_to_channel: true,
    });
    expect(result?.context.inbox_ai).toBeUndefined();
    expect(result?.context.inbox_snapshot).toBeUndefined();
    expect(result?.context.board_snapshot).toMatchObject({
      counts: expect.objectContaining({ todo: 1 }),
      items: expect.arrayContaining([
        expect.objectContaining({ title: "Users hate onboarding" }),
      ]),
    });
    expect(mockGetEmailsByAgent).not.toHaveBeenCalled();
  });

  it("attaches thin board snapshot for content-pipeline", async () => {
    mockListIssues.mockResolvedValue([
      {
        id: "i2",
        title: "Draft: launch post",
        status: "review",
        claimedByAgentId: "a1",
        updatedAt: "2026-07-14T00:00:00.000Z",
      },
    ]);
    const result = await buildScenarioAutomationContext(
      {} as any,
      "w1",
      {
        id: "au1",
        agentId: "a1",
        title: "Content pipeline",
        sopMarkdown: "Advance editorial",
        skillName: "content-pipeline",
        schedule: "0 14 * * 1-5",
        nextRunAt: "2026-07-16T14:00:00.000Z",
        deliveryMode: "channel",
        deliveryChannelId: "ch1",
      },
      {
        nowIso: "2026-07-16T14:05:00.000Z",
        deliveryChannelName: "editorial",
        ownerUserId: "u1",
      },
    );
    expect(result?.scenarioId).toBe("content-pipeline");
    expect(result?.context).toMatchObject({
      scenario: "content-pipeline",
      content_pipeline: true,
    });
    expect(result?.context.inbox_ai).toBeUndefined();
    expect(result?.context.board_snapshot).toMatchObject({
      counts: expect.objectContaining({ review: 1 }),
    });
  });

  it("research-brief context has null board_snapshot (documented)", async () => {
    const result = await buildScenarioAutomationContext(
      {} as any,
      "w1",
      {
        id: "au1",
        agentId: "a1",
        title: "Research brief",
        sopMarkdown: "Produce brief",
        skillName: "research-brief",
        schedule: "0 10 * * 1",
        nextRunAt: "2026-07-20T10:00:00.000Z",
        deliveryMode: "channel",
        deliveryChannelId: "ch1",
      },
      {
        nowIso: "2026-07-20T10:05:00.000Z",
        deliveryChannelName: "research",
        ownerUserId: "u1",
      },
    );
    expect(result?.scenarioId).toBe("research-brief");
    expect(result?.prompt).toContain("research-brief");
    expect(result?.context).toMatchObject({
      scenario: "research-brief",
      research_brief: true,
      deliver_to_channel: true,
      board_snapshot: null,
    });
    expect(result?.context.inbox_ai).toBeUndefined();
    expect(mockListIssues).not.toHaveBeenCalled();
    expect(mockGetEmailsByAgent).not.toHaveBeenCalled();
  });
});
