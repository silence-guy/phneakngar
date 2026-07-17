import { describe, it, expect, vi, beforeEach } from "vitest";

const mockListDue = vi.fn();
const mockClaim = vi.fn();
const mockRevert = vi.fn();
const mockGetAgent = vi.fn();
const mockCreateConversation = vi.fn();
const mockCreateMessage = vi.fn();
const mockEnqueueTask = vi.fn();
const mockGetChannel = vi.fn();
const mockListCalendar = vi.fn();
const mockListIssues = vi.fn();
const mockGetEmailsByAgent = vi.fn();
const mockCreateActivity = vi.fn();

vi.mock("@phneakngar/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@phneakngar/shared")>();
  return {
    ...actual,
    queries: {
      automation: {
        listDueAutomations: (...a: unknown[]) => mockListDue(...a),
        claimAutomationRun: (...a: unknown[]) => mockClaim(...a),
        revertAutomationRunClaim: (...a: unknown[]) => mockRevert(...a),
      },
      agent: {
        getAgent: (...a: unknown[]) => mockGetAgent(...a),
      },
      conversation: {
        createConversation: (...a: unknown[]) => mockCreateConversation(...a),
      },
      message: {
        createMessage: (...a: unknown[]) => mockCreateMessage(...a),
      },
      channel: {
        getChannelById: (...a: unknown[]) => mockGetChannel(...a),
      },
      calendarEvent: {
        listCalendarEvents: (...a: unknown[]) => mockListCalendar(...a),
      },
      issue: {
        listIssues: (...a: unknown[]) => mockListIssues(...a),
      },
      email: {
        getEmailsByAgent: (...a: unknown[]) => mockGetEmailsByAgent(...a),
      },
      activityEvent: {
        createActivityEvent: (...a: unknown[]) => mockCreateActivity(...a),
      },
    },
  };
});

vi.mock("@/lib/services/task", () => ({
  TaskService: function () {
    return { enqueueTask: mockEnqueueTask };
  },
}));

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import {
  buildAutomationDeliveryContext,
  computeNextAutomationRunAt,
  promoteDueAutomationsForWorkspace,
} from "./automation";

beforeEach(() => vi.clearAllMocks());

describe("computeNextAutomationRunAt", () => {
  it("advances daily alias past now", () => {
    const next = computeNextAutomationRunAt(
      "daily",
      "2026-07-16T08:00:00.000Z",
      "2026-07-16T09:00:00.000Z",
    );
    expect(next).toBe("2026-07-17T08:00:00.000Z");
  });

  it("parses simple UTC cron", () => {
    const next = computeNextAutomationRunAt(
      "0 8 * * *",
      "2026-07-16T08:00:00.000Z",
      "2026-07-16T09:00:00.000Z",
    );
    expect(next).toBe("2026-07-17T08:00:00.000Z");
  });

  it("falls back to +24h for unknown schedules", () => {
    const next = computeNextAutomationRunAt(
      "every tuesday after coffee",
      "2026-07-16T08:00:00.000Z",
      "2026-07-16T09:00:00.000Z",
    );
    expect(next).toBe("2026-07-17T09:00:00.000Z");
  });
});

