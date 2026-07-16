import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockListCompleted = vi.fn();
const mockListAutomations = vi.fn();
const mockWithWorkspaceMember = vi.fn(async () => ({ workspaceId: "w1" }));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => ({ env: { DB: {} } })),
}));

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

vi.mock("@phneakngar/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@phneakngar/shared")>();
  return {
    ...actual,
    queries: {
      task: {
        listCompletedTasksForPatternAnalysis: (...a: unknown[]) => mockListCompleted(...a),
      },
      automation: {
        listAutomations: (...a: unknown[]) => mockListAutomations(...a),
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
  withWorkspaceMember: (...args: unknown[]) => mockWithWorkspaceMember(...args),
}));

import { GET } from "./route";

const morningBriefTasks = [
  {
    id: "t1",
    agentId: "a1",
    prompt: "Send morning brief for 2026-07-10",
    type: "user_dm_message",
    completedAt: "2026-07-10T08:00:00.000Z",
  },
  {
    id: "t2",
    agentId: "a1",
    prompt: "Send morning brief for 2026-07-11",
    type: "user_dm_message",
    completedAt: "2026-07-11T08:00:00.000Z",
  },
  {
    id: "t3",
    agentId: "a1",
    prompt: "Send morning brief for 2026-07-12",
    type: "user_dm_message",
    completedAt: "2026-07-12T08:00:00.000Z",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockListAutomations.mockResolvedValue([]);
  mockWithWorkspaceMember.mockResolvedValue({ workspaceId: "w1" });
});

describe("GET /api/automations/suggestions", () => {
  it("returns empty items when no recurring pattern", async () => {
    mockListCompleted.mockResolvedValue([
      {
        id: "t1",
        agentId: "a1",
        prompt: "One-off task",
        type: "user_dm_message",
        completedAt: "2026-07-12T08:00:00.000Z",
      },
    ]);

    const res = await GET(
      new NextRequest("http://localhost/api/automations/suggestions?workspace_id=w1"),
      {} as any,
    );
    expect(res.status).toBe(200);
    expect(mockListCompleted).toHaveBeenCalledWith({}, "w1", {
      agentId: undefined,
      limit: 200,
    });
    const body = await res.json();
    expect(body.items).toEqual([]);
    expect(body.min_count).toBe(3);
  });

  it("returns suggestion object when N similar tasks complete", async () => {
    mockListCompleted.mockResolvedValue(morningBriefTasks);

    const res = await GET(
      new NextRequest(
        "http://localhost/api/automations/suggestions?workspace_id=w1&agent_id=a1&min_count=3",
      ),
      {} as any,
    );
    expect(res.status).toBe(200);
    expect(mockListCompleted).toHaveBeenCalledWith({}, "w1", {
      agentId: "a1",
      limit: 200,
    });
    expect(mockListAutomations).toHaveBeenCalledWith({}, "w1", { agentId: "a1" });
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      count: 3,
      agent_id: "a1",
      suggested_schedule: "daily",
      task_ids: ["t1", "t2", "t3"],
    });
    expect(body.items[0].suggested_title.toLowerCase()).toContain("morning brief");
    expect(body.items[0].pattern_key).toBeTruthy();
    expect(body.items[0].sample_prompt).toBeTruthy();
    expect(body.items[0].suggested_sop_markdown).toBe(body.items[0].sample_prompt);
    expect(body.items[0].latest_completed_at).toBe("2026-07-12T08:00:00.000Z");
  });

  it("suppresses suggestions when automation already exists", async () => {
    mockListCompleted.mockResolvedValue(morningBriefTasks);
    mockListAutomations.mockResolvedValue([
      { id: "au_1", title: "Send morning brief for 2026-07-12" },
    ]);

    const res = await GET(
      new NextRequest("http://localhost/api/automations/suggestions"),
      {} as any,
    );
    const body = await res.json();
    expect(body.items).toEqual([]);
  });

  it("scopes task + automation queries by workspace membership id", async () => {
    mockWithWorkspaceMember.mockResolvedValue({ workspaceId: "ws_member" });
    mockListCompleted.mockResolvedValue([]);

    await GET(
      new NextRequest("http://localhost/api/automations/suggestions?workspace_id=ws_member"),
      {} as any,
    );

    expect(mockListCompleted).toHaveBeenCalledWith({}, "ws_member", {
      agentId: undefined,
      limit: 200,
    });
    expect(mockListAutomations).toHaveBeenCalledWith({}, "ws_member", { agentId: undefined });
  });

  it("propagates workspace membership rejection", async () => {
    mockWithWorkspaceMember.mockResolvedValue(
      new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }),
    );

    const res = await GET(
      new NextRequest("http://localhost/api/automations/suggestions?workspace_id=other"),
      {} as any,
    );
    expect(res.status).toBe(403);
    expect(mockListCompleted).not.toHaveBeenCalled();
    expect(mockListAutomations).not.toHaveBeenCalled();
  });

  it("clamps min_count, limit, and task_limit query params", async () => {
    mockListCompleted.mockResolvedValue(morningBriefTasks);

    const res = await GET(
      new NextRequest(
        "http://localhost/api/automations/suggestions?min_count=1&limit=999&task_limit=9999",
      ),
      {} as any,
    );
    expect(res.status).toBe(200);
    // min_count floor is 2; limit cap 50; task_limit cap 500
    expect(mockListCompleted).toHaveBeenCalledWith({}, "w1", {
      agentId: undefined,
      limit: 500,
    });
    const body = await res.json();
    expect(body.min_count).toBe(2);
    expect(body.items).toHaveLength(1);
  });

  it("uses default min_count when param is non-numeric", async () => {
    mockListCompleted.mockResolvedValue([]);
    const res = await GET(
      new NextRequest("http://localhost/api/automations/suggestions?min_count=abc"),
      {} as any,
    );
    const body = await res.json();
    expect(body.min_count).toBe(3);
  });

  it("excludes automation_event tasks from pattern suggestions", async () => {
    mockListCompleted.mockResolvedValue(
      morningBriefTasks.map((t) => ({ ...t, type: "automation_event" })),
    );

    const res = await GET(
      new NextRequest("http://localhost/api/automations/suggestions"),
      {} as any,
    );
    const body = await res.json();
    expect(body.items).toEqual([]);
  });
});
