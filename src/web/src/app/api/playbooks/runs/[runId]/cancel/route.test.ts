import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockCancelPlaybookRun = vi.fn();

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => ({ env: { DB: {} } })),
}));

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

vi.mock("@/lib/services/playbook-engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/playbook-engine")>();
  return {
    ...actual,
    cancelPlaybookRun: (...a: unknown[]) => mockCancelPlaybookRun(...a),
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

import { POST } from "./route";
import { PlaybookEngineError } from "@/lib/services/playbook-engine";

beforeEach(() => vi.clearAllMocks());

const ctx = { params: { runId: "pbr1" } } as any;

describe("POST /api/playbooks/runs/[runId]/cancel", () => {
  it("cancels the run", async () => {
    mockCancelPlaybookRun.mockResolvedValue({ id: "pbr1", status: "cancelled" });
    const res = await POST(
      new NextRequest("http://localhost/api/playbooks/runs/pbr1/cancel", { method: "POST" }),
      ctx,
    );
    expect(res.status).toBe(200);
    expect(mockCancelPlaybookRun).toHaveBeenCalledWith({}, "w1", "pbr1");
    const body = await res.json();
    expect(body.run.status).toBe("cancelled");
  });

  it("404 when the run is missing", async () => {
    mockCancelPlaybookRun.mockRejectedValue(new PlaybookEngineError("run not found", "NOT_FOUND"));
    const res = await POST(
      new NextRequest("http://localhost/api/playbooks/runs/pbr1/cancel", { method: "POST" }),
      ctx,
    );
    expect(res.status).toBe(404);
  });
});
