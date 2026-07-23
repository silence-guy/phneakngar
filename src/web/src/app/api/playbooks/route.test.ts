import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockListPlaybooks = vi.fn();
const mockCreatePlaybook = vi.fn();
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
        listPlaybooks: (...a: unknown[]) => mockListPlaybooks(...a),
        createPlaybook: (...a: unknown[]) => mockCreatePlaybook(...a),
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
  playbookToResponse: (row: any) => ({ id: row.id, title: row.title, status: row.status }),
}));

import { GET, POST } from "./route";

beforeEach(() => vi.clearAllMocks());

const validDefinition = [{ id: "s1", kind: "agent", title: "Step", prompt: "do it" }];

describe("GET /api/playbooks", () => {
  it("lists workspace playbooks with filters", async () => {
    mockListPlaybooks.mockResolvedValue([{ id: "pb1", title: "T", status: "draft" }]);
    const res = await GET(
      new NextRequest("http://localhost/api/playbooks?agent_id=a1&status=published"),
      {} as any,
    );
    expect(res.status).toBe(200);
    expect(mockListPlaybooks).toHaveBeenCalledWith({}, "w1", {
      agentId: "a1",
      status: "published",
    });
    const body = await res.json();
    expect(body.items).toHaveLength(1);
  });
});

describe("POST /api/playbooks", () => {
  it("creates a playbook", async () => {
    mockCreatePlaybook.mockResolvedValue({ id: "pb1", title: "New", status: "draft" });
    const res = await POST(
      new NextRequest("http://localhost/api/playbooks", {
        method: "POST",
        body: JSON.stringify({ title: "New", definition: validDefinition }),
      }),
      {} as any,
    );
    expect(res.status).toBe(201);
    expect(mockCreatePlaybook).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ workspaceId: "w1", title: "New", createdByUserId: "u1" }),
    );
  });

  it("rejects an invalid definition", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/playbooks", {
        method: "POST",
        body: JSON.stringify({ title: "New", definition: [] }),
      }),
      {} as any,
    );
    expect(res.status).toBe(400);
    expect(mockCreatePlaybook).not.toHaveBeenCalled();
  });

  it("rejects an agent outside the workspace", async () => {
    mockGetAgent.mockResolvedValue(null);
    const res = await POST(
      new NextRequest("http://localhost/api/playbooks", {
        method: "POST",
        body: JSON.stringify({ title: "New", agent_id: "aX", definition: validDefinition }),
      }),
      {} as any,
    );
    expect(res.status).toBe(404);
    expect(mockCreatePlaybook).not.toHaveBeenCalled();
  });
});
