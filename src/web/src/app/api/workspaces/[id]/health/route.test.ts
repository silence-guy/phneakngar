import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetWorkspaceHealth = vi.fn();
let mockWorkspaceId: string | null = "w1";

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(async () => ({ env: { DB: {} } })),
}));

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

vi.mock("@/lib/services/workspace-health", () => ({
  getWorkspaceHealth: (...args: unknown[]) => mockGetWorkspaceHealth(...args),
}));

vi.mock("@/lib/middleware/auth", () => ({
  withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => {
    const params = ctx?.params instanceof Promise ? await ctx.params : ctx?.params;
    return handler(req, { env: {}, userId: "u1", email: "u@t.com", params });
  }),
}));

vi.mock("@/lib/middleware/helpers", async () =>
  await import("@/lib/middleware/helpers")
);

vi.mock("@/lib/middleware/workspace", async () => {
  const real = await import("@/lib/middleware/workspace");
  return {
    ...real,
    withWorkspaceMember: vi.fn(async () => {
      if (!mockWorkspaceId) {
        const { NextResponse } = await import("next/server");
        return NextResponse.json({ error: "workspace_id is required" }, { status: 400 });
      }
      return { workspaceId: mockWorkspaceId };
    }),
  };
});

import { GET } from "./route";

function getReq(workspaceId = "w1") {
  return new NextRequest(`http://localhost/api/workspaces/${workspaceId}/health?workspace_id=${workspaceId}`, {
    method: "GET",
  });
}

describe("GET /api/workspaces/[id]/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkspaceId = "w1";
    mockGetWorkspaceHealth.mockResolvedValue({ status: "ok", checks: {}, issues: [] });
  });

  it("returns workspace health for the scoped member workspace", async () => {
    const res = await GET(getReq("w1"), { params: Promise.resolve({ id: "w1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(mockGetWorkspaceHealth).toHaveBeenCalledWith(
      {},
      "w1",
      expect.objectContaining({
        gatewayEnv: expect.objectContaining({
          GATEWAY_TEAM_MAP: undefined,
          GATEWAY_WEBHOOK_SECRET: undefined,
        }),
      }),
    );
  });

  it("returns 404 when path workspace does not match scoped workspace", async () => {
    const res = await GET(getReq("w2"), { params: Promise.resolve({ id: "w2" }) });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("workspace not found");
    expect(mockGetWorkspaceHealth).not.toHaveBeenCalled();
  });

  it("returns workspace middleware errors", async () => {
    mockWorkspaceId = null;

    const res = await GET(getReq("w1"), { params: Promise.resolve({ id: "w1" }) });

    expect(res.status).toBe(400);
    expect(mockGetWorkspaceHealth).not.toHaveBeenCalled();
  });
});
