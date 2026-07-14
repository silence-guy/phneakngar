import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as sharedMock from "@/test/shared-mock";

const mockGetArtifactForOwner = vi.fn();
const mockBucketGet = vi.fn();
const mockWithWorkspaceMember = vi.fn(async () => ({ workspaceId: "w1" }));

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
    return handler(req, { env: { DB: {}, EMAIL_BUCKET: { get: (...a: unknown[]) => mockBucketGet(...a) } }, userId: "u1", email: "u@t.com", workspaceId: "w1", params });
  },
}));

vi.mock("@/lib/middleware/workspace", () => ({
  withWorkspaceMember: (...args: unknown[]) => mockWithWorkspaceMember(...args),
}));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mockWithWorkspaceMember.mockResolvedValue({ workspaceId: "w1" });
});

describe("GET /api/artifacts/[id]/content", () => {
  it("downloads artifact content for machine-token workspace access", async () => {
    mockGetArtifactForOwner.mockResolvedValue({
      id: "art_1",
      agentId: "ag1",
      r2Key: "artifacts/w1/ag1/c1/art_1/brief.md",
      filename: "brief.md",
      contentType: "text/markdown",
      size: 5,
    });
    mockBucketGet.mockResolvedValue({ body: new Blob(["hello"]).stream() });

    const res = await GET(new NextRequest("http://localhost/api/artifacts/art_1/content?workspace_id=w1"), { params: { id: "art_1" } } as any);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/markdown");
    expect(res.headers.get("Content-Disposition")).toContain("inline;");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await res.text()).toBe("hello");
    expect(mockGetArtifactForOwner).toHaveBeenCalledWith({}, "art_1", "w1", "u1");
    expect(mockBucketGet).toHaveBeenCalledWith("artifacts/w1/ag1/c1/art_1/brief.md");
  });

  it("does not fetch R2 for a same-workspace artifact owned by another user", async () => {
    mockGetArtifactForOwner.mockResolvedValue(null);

    const res = await GET(
      new NextRequest("http://localhost/api/artifacts/art_other/content?workspace_id=w1"),
      { params: { id: "art_other" } } as any,
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not found" });
    expect(mockBucketGet).not.toHaveBeenCalled();
  });

  it("does not fetch R2 for a cross-workspace artifact", async () => {
    mockWithWorkspaceMember.mockResolvedValueOnce({ workspaceId: "w2" });
    mockGetArtifactForOwner.mockResolvedValue(null);

    const res = await GET(
      new NextRequest("http://localhost/api/artifacts/art_other/content?workspace_id=w2"),
      { params: { id: "art_other" } } as any,
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not found" });
    expect(mockGetArtifactForOwner).toHaveBeenCalledWith({}, "art_other", "w2", "u1");
    expect(mockBucketGet).not.toHaveBeenCalled();
  });

  it("forces active content to download as octet-stream", async () => {
    mockGetArtifactForOwner.mockResolvedValue({
      id: "art_1",
      agentId: "ag1",
      r2Key: "artifacts/w1/ag1/c1/art_1/page.html",
      filename: "page.html",
      contentType: "text/html; charset=utf-8",
      size: 29,
    });
    mockBucketGet.mockResolvedValue({ body: new Blob(["<script>alert(1)</script>"]).stream() });

    const res = await GET(new NextRequest("http://localhost/api/artifacts/art_1/content?workspace_id=w1"), { params: { id: "art_1" } } as any);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/octet-stream");
    expect(res.headers.get("Content-Disposition")).toContain("attachment;");
    expect(res.headers.get("Content-Security-Policy")).toBe("sandbox");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("serves non-ASCII filenames with RFC 5987 content disposition", async () => {
    mockGetArtifactForOwner.mockResolvedValue({
      id: "art_1",
      agentId: "ag1",
      r2Key: "artifacts/w1/ag1/c1/art_1/report.pdf",
      filename: "深圳市小汽车增量指标证明文件.pdf",
      contentType: "application/pdf",
      size: 5,
    });
    mockBucketGet.mockResolvedValue({ body: new Blob(["hello"]).stream() });

    const res = await GET(new NextRequest("http://localhost/api/artifacts/art_1/content?workspace_id=w1&download"), { params: { id: "art_1" } } as any);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain("attachment; filename=");
    expect(res.headers.get("Content-Disposition")).toContain("filename*=UTF-8''%E6%B7%B1%E5%9C%B3");
  });
});
