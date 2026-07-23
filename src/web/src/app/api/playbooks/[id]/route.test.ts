import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetPlaybook = vi.fn();
const mockUpdatePlaybook = vi.fn();
const mockDeletePlaybook = vi.fn();
const mockGetAgent = vi.fn();

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => ({ env: { DB: {} } })),
}));

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

vi.mock("@phneakngar/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@phneakngar/shared")>();
  return {
    ...actual,
    queries: {
      playbook: {
        getPlaybook: (...a: unknown[]) => mockGetPlaybook(...a),
        updatePlaybook: (...a: unknown[]) => mockUpdatePlaybook(...a),
        deletePlaybook: (...a: unknown[]) => mockDeletePlaybook(...a),
      },
      agent: {
        getAgent: (...a: unknown[]) => mockGetAgent(...a),
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
  playbookToResponse: (row: any) => ({ id: row.id, title: row.title, version: row.version }),
}));

import { GET, PATCH, DELETE } from "./route";

beforeEach(() => vi.clearAllMocks());

const ctx = { params: { id: "pb1" } } as any;

describe("GET /api/playbooks/[id]", () => {
  it("returns the playbook", async () => {
    mockGetPlaybook.mockResolvedValue({ id: "pb1", title: "T", version: 1 });
    const res = await GET(new NextRequest("http://localhost/api/playbooks/pb1"), ctx);
    expect(res.status).toBe(200);
    expect(mockGetPlaybook).toHaveBeenCalledWith({}, "pb1", "w1");
  });

  it("404 for another workspace's playbook", async () => {
    mockGetPlaybook.mockResolvedValue(null);
    const res = await GET(new NextRequest("http://localhost/api/playbooks/pb1"), ctx);
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/playbooks/[id]", () => {
  it("bumps version when editing a published definition", async () => {
    mockGetPlaybook.mockResolvedValue({
      id: "pb1",
      title: "T",
      status: "published",
      version: 3,
      definition: [{ id: "s1", kind: "agent", title: "S", prompt: "p" }],
    });
    mockUpdatePlaybook.mockResolvedValue({ id: "pb1", title: "T", version: 4 });
    const res = await PATCH(
      new NextRequest("http://localhost/api/playbooks/pb1", {
        method: "PATCH",
        body: JSON.stringify({
          definition: [{ id: "s1", kind: "agent", title: "S2", prompt: "p2" }],
        }),
      }),
      ctx,
    );
    expect(res.status).toBe(200);
    expect(mockUpdatePlaybook).toHaveBeenCalledWith(
      {},
      "pb1",
      "w1",
      expect.objectContaining({ version: 4 }),
    );
  });

  it("does not bump version for drafts", async () => {
    mockGetPlaybook.mockResolvedValue({
      id: "pb1",
      title: "T",
      status: "draft",
      version: 1,
      definition: [{ id: "s1", kind: "agent", title: "S", prompt: "p" }],
    });
    mockUpdatePlaybook.mockResolvedValue({ id: "pb1", title: "T2", version: 1 });
    const res = await PATCH(
      new NextRequest("http://localhost/api/playbooks/pb1", {
        method: "PATCH",
        body: JSON.stringify({ title: "T2" }),
      }),
      ctx,
    );
    expect(res.status).toBe(200);
    const patch = mockUpdatePlaybook.mock.calls[0][3];
    expect(patch.version).toBeUndefined();
  });

  it("rejects empty patches", async () => {
    const res = await PATCH(
      new NextRequest("http://localhost/api/playbooks/pb1", {
        method: "PATCH",
        body: JSON.stringify({}),
      }),
      ctx,
    );
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/playbooks/[id]", () => {
  it("deletes and returns 204", async () => {
    mockDeletePlaybook.mockResolvedValue({ id: "pb1" });
    const res = await DELETE(new NextRequest("http://localhost/api/playbooks/pb1"), ctx);
    expect(res.status).toBe(204);
  });

  it("404 when missing", async () => {
    mockDeletePlaybook.mockResolvedValue(null);
    const res = await DELETE(new NextRequest("http://localhost/api/playbooks/pb1"), ctx);
    expect(res.status).toBe(404);
  });
});
