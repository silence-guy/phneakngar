import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockPropose = vi.fn();

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => ({ env: { DB: {} } })),
}));

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

vi.mock("@/lib/middleware/auth", () => ({
  withAuth: (handler: any) => async (req: any, ctx?: any) => {
    const params = ctx?.params instanceof Promise ? await ctx.params : ctx?.params;
    return handler(req, { env: { DB: {} }, userId: "u1", email: "u@t.com", params });
  },
}));

vi.mock("@/lib/middleware/workspace", () => ({
  withWorkspaceMember: vi.fn(async () => ({ workspaceId: "w1" })),
}));

vi.mock("@/lib/api/responses", () => ({
  approvalToResponse: (row: any) => ({
    id: row.id,
    status: row.status,
    kind: row.kind,
    title: row.title,
  }),
}));

vi.mock("@/lib/cache", () => ({
  invalidate: vi.fn().mockResolvedValue(undefined),
  cacheKeys: {
    overviewAttention: (ws: string) => `ov_att:${ws}`,
  },
}));

vi.mock("@/lib/services/skill-proposal", () => ({
  proposeSkillFromCompletedTask: (...a: unknown[]) => mockPropose(...a),
}));

import { POST } from "./route";

beforeEach(() => vi.clearAllMocks());

describe("POST /api/skills/proposals", () => {
  it("returns approval + proposal on success", async () => {
    mockPropose.mockResolvedValue({
      ok: true,
      reused: false,
      proposal: {
        name: "deploy-helper",
        description: "Deploy helper",
        source_trace_id: "trace_1",
      },
      approval: {
        id: "ap_1",
        status: "pending",
        kind: "skill_install",
        title: "deploy-helper",
      },
    });

    const res = await POST(
      new NextRequest("http://localhost/api/skills/proposals?workspace_id=w1", {
        method: "POST",
        body: JSON.stringify({ task_id: "task_1" }),
        headers: { "content-type": "application/json" },
      }),
      {} as any,
    );

    expect(res.status).toBe(200);
    expect(mockPropose).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        workspaceId: "w1",
        userId: "u1",
        task_id: "task_1",
      }),
    );
    const body = await res.json();
    expect(body.approval.id).toBe("ap_1");
    expect(body.proposal.name).toBe("deploy-helper");
    expect(body.reused).toBe(false);
  });

  it("returns existing approval when reused", async () => {
    mockPropose.mockResolvedValue({
      ok: true,
      reused: true,
      proposal: {
        name: "deploy-helper",
        description: "Deploy helper",
        source_trace_id: "trace_1",
      },
      approval: {
        id: "ap_existing",
        status: "pending",
        kind: "skill_install",
        title: "deploy-helper",
      },
    });

    const res = await POST(
      new NextRequest("http://localhost/api/skills/proposals?workspace_id=w1", {
        method: "POST",
        body: JSON.stringify({ task_id: "task_1" }),
        headers: { "content-type": "application/json" },
      }),
      {} as any,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reused).toBe(true);
    expect(body.approval.id).toBe("ap_existing");
  });

  it("maps service 404", async () => {
    mockPropose.mockResolvedValue({
      ok: false,
      status: 404,
      error: "task not found",
    });
    const res = await POST(
      new NextRequest("http://localhost/api/skills/proposals?workspace_id=w1", {
        method: "POST",
        body: JSON.stringify({ task_id: "missing" }),
        headers: { "content-type": "application/json" },
      }),
      {} as any,
    );
    expect(res.status).toBe(404);
  });

  it("maps service 422 for incomplete task", async () => {
    mockPropose.mockResolvedValue({
      ok: false,
      status: 422,
      error: "task must be completed before proposing a skill",
    });
    const res = await POST(
      new NextRequest("http://localhost/api/skills/proposals?workspace_id=w1", {
        method: "POST",
        body: JSON.stringify({ task_id: "task_1" }),
        headers: { "content-type": "application/json" },
      }),
      {} as any,
    );
    expect(res.status).toBe(422);
  });

  it("returns 400 on invalid body", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/skills/proposals?workspace_id=w1", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "content-type": "application/json" },
      }),
      {} as any,
    );
    expect(res.status).toBe(400);
    expect(mockPropose).not.toHaveBeenCalled();
  });

  it("forwards optional agent_id and runtime", async () => {
    mockPropose.mockResolvedValue({
      ok: true,
      reused: false,
      proposal: {
        name: "review-pr",
        description: "Review PR",
        source_trace_id: "task_1",
      },
      approval: {
        id: "ap_2",
        status: "pending",
        kind: "skill_install",
        title: "review-pr",
      },
    });

    const res = await POST(
      new NextRequest("http://localhost/api/skills/proposals?workspace_id=w1", {
        method: "POST",
        body: JSON.stringify({
          task_id: "task_1",
          agent_id: "ag_override",
          runtime: "codex",
        }),
        headers: { "content-type": "application/json" },
      }),
      {} as any,
    );

    expect(res.status).toBe(200);
    expect(mockPropose).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        workspaceId: "w1",
        userId: "u1",
        task_id: "task_1",
        agent_id: "ag_override",
        runtime: "codex",
      }),
    );
  });

  it("rejects invalid runtime enum", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/skills/proposals?workspace_id=w1", {
        method: "POST",
        body: JSON.stringify({ task_id: "task_1", runtime: "mystery" }),
        headers: { "content-type": "application/json" },
      }),
      {} as any,
    );
    expect(res.status).toBe(400);
    expect(mockPropose).not.toHaveBeenCalled();
  });
});
