import { describe, it, expect, vi, beforeEach } from "vitest";

const mockListCalendar = vi.fn();
const mockGetChannel = vi.fn();
const mockGetOrCreateConv = vi.fn();
const mockCreateMessageIfAbsent = vi.fn();
const mockListAutomations = vi.fn();
const mockCreateAutomation = vi.fn();
const mockCreateCalendarEvent = vi.fn();

vi.mock("@phneakngar/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@phneakngar/shared")>();
  return {
    ...actual,
    queries: {
      calendarEvent: {
        listCalendarEvents: (...a: unknown[]) => mockListCalendar(...a),
        createCalendarEvent: (...a: unknown[]) => mockCreateCalendarEvent(...a),
      },
      channel: {
        getChannelById: (...a: unknown[]) => mockGetChannel(...a),
      },
      conversation: {
        getOrCreateAgentConversation: (...a: unknown[]) => mockGetOrCreateConv(...a),
      },
      message: {
        createMessageIfAbsent: (...a: unknown[]) => mockCreateMessageIfAbsent(...a),
      },
      automation: {
        listAutomations: (...a: unknown[]) => mockListAutomations(...a),
        createAutomation: (...a: unknown[]) => mockCreateAutomation(...a),
      },
    },
  };
});

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import {
  buildMorningBriefPrompt,
  buildMorningBriefTaskContext,
  deliverMorningBriefToChannel,
  ensureDayPlannerMorningBriefPath,
  ensureMorningBriefAutomation,
  ensureMorningBriefCalendarCue,
  formatCalendarEventsForBrief,
  isMorningBriefAutomation,
  loadDayCalendarEvents,
  nextUtcWallClock,
  resolveDeliveryChannel,
  toBriefCalendarEvents,
  utcDayWindow,
} from "./morning-brief";

beforeEach(() => vi.clearAllMocks());

describe("utcDayWindow", () => {
  it("returns inclusive UTC day bounds", () => {
    const day = utcDayWindow("2026-07-16T08:30:00.000Z");
    expect(day.date).toBe("2026-07-16");
    expect(day.from).toBe("2026-07-16T00:00:00.000Z");
    expect(day.to).toBe("2026-07-16T23:59:59.999Z");
  });

  it("throws on invalid nowIso", () => {
    expect(() => utcDayWindow("not-a-date")).toThrow(/invalid nowIso/);
  });
});

describe("nextUtcWallClock", () => {
  it("returns same day when still before hour", () => {
    expect(nextUtcWallClock(8, 0, "2026-07-16T07:00:00.000Z")).toBe(
      "2026-07-16T08:00:00.000Z",
    );
  });

  it("rolls to next day when past hour", () => {
    expect(nextUtcWallClock(8, 0, "2026-07-16T09:00:00.000Z")).toBe(
      "2026-07-17T08:00:00.000Z",
    );
  });

  it("rolls to next day when exactly at fire time", () => {
    expect(nextUtcWallClock(8, 0, "2026-07-16T08:00:00.000Z")).toBe(
      "2026-07-17T08:00:00.000Z",
    );
  });
});

describe("isMorningBriefAutomation", () => {
  it("matches title / skill / sop hints", () => {
    expect(isMorningBriefAutomation({ title: "Morning brief" })).toBe(true);
    expect(
      isMorningBriefAutomation({ title: "Daily", skillName: "day-planner" }),
    ).toBe(true);
    expect(
      isMorningBriefAutomation({
        title: "Routine",
        sopMarkdown: "Post the morning brief to channel",
      }),
    ).toBe(true);
    expect(
      isMorningBriefAutomation({ title: "អ្នករៀបចំថ្ងៃ" }),
    ).toBe(true);
    expect(isMorningBriefAutomation({ title: "day_planner checkin" })).toBe(
      true,
    );
    expect(isMorningBriefAutomation({ title: "Weekly report" })).toBe(false);
  });
});

