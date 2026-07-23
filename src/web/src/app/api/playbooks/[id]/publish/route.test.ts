import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetPlaybook = vi.fn();
const mockUpdatePlaybook = vi.fn();

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
  playbookToResponse: (row: any) => ({ id: row.id, status: row.status }),
}));

import { POST } from "./route";

beforeEach(() => vi.clearAllMocks());

const ctx = { params: { id: "pb1" } } as any;

describe("POST /api/playbooks/[id]/publish", () => {
  it("publishes a valid playbook", async () => {
    mockGetPlaybook.mockResolvedValue({
      id: "pb1",
      definition: [{ id: "s1", kind: "agent", title: "S", prompt: "p" }],
    });
    mockUpdatePlaybook.mockResolvedValue({ id: "pb1", status: "published" });
    const res = await POST(new NextRequest("http://localhost/api/playbooks/pb1/publish"), ctx);
    expect(res.status).toBe(200);
    expect(mockUpdatePlaybook).toHaveBeenCalledWith(
      {},
      "pb1",
      "w1",
      expect.objectContaining({ status: "published" }),
    );
  });

  it("rejects publishing an invalid definition", async () => {
    mockGetPlaybook.mockResolvedValue({ id: "pb1", definition: [] });
    const res = await POST(new NextRequest("http://localhost/api/playbooks/pb1/publish"), ctx);
    expect(res.status).toBe(400);
    expect(mockUpdatePlaybook).not.toHaveBeenCalled();
  });

  it("404 when missing", async () => {
    mockGetPlaybook.mockResolvedValue(null);
    const res = await POST(new NextRequest("http://localhost/api/playbooks/pb1/publish"), ctx);
    expect(res.status).toBe(404);
  });
});
