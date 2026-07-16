import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockListAutomations = vi.fn();
const mockCreateAutomation = vi.fn();
const mockGetAgent = vi.fn();
const mockGetChannelById = vi.fn();

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => ({ env: { DB: {} } })),
}));

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

vi.mock("@phneakngar/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@phneakngar/shared")>();
  return {
    ...actual,
    queries: {
      automation: {
        listAutomations: (...a: unknown[]) => mockListAutomations(...a),
        createAutomation: (...a: unknown[]) => mockCreateAutomation(...a),
      },
      agent: {
        getAgent: (...a: unknown[]) => mockGetAgent(...a),
      },
      channel: {
        getChannelById: (...a: unknown[]) => mockGetChannelById(...a),
      },
    },
  };
});

vi.mock("@/lib/middleware/auth", () => ({
  withAuth: (handler: any) => async (req: any, ctx?: any) => {
    const params = ctx?.params instanceof Promise ? await ctx.params : ctx?.params;
    return handler(req, { env: {}, userId: "u1", email: "u@t.com", params });
  },
}));

vi.mock("@/lib/middleware/workspace", () => ({
  withWorkspaceMember: vi.fn(async () => ({ workspaceId: "w1" })),
}));

vi.mock("@/lib/api/responses", () => ({
  automationToResponse: (row: any) => ({
    id: row.id,
    workspace_id: row.workspaceId,
    agent_id: row.agentId,
    title: row.title,
    schedule: row.schedule,
    next_run_at: row.nextRunAt,
    enabled: row.enabled,
  }),
}));

import { GET, POST } from "./route";

beforeEach(() => vi.clearAllMocks());

describe("GET /api/automations", () => {
  it("lists workspace automations", async () => {
    mockListAutomations.mockResolvedValue([
      {
        id: "au_1",
        workspaceId: "w1",
        agentId: "a1",
        title: "Morning brief",
        schedule: "daily",
        nextRunAt: "2026-07-17T01:00:00.000Z",
        enabled: true,
      },
    ]);

    const res = await GET(new NextRequest("http://localhost/api/automations?workspace_id=w1"), {} as any);
    expect(res.status).toBe(200);
    expect(mockListAutomations).toHaveBeenCalledWith({}, "w1", {
      agentId: undefined,
      enabled: undefined,
    });
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe("au_1");
  });

  it("filters by agent_id and enabled", async () => {
    mockListAutomations.mockResolvedValue([]);
    const res = await GET(
      new NextRequest("http://localhost/api/automations?agent_id=a1&enabled=true"),
      {} as any
    );
    expect(res.status).toBe(200);
    expect(mockListAutomations).toHaveBeenCalledWith({}, "w1", {
      agentId: "a1",
      enabled: true,
    });
  });
});

describe("POST /api/automations", () => {
  it("creates automation for visible agent", async () => {
    mockGetAgent.mockResolvedValue({ id: "a1", ownerId: "u1" });
    mockCreateAutomation.mockResolvedValue({
      id: "au_2",
      workspaceId: "w1",
      agentId: "a1",
      title: "Task digest",
      sopMarkdown: "Scan open issues",
      schedule: "1day",
      nextRunAt: "2026-07-17T08:00:00.000Z",
      deliveryMode: "channel",
      deliveryChannelId: null,
      skillName: null,
      enabled: true,
    });

    const res = await POST(
      new NextRequest("http://localhost/api/automations", {
        method: "POST",
        body: JSON.stringify({
          agent_id: "a1",
          title: "Task digest",
          sop_markdown: "Scan open issues",
          schedule: "1day",
          next_run_at: "2026-07-17T08:00:00.000Z",
        }),
        headers: { "content-type": "application/json" },
      }),
      {} as any
    );

    expect(res.status).toBe(201);
    expect(mockGetAgent).toHaveBeenCalledWith({}, "a1", "w1", "u1");
    expect(mockCreateAutomation).toHaveBeenCalledWith({}, expect.objectContaining({
      workspaceId: "w1",
      agentId: "a1",
      title: "Task digest",
      schedule: "1day",
      nextRunAt: "2026-07-17T08:00:00.000Z",
    }));
  });

  it("returns 404 when agent missing", async () => {
    mockGetAgent.mockResolvedValue(null);
    const res = await POST(
      new NextRequest("http://localhost/api/automations", {
        method: "POST",
        body: JSON.stringify({
          agent_id: "missing",
          title: "X",
          schedule: "daily",
          next_run_at: "2026-07-17T08:00:00.000Z",
        }),
        headers: { "content-type": "application/json" },
      }),
      {} as any
    );
    expect(res.status).toBe(404);
    expect(mockCreateAutomation).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid body", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/automations", {
        method: "POST",
        body: JSON.stringify({ title: "no agent" }),
        headers: { "content-type": "application/json" },
      }),
      {} as any
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid next_run_at", async () => {
    mockGetAgent.mockResolvedValue({ id: "a1" });
    const res = await POST(
      new NextRequest("http://localhost/api/automations", {
        method: "POST",
        body: JSON.stringify({
          agent_id: "a1",
          title: "X",
          schedule: "daily",
          next_run_at: "not-a-date",
        }),
        headers: { "content-type": "application/json" },
      }),
      {} as any
    );
    expect(res.status).toBe(400);
    expect(mockCreateAutomation).not.toHaveBeenCalled();
  });

  it("returns 404 when delivery_channel_id is outside workspace", async () => {
    mockGetAgent.mockResolvedValue({ id: "a1" });
    mockGetChannelById.mockResolvedValue(null);
    const res = await POST(
      new NextRequest("http://localhost/api/automations", {
        method: "POST",
        body: JSON.stringify({
          agent_id: "a1",
          title: "X",
          schedule: "daily",
          next_run_at: "2026-07-17T08:00:00.000Z",
          delivery_channel_id: "ch_foreign",
        }),
        headers: { "content-type": "application/json" },
      }),
      {} as any
    );
    expect(res.status).toBe(404);
    expect(mockGetChannelById).toHaveBeenCalledWith({}, "ch_foreign", "w1");
    expect(mockCreateAutomation).not.toHaveBeenCalled();
  });

  it("accepts delivery_channel_id when channel is in workspace", async () => {
    mockGetAgent.mockResolvedValue({ id: "a1" });
    mockGetChannelById.mockResolvedValue({ id: "ch_1", workspaceId: "w1" });
    mockCreateAutomation.mockResolvedValue({
      id: "au_3",
      workspaceId: "w1",
      agentId: "a1",
      title: "Channel brief",
      schedule: "daily",
      nextRunAt: "2026-07-17T08:00:00.000Z",
      enabled: true,
      deliveryChannelId: "ch_1",
    });
    const res = await POST(
      new NextRequest("http://localhost/api/automations", {
        method: "POST",
        body: JSON.stringify({
          agent_id: "a1",
          title: "Channel brief",
          schedule: "daily",
          next_run_at: "2026-07-17T08:00:00.000Z",
          delivery_channel_id: "ch_1",
        }),
        headers: { "content-type": "application/json" },
      }),
      {} as any
    );
    expect(res.status).toBe(201);
    expect(mockCreateAutomation).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ deliveryChannelId: "ch_1" }),
    );
  });
});
