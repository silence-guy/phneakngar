import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as sharedMock from "@/test/shared-mock";

const mockGetArtifactForOwner = vi.fn();
const mockBucketGet = vi.fn();

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => ({
    env: {
      DB: {},
      EMAIL_BUCKET: { get: (...a: unknown[]) => mockBucketGet(...a) },
    },
  })),
}));

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

vi.mock("@phneakngar/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@phneakngar/shared")>();
  return {
    ...actual,
    queries: {
    artifact: { getArtifactForOwner: (...a: unknown[]) => mockGetArtifactForOwner(...a) },
  },
  };
});

vi.mock("@/lib/middleware/auth", () => ({
  withAuth: (handler: any) => async (req: any, ctx?: any) => {
    const params = ctx?.params instanceof Promise ? await ctx.params : ctx?.params;
    return handler(req, { env: { DB: {}, EMAIL_BUCKET: { get: (...a: unknown[]) => mockBucketGet(...a) } }, userId: "u1", email: "u@t.com", params });
  },
}));

vi.mock("@/lib/middleware/workspace", () => ({
  withWorkspaceMember: vi.fn(async () => ({ workspaceId: "w1" })),
}));

import { GET } from "./route";

beforeEach(() => vi.clearAllMocks());

describe("GET /api/artifacts/[id]/thumbnail", () => {
  it("serves thumbnail JPEG with private cache headers", async () => {
    mockGetArtifactForOwner.mockResolvedValue({
      id: "art_1",
      agentId: "ag1",
      thumbnailR2Key: "artifacts/w1/ag1/c1/art_1/thumbnail.jpg",
    });
    mockBucketGet.mockResolvedValue({ body: new Blob([new Uint8Array(100)]).stream() });

    const res = await GET(
      new NextRequest("http://localhost/api/artifacts/art_1/thumbnail?workspace_id=w1"),
      { params: { id: "art_1" } } as any,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mockGetArtifactForOwner).toHaveBeenCalledWith({}, "art_1", "w1", "u1");
    expect(mockBucketGet).toHaveBeenCalledWith("artifacts/w1/ag1/c1/art_1/thumbnail.jpg");
  });

  it("returns 404 when artifact has no thumbnail", async () => {
    mockGetArtifactForOwner.mockResolvedValue({
      id: "art_1",
      agentId: "ag1",
      thumbnailR2Key: null,
    });

    const res = await GET(
      new NextRequest("http://localhost/api/artifacts/art_1/thumbnail?workspace_id=w1"),
      { params: { id: "art_1" } } as any,
    );

    expect(res.status).toBe(404);
    expect(mockBucketGet).not.toHaveBeenCalled();
  });

  it("returns 404 when artifact not found", async () => {
    mockGetArtifactForOwner.mockResolvedValue(null);

    const res = await GET(
      new NextRequest("http://localhost/api/artifacts/art_missing/thumbnail?workspace_id=w1"),
      { params: { id: "art_missing" } } as any,
    );

    expect(res.status).toBe(404);
  });

  it("does not fetch R2 for a same-workspace artifact owned by another user", async () => {
    mockGetArtifactForOwner.mockResolvedValue(null);

    const res = await GET(
      new NextRequest("http://localhost/api/artifacts/art_other/thumbnail?workspace_id=w1"),
      { params: { id: "art_other" } } as any,
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not found" });
    expect(mockBucketGet).not.toHaveBeenCalled();
  });
});