describe("formatCalendarEventsForBrief", () => {
  it("formats empty day", () => {
    const { summary, items } = formatCalendarEventsForBrief([]);
    expect(items).toEqual([]);
    expect(summary).toMatch(/No calendar events/i);
  });

  it("lists events with UTC time", () => {
    const { summary, items } = formatCalendarEventsForBrief([
      {
        id: "e1",
        title: "Standup",
        scheduled_at: "2026-07-16T09:00:00.000Z",
        description: "daily",
        is_recurring: true,
      },
    ]);
    expect(items).toHaveLength(1);
    expect(summary).toContain("09:00 UTC");
    expect(summary).toContain("Standup");
    expect(summary).toContain("recurring");
  });
});

describe("toBriefCalendarEvents", () => {
  it("sorts by scheduled_at", () => {
    const items = toBriefCalendarEvents([
      {
        id: "b",
        title: "Later",
        scheduledAt: "2026-07-16T15:00:00.000Z",
        repeatInterval: null,
      },
      {
        id: "a",
        title: "Earlier",
        scheduledAt: "2026-07-16T09:00:00.000Z",
        repeatInterval: "1day",
      },
    ]);
    expect(items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(items[0]!.is_recurring).toBe(true);
  });

  it("normalizes blank titles", () => {
    const items = toBriefCalendarEvents([
      {
        id: "e1",
        title: "   ",
        scheduledAt: "2026-07-16T10:00:00.000Z",
        repeatInterval: null,
      },
    ]);
    expect(items[0]!.title).toBe("(untitled)");
  });
});

describe("buildMorningBriefPrompt / task context", () => {
  it("embeds calendar summary and channel delivery", () => {
    const prompt = buildMorningBriefPrompt("Morning brief", {
      dayDate: "2026-07-16",
      calendarSummary: "Calendar for the day (1):\n- 09:00 UTC · Standup",
      deliveryMode: "channel",
      deliveryChannelName: "general",
    });
    expect(prompt).toContain("Morning brief");
    expect(prompt).toContain("2026-07-16");
    expect(prompt).toContain("Standup");
    expect(prompt).toContain('channel "general"');
  });

  it("describes dm delivery mode", () => {
    const prompt = buildMorningBriefPrompt("Brief", {
      deliveryMode: "dm",
    });
    expect(prompt).toMatch(/direct message/i);
  });

  it("describes other delivery modes with optional channel", () => {
    const prompt = buildMorningBriefPrompt("Brief", {
      deliveryMode: "email_draft",
      deliveryChannelName: "ops",
    });
    expect(prompt).toContain("email_draft");
    expect(prompt).toContain("ops");
  });

  it("builds context bag with morning_brief flag", () => {
    const day = utcDayWindow("2026-07-16T08:00:00.000Z");
    const ctx = buildMorningBriefTaskContext({
      automationId: "au_1",
      schedule: "0 8 * * *",
      deliveryMode: "channel",
      deliveryChannelId: "ch_1",
      deliveryChannelName: "general",
      skillName: "day-planner",
      observedNextRunAt: "2026-07-16T08:00:00.000Z",
      day,
      calendarEvents: [
        {
          id: "e1",
          title: "Standup",
          scheduled_at: "2026-07-16T09:00:00.000Z",
          is_recurring: false,
        },
      ],
    });
    expect(ctx.morning_brief).toBe(true);
    expect(ctx.scenario).toBe("day-planner");
    expect(ctx.delivery_channel_name).toBe("general");
    // C3/C6 glue: channel mode opts into deliver_to_channel for task complete.
    expect(ctx.deliver_to_channel).toBe(true);
    expect(ctx.calendar_events).toEqual([
      expect.objectContaining({ id: "e1", title: "Standup" }),
    ]);
    expect(String(ctx.calendar_summary)).toContain("Standup");
    expect(ctx.day_window).toEqual({
      date: "2026-07-16",
      from: "2026-07-16T00:00:00.000Z",
      to: "2026-07-16T23:59:59.999Z",
    });
  });
});

describe("loadDayCalendarEvents", () => {
  it("scopes list by workspace day window", async () => {
    mockListCalendar.mockResolvedValue([
      {
        id: "e1",
        title: "1:1",
        scheduledAt: "2026-07-16T14:00:00.000Z",
        description: null,
        repeatInterval: null,
      },
    ]);
    const { day, events } = await loadDayCalendarEvents({} as any, "w1", {
      nowIso: "2026-07-16T08:00:00.000Z",
    });
    expect(day.date).toBe("2026-07-16");
    expect(mockListCalendar).toHaveBeenCalledWith(
      {},
      "w1",
      expect.objectContaining({
        from: "2026-07-16T00:00:00.000Z",
        to: "2026-07-16T23:59:59.999Z",
      }),
    );
    expect(events).toHaveLength(1);
    expect(events[0]!.title).toBe("1:1");
  });

  it("forwards optional agentId filter", async () => {
    mockListCalendar.mockResolvedValue([]);
    await loadDayCalendarEvents({} as any, "w1", {
      agentId: "a1",
      nowIso: "2026-07-16T08:00:00.000Z",
    });
    expect(mockListCalendar).toHaveBeenCalledWith(
      {},
      "w1",
      expect.objectContaining({ agentId: "a1" }),
    );
  });
});

describe("resolveDeliveryChannel", () => {
  it("returns null when missing id", async () => {
    expect(await resolveDeliveryChannel({} as any, "w1", null)).toBeNull();
    expect(mockGetChannel).not.toHaveBeenCalled();
  });

  it("resolves workspace-scoped channel", async () => {
    mockGetChannel.mockResolvedValue({ id: "ch_1", name: "general" });
    const ch = await resolveDeliveryChannel({} as any, "w1", "ch_1");
    expect(mockGetChannel).toHaveBeenCalledWith({}, "ch_1", "w1");
    expect(ch).toEqual({ id: "ch_1", name: "general" });
  });

  it("returns null when channel is outside workspace", async () => {
    mockGetChannel.mockResolvedValue(null);
    expect(await resolveDeliveryChannel({} as any, "w1", "ch_x")).toBeNull();
  });
});

describe("deliverMorningBriefToChannel", () => {
  it("posts idempotent assistant message on channel conversation", async () => {
    mockGetChannel.mockResolvedValue({ id: "ch_1", name: "general" });
    mockGetOrCreateConv.mockResolvedValue({ id: "c1" });
    mockCreateMessageIfAbsent.mockResolvedValue({
      message: { id: "mb_2026-07-16_au_1" },
      created: true,
    });

    const result = await deliverMorningBriefToChannel({} as any, {
      workspaceId: "w1",
      agentId: "a1",
      ownerUserId: "u1",
      deliveryChannelId: "ch_1",
      content: "## Morning brief\n- Ship C6",
      automationId: "au_1",
      taskId: "t1",
      dayDate: "2026-07-16",
    });

    expect(result).toEqual({
      messageId: "mb_2026-07-16_au_1",
      conversationId: "c1",
      channelName: "general",
      created: true,
    });
    expect(mockGetOrCreateConv).toHaveBeenCalledWith(
      {},
      "w1",
      "u1",
      "a1",
      "general",
    );
    expect(mockCreateMessageIfAbsent).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        id: "mb_2026-07-16_au_1",
        conversationId: "c1",
        role: "assistant",
        content: "## Morning brief\n- Ship C6",
        taskId: "t1",
      }),
    );
    const metaRaw = mockCreateMessageIfAbsent.mock.calls[0]![1].metadata as string;
    expect(JSON.parse(metaRaw)).toMatchObject({
      kind: "morning_brief",
      scenario: "day-planner",
      automationId: "au_1",
      taskId: "t1",
      dayDate: "2026-07-16",
      channelName: "general",
      deliveryMode: "channel",
    });
  });

  it("delivers by channel name when id is omitted", async () => {
    mockGetOrCreateConv.mockResolvedValue({ id: "c1" });
    mockCreateMessageIfAbsent.mockResolvedValue({
      message: { id: "mb_2026-07-16_a1:general" },
      created: true,
    });
    const result = await deliverMorningBriefToChannel({} as any, {
      workspaceId: "w1",
      agentId: "a1",
      ownerUserId: "u1",
      channelName: "general",
      content: "hello brief",
      dayDate: "2026-07-16",
    });
    expect(result?.created).toBe(true);
    expect(mockGetChannel).not.toHaveBeenCalled();
    expect(mockCreateMessageIfAbsent).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        id: "mb_2026-07-16_a1:general",
      }),
    );
  });

  it("is idempotent when message already exists for the day", async () => {
    mockGetChannel.mockResolvedValue({ id: "ch_1", name: "general" });
    mockGetOrCreateConv.mockResolvedValue({ id: "c1" });
    mockCreateMessageIfAbsent.mockResolvedValue({
      message: { id: "mb_2026-07-16_au_1" },
      created: false,
    });
    const result = await deliverMorningBriefToChannel({} as any, {
      workspaceId: "w1",
      agentId: "a1",
      ownerUserId: "u1",
      deliveryChannelId: "ch_1",
      content: "same day brief",
      automationId: "au_1",
      dayDate: "2026-07-16",
    });
    expect(result).toEqual({
      messageId: "mb_2026-07-16_au_1",
      conversationId: "c1",
      channelName: "general",
      created: false,
    });
  });

  it("keeps dayDate in message id when seed is long", async () => {
    mockGetOrCreateConv.mockResolvedValue({ id: "c1" });
    mockCreateMessageIfAbsent.mockResolvedValue({
      message: { id: "mb_long" },
      created: true,
    });
    const longAutomationId = "au_" + "x".repeat(80);
    await deliverMorningBriefToChannel({} as any, {
      workspaceId: "w1",
      agentId: "a1",
      ownerUserId: "u1",
      channelName: "general",
      content: "brief",
      automationId: longAutomationId,
      dayDate: "2026-07-16",
    });
    const id = mockCreateMessageIfAbsent.mock.calls[0]![1].id as string;
    expect(id.startsWith("mb_2026-07-16_")).toBe(true);
    expect(id.length).toBeLessThanOrEqual(64);
  });

  it("returns null when channel missing", async () => {
    mockGetChannel.mockResolvedValue(null);
    const result = await deliverMorningBriefToChannel({} as any, {
      workspaceId: "w1",
      agentId: "a1",
      ownerUserId: "u1",
      deliveryChannelId: "ch_missing",
      content: "brief",
    });
    expect(result).toBeNull();
    expect(mockCreateMessageIfAbsent).not.toHaveBeenCalled();
  });

  it("returns null for empty content", async () => {
    const result = await deliverMorningBriefToChannel({} as any, {
      workspaceId: "w1",
      agentId: "a1",
      ownerUserId: "u1",
      channelName: "general",
      content: "   ",
    });
    expect(result).toBeNull();
  });

  it("returns null when neither channel id nor name is provided", async () => {
    const result = await deliverMorningBriefToChannel({} as any, {
      workspaceId: "w1",
      agentId: "a1",
      ownerUserId: "u1",
      content: "brief body",
    });
    expect(result).toBeNull();
    expect(mockCreateMessageIfAbsent).not.toHaveBeenCalled();
  });
});

