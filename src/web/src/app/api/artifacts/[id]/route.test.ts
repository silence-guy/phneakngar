import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as sharedMock from "@/test/shared-mock";

const mockGetArtifactForOwner = vi.fn();

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => ({ env: { DB: {} } })),
}));

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

vi.mock("@phneakngar/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@phneakngar/shared")>();
  return {
    ...actual,
    queries: {
    artifact: {
      getArtifactForOwner: (...a: unknown[]) => mockGetArtifactForOwner(...a),
      artifactToResponse: (row: any) => ({ id: row.id, filename: row.filename }),
    },
  },
  };
});

vi.mock("@/lib/middleware/auth", () => ({
  withAuth: (handler: any) => async (req: any, ctx?: any) => {
    const params = ctx?.params instanceof Promise ? await ctx.params : ctx?.params;
    return handler(req, { env: {}, userId: "u1", email: "u@t.com", workspaceId: "w1", params });
  },
}));

vi.mock("@/lib/middleware/workspace", () => ({
  withWorkspaceMember: vi.fn(async () => ({ workspaceId: "w1" })),
}));

import { GET } from "./route";

beforeEach(() => vi.clearAllMocks());

describe("GET /api/artifacts/[id]", () => {
  it("returns artifact metadata for machine-token workspace access", async () => {
    mockGetArtifactForOwner.mockResolvedValue({ id: "art_1", agentId: "ag1", filename: "brief.md" });
    const res = await GET(new NextRequest("http://localhost/api/artifacts/art_1?workspace_id=w1"), { params: { id: "art_1" } } as any);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "art_1", filename: "brief.md" });
    expect(mockGetArtifactForOwner).toHaveBeenCalledWith({}, "art_1", "w1", "u1");
  });

  it("returns the same 404 for a same-workspace artifact owned by another user", async () => {
    mockGetArtifactForOwner.mockResolvedValue(null);

    const res = await GET(
      new NextRequest("http://localhost/api/artifacts/art_other?workspace_id=w1"),
      { params: { id: "art_other" } } as any,
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not found" });
    expect(mockGetArtifactForOwner).toHaveBeenCalledWith({}, "art_other", "w1", "u1");
  });
});
