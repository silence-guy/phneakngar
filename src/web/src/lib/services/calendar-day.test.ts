import { describe, it, expect, vi, beforeEach } from "vitest";

const mockListCalendar = vi.fn();

vi.mock("@phneakngar/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@phneakngar/shared")>();
  return {
    ...actual,
    queries: {
      ...actual.queries,
      calendarEvent: {
        ...actual.queries.calendarEvent,
        listCalendarEvents: (...a: unknown[]) => mockListCalendar(...a),
      },
    },
  };
});

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { listCalendarEventsForUtcDay, utcDayWindow } from "./calendar";

beforeEach(() => vi.clearAllMocks());

describe("listCalendarEventsForUtcDay", () => {
  it("delegates to workspace-scoped day load", async () => {
    mockListCalendar.mockResolvedValue([
      {
        id: "e1",
        title: "Focus",
        scheduledAt: "2026-07-16T11:00:00.000Z",
        description: null,
        repeatInterval: null,
      },
    ]);
    const { day, events } = await listCalendarEventsForUtcDay({} as any, "w1", {
      nowIso: "2026-07-16T08:00:00.000Z",
      agentId: "a1",
    });
    expect(day).toEqual(utcDayWindow("2026-07-16T08:00:00.000Z"));
    expect(events[0]!.title).toBe("Focus");
    expect(mockListCalendar).toHaveBeenCalledWith(
      {},
      "w1",
      expect.objectContaining({
        agentId: "a1",
        from: day.from,
        to: day.to,
      }),
    );
  });

  it("returns empty events for an empty UTC day", async () => {
    mockListCalendar.mockResolvedValue([]);
    const { day, events } = await listCalendarEventsForUtcDay({} as any, "w1", {
      nowIso: "2026-07-16T12:00:00.000Z",
    });
    expect(day.date).toBe("2026-07-16");
    expect(events).toEqual([]);
  });

  it("re-exports utcDayWindow with matching bounds", () => {
    const day = utcDayWindow("2026-12-31T23:00:00.000Z");
    expect(day.date).toBe("2026-12-31");
    expect(day.from).toBe("2026-12-31T00:00:00.000Z");
    expect(day.to).toBe("2026-12-31T23:59:59.999Z");
  });
});