describe("ensureMorningBriefAutomation / calendar cue", () => {
  it("returns existing morning brief automation without creating", async () => {
    mockListAutomations.mockResolvedValue([
      { id: "au_existing", title: "Morning brief", agentId: "a1" },
    ]);
    const result = await ensureMorningBriefAutomation({} as any, {
      workspaceId: "w1",
      agentId: "a1",
      deliveryChannelId: "ch_1",
    });
    expect(result.created).toBe(false);
    expect(result.automation.id).toBe("au_existing");
    expect(mockCreateAutomation).not.toHaveBeenCalled();
    expect(mockListAutomations).toHaveBeenCalledWith(
      {},
      "w1",
      expect.objectContaining({ agentId: "a1" }),
    );
  });

  it("creates channel-delivery automation when absent", async () => {
    mockListAutomations.mockResolvedValue([]);
    mockCreateAutomation.mockResolvedValue({
      id: "au_new",
      title: "Morning brief",
      deliveryMode: "channel",
    });
    const result = await ensureMorningBriefAutomation({} as any, {
      workspaceId: "w1",
      agentId: "a1",
      deliveryChannelId: "ch_1",
      nowIso: "2026-07-16T09:00:00.000Z",
    });
    expect(result.created).toBe(true);
    expect(mockCreateAutomation).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        workspaceId: "w1",
        agentId: "a1",
        title: "Morning brief",
        deliveryMode: "channel",
        deliveryChannelId: "ch_1",
        schedule: "0 8 * * *",
        nextRunAt: "2026-07-17T08:00:00.000Z",
        skillName: "day-planner",
        enabled: true,
      }),
    );
  });

  it("seeds calendar cue once", async () => {
    mockListCalendar.mockResolvedValue([]);
    mockCreateCalendarEvent.mockResolvedValue({
      id: "ce_1",
      title: "Morning brief",
    });
    const result = await ensureMorningBriefCalendarCue({} as any, {
      workspaceId: "w1",
      agentId: "a1",
      nowIso: "2026-07-16T07:00:00.000Z",
    });
    expect(result.created).toBe(true);
    expect(mockCreateCalendarEvent).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        workspaceId: "w1",
        agentId: "a1",
        title: "Morning brief",
        scheduledAt: "2026-07-16T08:00:00.000Z",
        repeatInterval: "1day",
      }),
    );
  });

  it("returns existing calendar cue without creating", async () => {
    mockListCalendar.mockResolvedValue([
      { id: "ce_existing", title: "Morning brief", agentId: "a1" },
    ]);
    const result = await ensureMorningBriefCalendarCue({} as any, {
      workspaceId: "w1",
      agentId: "a1",
    });
    expect(result.created).toBe(false);
    expect(result.event.id).toBe("ce_existing");
    expect(mockCreateCalendarEvent).not.toHaveBeenCalled();
  });

  it("ensureDayPlannerMorningBriefPath wires both", async () => {
    mockListAutomations.mockResolvedValue([]);
    mockCreateAutomation.mockResolvedValue({ id: "au_1", title: "Morning brief" });
    mockListCalendar.mockResolvedValue([]);
    mockCreateCalendarEvent.mockResolvedValue({ id: "ce_1", title: "Morning brief" });

    const result = await ensureDayPlannerMorningBriefPath({} as any, {
      workspaceId: "w1",
      agentId: "a1",
      deliveryChannelId: "ch_1",
      nowIso: "2026-07-16T07:00:00.000Z",
    });
    expect(result.automationCreated).toBe(true);
    expect(result.calendarCreated).toBe(true);
    expect(result.automation.id).toBe("au_1");
    expect(result.calendarEvent.id).toBe("ce_1");
  });

  it("ensureDayPlannerMorningBriefPath is idempotent when already seeded", async () => {
    mockListAutomations.mockResolvedValue([
      { id: "au_existing", title: "Morning brief", agentId: "a1" },
    ]);
    mockListCalendar.mockResolvedValue([
      { id: "ce_existing", title: "Morning brief", agentId: "a1" },
    ]);
    const result = await ensureDayPlannerMorningBriefPath({} as any, {
      workspaceId: "w1",
      agentId: "a1",
      deliveryChannelId: "ch_1",
    });
    expect(result.automationCreated).toBe(false);
    expect(result.calendarCreated).toBe(false);
    expect(mockCreateAutomation).not.toHaveBeenCalled();
    expect(mockCreateCalendarEvent).not.toHaveBeenCalled();
  });
});
