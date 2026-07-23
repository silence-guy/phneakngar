import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetPlaybookRun = vi.fn();
const mockListStepRuns = vi.fn();

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => ({ env: { DB: {} } })),
}));

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

vi.mock("@phneakngar/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@phneakngar/shared")>();
  return {
    ...actual,
    queries: {
      playbookRun: {
        getPlaybookRun: (...a: unknown[]) => mockGetPlaybookRun(...a),
        listStepRuns: (...a: unknown[]) => mockListStepRuns(...a),
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
  playbookRunToResponse: (row: any) => ({ id: row.id, status: row.status }),
  playbookStepRunToResponse: (row: any) => ({ step_id: row.stepId, status: row.status }),
}));

import { GET } from "./route";

beforeEach(() => vi.clearAllMocks());

const ctx = { params: { runId: "pbr1" } } as any;

describe("GET /api/playbooks/runs/[runId]", () => {
  it("returns the run with its step timeline", async () => {
    mockGetPlaybookRun.mockResolvedValue({ id: "pbr1", status: "running" });
    mockListStepRuns.mockResolvedValue([
      { stepId: "s1", status: "completed" },
      { stepId: "s2", status: "running" },
    ]);
    const res = await GET(new NextRequest("http://localhost/api/playbooks/runs/pbr1"), ctx);
    expect(res.status).toBe(200);
    expect(mockGetPlaybookRun).toHaveBeenCalledWith({}, "pbr1", "w1");
    const body = await res.json();
    expect(body.run.id).toBe("pbr1");
    expect(body.steps).toHaveLength(2);
  });

  it("404 for another workspace's run", async () => {
    mockGetPlaybookRun.mockResolvedValue(null);
    const res = await GET(new NextRequest("http://localhost/api/playbooks/runs/pbr1"), ctx);
    expect(res.status).toBe(404);
    expect(mockListStepRuns).not.toHaveBeenCalled();
  });
});
