import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockListPlaybookRuns = vi.fn();
const mockStartPlaybookRun = vi.fn();

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => ({ env: { DB: {} } })),
}));

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("@/lib/email-domain", () => ({ resolveServerEmailDomain: vi.fn(() => "test.dev") }));

vi.mock("@phneakngar/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@phneakngar/shared")>();
  return {
    ...actual,
    queries: {
      playbookRun: {
        listPlaybookRuns: (...a: unknown[]) => mockListPlaybookRuns(...a),
      },
    },
  };
});

vi.mock("@/lib/services/playbook-engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/playbook-engine")>();
  return {
    ...actual,
    startPlaybookRun: (...a: unknown[]) => mockStartPlaybookRun(...a),
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
}));

import { GET, POST } from "./route";
import { PlaybookEngineError } from "@/lib/services/playbook-engine";

beforeEach(() => vi.clearAllMocks());

const ctx = { params: { id: "pb1" } } as any;

describe("GET /api/playbooks/[id]/runs", () => {
  it("lists runs for the playbook", async () => {
    mockListPlaybookRuns.mockResolvedValue([{ id: "pbr1", status: "completed" }]);
    const res = await GET(new NextRequest("http://localhost/api/playbooks/pb1/runs"), ctx);
    expect(res.status).toBe(200);
    expect(mockListPlaybookRuns).toHaveBeenCalledWith({}, "w1", { playbookId: "pb1" });
    const body = await res.json();
    expect(body.items).toHaveLength(1);
  });
});

describe("POST /api/playbooks/[id]/runs", () => {
  it("starts a run", async () => {
    mockStartPlaybookRun.mockResolvedValue({ id: "pbr1", status: "running" });
    const res = await POST(
      new NextRequest("http://localhost/api/playbooks/pb1/runs", {
        method: "POST",
        body: JSON.stringify({ agent_id: "a1", input: { version: "1.0.0" } }),
      }),
      ctx,
    );
    expect(res.status).toBe(201);
    expect(mockStartPlaybookRun).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        workspaceId: "w1",
        playbookId: "pb1",
        agentId: "a1",
        startedByUserId: "u1",
      }),
    );
  });

  it("maps NOT_FOUND engine errors to 404", async () => {
    mockStartPlaybookRun.mockRejectedValue(new PlaybookEngineError("playbook not found", "NOT_FOUND"));
    const res = await POST(
      new NextRequest("http://localhost/api/playbooks/pb1/runs", {
        method: "POST",
        body: JSON.stringify({ agent_id: "a1" }),
      }),
      ctx,
    );
    expect(res.status).toBe(404);
  });

  it("maps invalid-state engine errors to 400", async () => {
    mockStartPlaybookRun.mockRejectedValue(new PlaybookEngineError("playbook is not published"));
    const res = await POST(
      new NextRequest("http://localhost/api/playbooks/pb1/runs", {
        method: "POST",
        body: JSON.stringify({ agent_id: "a1" }),
      }),
      ctx,
    );
    expect(res.status).toBe(400);
  });

  it("rejects invalid bodies", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/playbooks/pb1/runs", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      ctx,
    );
    expect(res.status).toBe(400);
    expect(mockStartPlaybookRun).not.toHaveBeenCalled();
  });

  it("rejects input with non-scalar values or excessive size", async () => {
    const nested = await POST(
      new NextRequest("http://localhost/api/playbooks/pb1/runs", {
        method: "POST",
        body: JSON.stringify({ agent_id: "a1", input: { nested: { deep: 1 } } }),
      }),
      ctx,
    );
    expect(nested.status).toBe(400);

    const tooManyKeys = Object.fromEntries(
      Array.from({ length: 51 }, (_, i) => [`k${i}`, "v"]),
    );
    const res = await POST(
      new NextRequest("http://localhost/api/playbooks/pb1/runs", {
        method: "POST",
        body: JSON.stringify({ agent_id: "a1", input: tooManyKeys }),
      }),
      ctx,
    );
    expect(res.status).toBe(400);
    expect(mockStartPlaybookRun).not.toHaveBeenCalled();
  });
});