describe("buildAutomationDeliveryContext", () => {
  const morningAuto = {
    id: "au_1",
    agentId: "a1",
    title: "Morning brief",
    sopMarkdown: "Post brief",
    skillName: "day-planner",
    schedule: "0 8 * * *",
    nextRunAt: "2026-07-16T08:00:00.000Z",
    deliveryMode: "channel",
    deliveryChannelId: "ch_1",
  };

  it("attaches calendar events and channel name for morning brief", async () => {
    mockGetChannel.mockResolvedValue({ id: "ch_1", name: "general" });
    mockListCalendar.mockResolvedValue([
      {
        id: "e1",
        title: "Standup",
        scheduledAt: "2026-07-16T09:00:00.000Z",
        description: null,
        repeatInterval: null,
      },
    ]);

    const result = await buildAutomationDeliveryContext(
      {} as any,
      "w1",
      morningAuto,
      "2026-07-16T08:05:00.000Z",
    );

    expect(result.isMorningBrief).toBe(true);
    expect(result.scenarioId).toBe("day-planner");
    expect(result.deliveryChannelName).toBe("general");
    expect(result.prompt).toContain("Morning brief");
    expect(result.prompt).toContain("Standup");
    expect(result.prompt).toContain('channel "general"');
    expect(result.context).toMatchObject({
      automation_id: "au_1",
      morning_brief: true,
      scenario: "day-planner",
      delivery_mode: "channel",
      delivery_channel_id: "ch_1",
      delivery_channel_name: "general",
      deliver_to_channel: true,
    });
    expect(result.context.calendar_events).toEqual([
      expect.objectContaining({ id: "e1", title: "Standup" }),
    ]);
    expect(mockListCalendar).toHaveBeenCalledWith(
      {},
      "w1",
      expect.objectContaining({
        from: "2026-07-16T00:00:00.000Z",
        to: "2026-07-16T23:59:59.999Z",
      }),
    );
  });

  it("skips calendar load for non-brief automations but resolves channel", async () => {
    mockGetChannel.mockResolvedValue({ id: "ch_1", name: "ops" });
    const result = await buildAutomationDeliveryContext(
      {} as any,
      "w1",
      {
        ...morningAuto,
        title: "Weekly ops check",
        skillName: null,
        sopMarkdown: "Ping ops",
      },
      "2026-07-16T08:05:00.000Z",
    );
    expect(result.isMorningBrief).toBe(false);
    expect(result.scenarioId).toBeNull();
    expect(mockListCalendar).not.toHaveBeenCalled();
    expect(result.deliveryChannelName).toBe("ops");
    expect(result.context.delivery_channel_name).toBe("ops");
    expect(result.context.deliver_to_channel).toBe(true);
  });

  it("keeps morning_brief context when calendar load fails", async () => {
    mockGetChannel.mockResolvedValue({ id: "ch_1", name: "general" });
    mockListCalendar.mockRejectedValue(new Error("d1 unavailable"));

    const result = await buildAutomationDeliveryContext(
      {} as any,
      "w1",
      morningAuto,
      "2026-07-16T08:05:00.000Z",
    );

    expect(result.isMorningBrief).toBe(true);
    expect(result.scenarioId).toBe("day-planner");
    expect(result.day?.date).toBe("2026-07-16");
    expect(result.calendarEvents).toEqual([]);
    expect(result.context).toMatchObject({
      morning_brief: true,
      scenario: "day-planner",
      delivery_channel_name: "general",
      delivery_mode: "channel",
      deliver_to_channel: true,
    });
    expect(result.prompt).toContain('channel "general"');
    expect(result.prompt).toMatch(/No calendar events/i);
  });

  it("sets scenarioId day-planner for morning brief", async () => {
    mockGetChannel.mockResolvedValue({ id: "ch_1", name: "general" });
    mockListCalendar.mockResolvedValue([]);
    const result = await buildAutomationDeliveryContext(
      {} as any,
      "w1",
      morningAuto,
      "2026-07-16T08:05:00.000Z",
    );
    expect(result.scenarioId).toBe("day-planner");
    expect(result.prompt).toContain("2026-07-16");
  });

  it("attaches board_snapshot for task-digest scenario (SC glue)", async () => {
    mockGetChannel.mockResolvedValue({ id: "ch_1", name: "ops" });
    mockListIssues.mockResolvedValue([
      {
        id: "i1",
        title: "Blocked ship",
        status: "blocked",
        claimedByAgentId: "a1",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    ]);

    const result = await buildAutomationDeliveryContext(
      {} as any,
      "w1",
      {
        ...morningAuto,
        id: "au_td",
        title: "Task digest",
        sopMarkdown: "Scan the board",
        skillName: "task-digest",
        schedule: "0 17 * * *",
        nextRunAt: "2026-07-16T17:00:00.000Z",
      },
      "2026-07-16T17:05:00.000Z",
      { ownerUserId: "u1" },
    );

    expect(result.isMorningBrief).toBe(false);
    expect(result.scenarioId).toBe("task-digest");
    expect(mockListCalendar).not.toHaveBeenCalled();
    expect(mockListIssues).toHaveBeenCalledWith(
      {},
      "w1",
      expect.objectContaining({ userId: "u1", terminal: false }),
    );
    expect(result.prompt).toContain("Blocked ship");
    expect(result.prompt).toContain('channel "ops"');
    expect(result.context).toMatchObject({
      scenario: "task-digest",
      task_digest: true,
      delivery_channel_name: "ops",
      board_snapshot: expect.objectContaining({
        counts: expect.objectContaining({ blocked: 1 }),
      }),
    });
  });

  it("attaches inbox_snapshot for inbox-ai scenario (SC glue)", async () => {
    mockGetChannel.mockResolvedValue({ id: "ch_1", name: "inbox" });
    mockGetEmailsByAgent.mockResolvedValue([
      {
        id: "e1",
        direction: "inbound",
        status: "unread",
        fromEmail: "c@x.com",
        toEmail: "a@x.com",
        subject: "Need decision",
        createdAt: "2026-07-16T10:00:00.000Z",
      },
      {
        id: "e2",
        direction: "outbound",
        status: "pending_approval",
        fromEmail: "a@x.com",
        toEmail: "c@x.com",
        subject: "Draft reply",
        createdAt: "2026-07-16T11:00:00.000Z",
      },
    ]);

    const result = await buildAutomationDeliveryContext(
      {} as any,
      "w1",
      {
        ...morningAuto,
        id: "au_ia",
        title: "Inbox digest",
        sopMarkdown: "Triage inbox",
        skillName: "inbox-ai",
        schedule: "0 16 * * *",
        nextRunAt: "2026-07-16T16:00:00.000Z",
      },
      "2026-07-16T16:05:00.000Z",
      { ownerUserId: "u1" },
    );

    expect(result.isMorningBrief).toBe(false);
    expect(result.scenarioId).toBe("inbox-ai");
    expect(mockListCalendar).not.toHaveBeenCalled();
    expect(mockGetEmailsByAgent).toHaveBeenCalledWith(
      {},
      "a1",
      "w1",
      undefined,
      expect.objectContaining({ limit: 40 }),
    );
    expect(result.prompt).toContain("Need decision");
    expect(result.prompt).toContain("Draft reply");
    expect(result.context).toMatchObject({
      scenario: "inbox-ai",
      inbox_ai: true,
      delivery_channel_name: "inbox",
      inbox_snapshot: expect.objectContaining({
        counts: expect.objectContaining({
          inbound: 1,
          pending_approval: 1,
        }),
      }),
    });
  });

  it("still builds task-digest context when board load fails", async () => {
    mockGetChannel.mockResolvedValue({ id: "ch_1", name: "ops" });
    mockListIssues.mockRejectedValue(new Error("d1 down"));

    const result = await buildAutomationDeliveryContext(
      {} as any,
      "w1",
      {
        ...morningAuto,
        title: "Task digest",
        skillName: "task-digest",
        schedule: "0 17 * * *",
      },
      "2026-07-16T17:05:00.000Z",
      { ownerUserId: "u1" },
    );

    expect(result.scenarioId).toBe("task-digest");
    expect(result.prompt).toMatch(/No active issues/i);
    expect(result.context).toMatchObject({
      task_digest: true,
      board_snapshot: expect.objectContaining({ items: [] }),
    });
  });
});

describe("promoteDueAutomationsForWorkspace", () => {
  const auto = {
    id: "au_1",
    workspaceId: "w1",
    agentId: "a1",
    title: "Morning brief",
    sopMarkdown: "Post brief",
    schedule: "daily",
    nextRunAt: "2026-07-16T08:00:00.000Z",
    deliveryMode: "channel",
    deliveryChannelId: "ch_1",
    skillName: "day-planner",
    enabled: true,
  };

  it("claims and enqueues AUTOMATION_EVENT with calendar + channel delivery context", async () => {
    mockListDue.mockResolvedValue([auto]);
    mockGetAgent.mockResolvedValue({ id: "a1", runtimeId: "rt1", ownerId: "u1" });
    mockClaim.mockResolvedValue({ ...auto, lastTaskId: "t1" });
    mockGetChannel.mockResolvedValue({ id: "ch_1", name: "general" });
    mockListCalendar.mockResolvedValue([
      {
        id: "e1",
        title: "Standup",
        scheduledAt: "2026-07-16T09:00:00.000Z",
        description: null,
        repeatInterval: null,
      },
    ]);
    mockCreateConversation.mockResolvedValue({ id: "c1" });
    mockCreateMessage.mockResolvedValue({ id: "m1" });
    mockEnqueueTask.mockResolvedValue({ id: "t1", type: "automation_event" });

    const enqueued = await promoteDueAutomationsForWorkspace({} as any, "w1", {
      nowIso: "2026-07-16T08:05:00.000Z",
    });

    expect(enqueued).toBe(1);
    expect(mockClaim).toHaveBeenCalledWith(
      {},
      "au_1",
      "w1",
      "2026-07-16T08:00:00.000Z",
      expect.any(String),
      expect.any(String),
    );
    expect(mockCreateConversation).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        type: "automation_event",
        agentId: "a1",
        channel: "general",
      }),
    );
    expect(mockCreateMessage).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        metadata: expect.stringContaining("morningBrief"),
      }),
    );
    expect(mockEnqueueTask).toHaveBeenCalledWith(
      "a1",
      "c1",
      "w1",
      expect.stringContaining("Standup"),
      "automation_event",
      expect.objectContaining({
        context: expect.objectContaining({
          automation_id: "au_1",
          morning_brief: true,
          delivery_mode: "channel",
          delivery_channel_id: "ch_1",
          delivery_channel_name: "general",
          deliver_to_channel: true,
          calendar_events: [expect.objectContaining({ title: "Standup" })],
        }),
        idempotencyId: expect.any(String),
      }),
    );
    const meta = JSON.parse(
      mockCreateMessage.mock.calls[0]![1].metadata as string,
    );
    expect(meta).toMatchObject({
      morningBrief: true,
      scenarioId: "day-planner",
      deliveryMode: "channel",
      deliveryChannelName: "general",
    });
  });

  it("still enqueues morning brief when calendar query fails", async () => {
    mockListDue.mockResolvedValue([auto]);
    mockGetAgent.mockResolvedValue({ id: "a1", runtimeId: "rt1", ownerId: "u1" });
    mockClaim.mockResolvedValue({ ...auto, lastTaskId: "t1" });
    mockGetChannel.mockResolvedValue({ id: "ch_1", name: "general" });
    mockListCalendar.mockRejectedValue(new Error("d1 timeout"));
    mockCreateConversation.mockResolvedValue({ id: "c1" });
    mockCreateMessage.mockResolvedValue({ id: "m1" });
    mockEnqueueTask.mockResolvedValue({ id: "t1", type: "automation_event" });

    const enqueued = await promoteDueAutomationsForWorkspace({} as any, "w1", {
      nowIso: "2026-07-16T08:05:00.000Z",
    });
    expect(enqueued).toBe(1);
    expect(mockEnqueueTask).toHaveBeenCalledWith(
      "a1",
      "c1",
      "w1",
      expect.stringMatching(/No calendar events/i),
      "automation_event",
      expect.objectContaining({
        context: expect.objectContaining({
          morning_brief: true,
          delivery_channel_name: "general",
        }),
      }),
    );
  });

  it("skips when claim loses race", async () => {
    mockListDue.mockResolvedValue([auto]);
    mockGetAgent.mockResolvedValue({ id: "a1", runtimeId: "rt1", ownerId: "u1" });
    mockClaim.mockResolvedValue(null);

    const enqueued = await promoteDueAutomationsForWorkspace({} as any, "w1", {
      nowIso: "2026-07-16T08:05:00.000Z",
    });
    expect(enqueued).toBe(0);
    expect(mockEnqueueTask).not.toHaveBeenCalled();
  });

  it("double-fire: second promote after claim loss does not enqueue another task", async () => {
    mockListDue.mockResolvedValue([auto]);
    mockGetAgent.mockResolvedValue({ id: "a1", runtimeId: "rt1", ownerId: "u1" });
    mockGetChannel.mockResolvedValue({ id: "ch_1", name: "general" });
    mockListCalendar.mockResolvedValue([]);
    mockCreateConversation.mockResolvedValue({ id: "c1" });
    mockCreateMessage.mockResolvedValue({ id: "m1" });
    mockEnqueueTask.mockResolvedValue({ id: "t1", type: "automation_event" });
    mockCreateActivity.mockResolvedValue({ created: true, row: { id: "ae1" } });

    // First poll wins claim.
    mockClaim.mockResolvedValueOnce({ ...auto, lastTaskId: "t1" });
    const first = await promoteDueAutomationsForWorkspace({} as any, "w1", {
      nowIso: "2026-07-16T08:05:00.000Z",
    });
    expect(first).toBe(1);
    expect(mockEnqueueTask).toHaveBeenCalledTimes(1);
    expect(mockCreateActivity).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        kind: "automation_due",
        workspaceId: "w1",
        subjectId: "au_1",
      }),
    );

    // Concurrent/second poll loses claim — must not double-create tasks.
    mockClaim.mockResolvedValueOnce(null);
    const second = await promoteDueAutomationsForWorkspace({} as any, "w1", {
      nowIso: "2026-07-16T08:05:01.000Z",
    });
    expect(second).toBe(0);
    expect(mockEnqueueTask).toHaveBeenCalledTimes(1);
  });

  it("skips agents without runtime", async () => {
    mockListDue.mockResolvedValue([auto]);
    mockGetAgent.mockResolvedValue({ id: "a1", runtimeId: null, ownerId: "u1" });

    const enqueued = await promoteDueAutomationsForWorkspace({} as any, "w1");
    expect(enqueued).toBe(0);
    expect(mockClaim).not.toHaveBeenCalled();
  });

  it("reverts schedule when post-claim dispatch fails", async () => {
    mockListDue.mockResolvedValue([auto]);
    mockGetAgent.mockResolvedValue({ id: "a1", runtimeId: "rt1", ownerId: "u1" });
    mockClaim.mockResolvedValue({ ...auto, lastTaskId: "t1" });
    mockGetChannel.mockResolvedValue({ id: "ch_1", name: "general" });
    mockListCalendar.mockResolvedValue([]);
    mockCreateConversation.mockRejectedValue(new Error("db down"));
    mockRevert.mockResolvedValue({ ...auto });

    const enqueued = await promoteDueAutomationsForWorkspace({} as any, "w1", {
      nowIso: "2026-07-16T08:05:00.000Z",
    });

    expect(enqueued).toBe(0);
    expect(mockRevert).toHaveBeenCalledWith(
      {},
      "au_1",
      "w1",
      expect.any(String),
      {
        nextRunAt: "2026-07-16T08:00:00.000Z",
        lastRunAt: null,
        lastTaskId: null,
      },
    );
  });
});
