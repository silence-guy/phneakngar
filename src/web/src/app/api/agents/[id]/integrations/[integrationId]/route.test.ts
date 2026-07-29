import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetAgent = vi.fn();
const mockDelete = vi.fn();

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => ({ env: { DB: {} } })),
}));
vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

vi.mock("@phneakngar/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@phneakngar/shared")>();
  return {
    ...actual,
    queries: {
      agent: { getAgent: (...a: unknown[]) => mockGetAgent(...a) },
      agentIntegration: {
        deleteIntegration: (...a: unknown[]) => mockDelete(...a),
      },
    },
  };
});

vi.mock("@/lib/middleware/auth", () => ({
  withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => {
    const params = ctx?.params instanceof Promise ? await ctx.params : ctx?.params;
    return handler(req, {
      env: { DB: {} },
      userId: "u1",
      email: "u@t.com",
      params,
    });
  }),
}));

vi.mock("@/lib/middleware/workspace", () => ({
  withWorkspaceMember: vi.fn(async () => ({ workspaceId: "w1" })),
}));

import { DELETE } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAgent.mockResolvedValue({ id: "a1", ownerId: "u1" });
});

describe("DELETE /api/agents/[id]/integrations/[integrationId]", () => {
  function del(params: Record<string, string> = { id: "a1", integrationId: "ai_1" }) {
    return DELETE(
      new NextRequest("http://localhost/api/agents/a1/integrations/ai_1", {
        method: "DELETE",
      }),
      { params }
    );
  }

  it("deletes scoped integration", async () => {
    mockDelete.mockResolvedValue({ id: "ai_1" });
    const res = await del();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockDelete).toHaveBeenCalledWith({}, "ai_1", "w1", "a1");
  });

  it("400 when params missing", async () => {
    const res = await del({ id: "a1" } as any);
    expect(res.status).toBe(400);
  });

  it("404 when agent not found", async () => {
    mockGetAgent.mockResolvedValue(null);
    const res = await del();
    expect(res.status).toBe(404);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("404 when integration not found", async () => {
    mockDelete.mockResolvedValue(null);
    const res = await del();
    expect(res.status).toBe(404);
  });
});
