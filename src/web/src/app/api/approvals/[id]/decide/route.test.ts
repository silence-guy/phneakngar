import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetApproval = vi.fn();
const mockDecideApproval = vi.fn();
const mockGetEmailById = vi.fn();
const mockMarkRejected = vi.fn();
const mockReleaseFromApproval = vi.fn();
const mockGetAgent = vi.fn();
const mockSendReleased = vi.fn();
const mockInstallAgentSkill = vi.fn();
const mockCreateMessageIfAbsent = vi.fn();

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => ({ env: { DB: {}, PHNEAKNGAR_DOMAIN: "agents.example" } })),
}));

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

vi.mock("@/lib/email-domain", () => ({
  resolveServerEmailDomain: vi.fn(() => "agents.example"),
}));

vi.mock("@/lib/outbound-email-dispatch", () => ({
  sendReleasedOutboundEmail: (...args: unknown[]) => mockSendReleased(...args),
}));

vi.mock("@phneakngar/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@phneakngar/shared")>();
  return {
    ...actual,
    queries: {
      approval: {
        getApproval: (...a: unknown[]) => mockGetApproval(...a),
        decideApproval: (...a: unknown[]) => mockDecideApproval(...a),
      },
      email: {
        getEmailById: (...a: unknown[]) => mockGetEmailById(...a),
        markOutboundEmailRejected: (...a: unknown[]) => mockMarkRejected(...a),
        releaseOutboundEmailFromApproval: (...a: unknown[]) => mockReleaseFromApproval(...a),
      },
      agent: {
        getAgent: (...a: unknown[]) => mockGetAgent(...a),
      },
      agentSkill: {
        installAgentSkill: (...a: unknown[]) => mockInstallAgentSkill(...a),
      },
      message: {
        createMessageIfAbsent: (...a: unknown[]) => mockCreateMessageIfAbsent(...a),
      },
    },
  };
});

vi.mock("@/lib/middleware/auth", () => ({
  withAuth: (handler: any) => async (req: any, ctx?: any) => {
    const params = ctx?.params instanceof Promise ? await ctx.params : ctx?.params;
    return handler(req, {
      env: { DB: {}, PHNEAKNGAR_DOMAIN: "agents.example" },
      userId: "u1",
      email: "u@t.com",
      params,
    });
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
    decided_by_user_id: row.decidedByUserId,
  }),
  emailToResponse: (e: any) => ({ id: e.id, status: e.status }),
}));

vi.mock("@/lib/cache", () => ({
  invalidate: vi.fn().mockResolvedValue(undefined),
  cacheKeys: {
    overviewAttention: (ws: string) => `ov_att:${ws}`,
  },
}));

import { POST } from "./route";

beforeEach(() => vi.clearAllMocks());

describe("POST /api/approvals/[id]/decide", () => {
  it("approves pending non-email approval", async () => {
    mockGetApproval.mockResolvedValue({
      id: "ap_1",
      status: "pending",
      kind: "tool_action",
    });
    mockDecideApproval.mockResolvedValue({
      id: "ap_1",
      status: "approved",
      kind: "tool_action",
      decidedByUserId: "u1",
    });

    const res = await POST(
      new NextRequest("http://localhost/api/approvals/ap_1/decide", {
        method: "POST",
        body: JSON.stringify({ decision: "approved" }),
        headers: { "content-type": "application/json" },
      }),
      { params: { id: "ap_1" } } as any,
    );

    expect(res.status).toBe(200);
    expect(mockDecideApproval).toHaveBeenCalledWith({}, "ap_1", "w1", "approved", "u1");
    expect(await res.json()).toEqual({
      approval: {
        id: "ap_1",
        status: "approved",
        kind: "tool_action",
        decided_by_user_id: "u1",
      },
    });
    expect(mockSendReleased).not.toHaveBeenCalled();
  });

  it("returns 409 when already decided", async () => {
    mockGetApproval.mockResolvedValue({
      id: "ap_1",
      status: "approved",
      kind: "tool_action",
    });
    const res = await POST(
      new NextRequest("http://localhost/api/approvals/ap_1/decide", {
        method: "POST",
        body: JSON.stringify({ decision: "rejected" }),
        headers: { "content-type": "application/json" },
      }),
      { params: { id: "ap_1" } } as any,
    );
    expect(res.status).toBe(409);
    expect(mockDecideApproval).not.toHaveBeenCalled();
  });

  it("returns 404 when approval missing", async () => {
    mockGetApproval.mockResolvedValue(null);
    const res = await POST(
      new NextRequest("http://localhost/api/approvals/ap_1/decide", {
        method: "POST",
        body: JSON.stringify({ decision: "rejected" }),
        headers: { "content-type": "application/json" },
      }),
      { params: { id: "ap_1" } } as any,
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 on invalid decision", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/approvals/ap_1/decide", {
        method: "POST",
        body: JSON.stringify({ decision: "maybe" }),
        headers: { "content-type": "application/json" },
      }),
      { params: { id: "ap_1" } } as any,
    );
    expect(res.status).toBe(400);
    expect(mockDecideApproval).not.toHaveBeenCalled();
  });

  it("rejects outbound email before deciding approval", async () => {
    mockGetApproval.mockResolvedValue({
      id: "ap_1",
      kind: "outbound_email",
      status: "pending",
      payload: { emailId: "e1", conversationId: "c1" },
    });
    mockGetEmailById.mockResolvedValue({ id: "e1", status: "pending_approval", agentId: "a1" });
    mockGetAgent.mockResolvedValue({ id: "a1", ownerId: "u1" });
    mockMarkRejected.mockResolvedValue({
      id: "e1",
      status: "rejected",
      subject: "Hi",
      toEmail: "b@example.com",
    });
    mockDecideApproval.mockResolvedValue({
      id: "ap_1",
      kind: "outbound_email",
      status: "rejected",
      decidedByUserId: "u1",
      payload: { emailId: "e1", conversationId: "c1" },
    });
    mockCreateMessageIfAbsent.mockResolvedValue({ message: { id: "email-decision-ap_1" }, created: true });

    const res = await POST(
      new NextRequest("http://localhost/api/approvals/ap_1/decide", {
        method: "POST",
        body: JSON.stringify({ decision: "rejected" }),
        headers: { "content-type": "application/json" },
      }),
      { params: { id: "ap_1" } } as any,
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.email.status).toBe("rejected");
    expect(mockMarkRejected).toHaveBeenCalledWith({}, "e1", "w1");
    expect(mockDecideApproval).toHaveBeenCalledWith({}, "ap_1", "w1", "rejected", "u1");
    expect(mockSendReleased).not.toHaveBeenCalled();
    // Side effect before terminal decide
    expect(mockMarkRejected.mock.invocationCallOrder[0]).toBeLessThan(
      mockDecideApproval.mock.invocationCallOrder[0],
    );
    // Quiet system line for chat timeline (idempotent on approval id)
    expect(mockCreateMessageIfAbsent).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        id: "email-decision-ap_1",
        conversationId: "c1",
        role: "assistant",
        content: expect.stringContaining("rejected"),
      }),
    );
  });

  it("does not decide when reject side effect fails", async () => {
    mockGetApproval.mockResolvedValue({
      id: "ap_1",
      kind: "outbound_email",
      status: "pending",
      payload: { emailId: "e1" },
    });
    mockGetEmailById.mockResolvedValue({ id: "e1", status: "pending_approval", agentId: "a1" });
    mockGetAgent.mockResolvedValue({ id: "a1" });
    mockMarkRejected.mockResolvedValue(null);

    const res = await POST(
      new NextRequest("http://localhost/api/approvals/ap_1/decide", {
        method: "POST",
        body: JSON.stringify({ decision: "rejected" }),
        headers: { "content-type": "application/json" },
      }),
      { params: { id: "ap_1" } } as any,
    );

    expect(res.status).toBe(409);
    expect(mockDecideApproval).not.toHaveBeenCalled();
  });

  it("does not decide when agent ACL fails", async () => {
    mockGetApproval.mockResolvedValue({
      id: "ap_1",
      kind: "outbound_email",
      status: "pending",
      payload: { emailId: "e1" },
    });
    mockGetEmailById.mockResolvedValue({ id: "e1", status: "pending_approval", agentId: "a1" });
    mockGetAgent.mockResolvedValue(null);

    const res = await POST(
      new NextRequest("http://localhost/api/approvals/ap_1/decide", {
        method: "POST",
        body: JSON.stringify({ decision: "approved" }),
        headers: { "content-type": "application/json" },
      }),
      { params: { id: "ap_1" } } as any,
    );

    expect(res.status).toBe(404);
    expect(mockReleaseFromApproval).not.toHaveBeenCalled();
    expect(mockDecideApproval).not.toHaveBeenCalled();
  });

  it("approves outbound email: release then decide then send", async () => {
    mockGetApproval.mockResolvedValue({
      id: "ap_1",
      kind: "outbound_email",
      status: "pending",
      payload: { emailId: "e1", customAccountId: null, conversationId: "c1" },
    });
    mockGetEmailById.mockResolvedValue({ id: "e1", status: "pending_approval", agentId: "a1" });
    mockGetAgent.mockResolvedValue({ id: "a1", ownerId: "u1" });
    mockReleaseFromApproval.mockResolvedValue({
      id: "e1",
      status: "pending",
      agentId: "a1",
      fromEmail: "a@agents.example",
      toEmail: "b@example.com",
      subject: "Hi",
      messageId: "<m@agents.example>",
      r2Key: "emails/x/raw",
    });
    mockDecideApproval.mockResolvedValue({
      id: "ap_1",
      kind: "outbound_email",
      status: "approved",
      decidedByUserId: "u1",
      payload: { emailId: "e1", conversationId: "c1" },
    });
    mockCreateMessageIfAbsent.mockResolvedValue({ message: { id: "email-decision-ap_1" }, created: true });
    mockSendReleased.mockResolvedValue(
      new Response(JSON.stringify({ id: "e1", status: "sent" }), { status: 200 }),
    );

    const res = await POST(
      new NextRequest("http://localhost/api/approvals/ap_1/decide", {
        method: "POST",
        body: JSON.stringify({ decision: "approved" }),
        headers: { "content-type": "application/json" },
      }),
      { params: { id: "ap_1" } } as any,
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.approval.status).toBe("approved");
    expect(body.email.status).toBe("sent");
    expect(mockReleaseFromApproval).toHaveBeenCalledWith({}, "e1", "w1");
    expect(mockSendReleased).toHaveBeenCalledOnce();
    expect(mockReleaseFromApproval.mock.invocationCallOrder[0]).toBeLessThan(
      mockDecideApproval.mock.invocationCallOrder[0],
    );
    expect(mockDecideApproval.mock.invocationCallOrder[0]).toBeLessThan(
      mockSendReleased.mock.invocationCallOrder[0],
    );
    // System approve line before send (sent event comes from outbound finalize)
    expect(mockCreateMessageIfAbsent).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        id: "email-decision-ap_1",
        conversationId: "c1",
        role: "assistant",
        content: expect.stringContaining("approved"),
      }),
    );
    expect(mockCreateMessageIfAbsent.mock.invocationCallOrder[0]).toBeLessThan(
      mockSendReleased.mock.invocationCallOrder[0],
    );
  });

  it("skips system event stamp when outbound email payload has no conversationId", async () => {
    mockGetApproval.mockResolvedValue({
      id: "ap_2",
      kind: "outbound_email",
      status: "pending",
      payload: { emailId: "e2" },
    });
    mockGetEmailById.mockResolvedValue({ id: "e2", status: "pending_approval", agentId: "a1" });
    mockGetAgent.mockResolvedValue({ id: "a1", ownerId: "u1" });
    mockMarkRejected.mockResolvedValue({
      id: "e2",
      status: "rejected",
      subject: "No conv",
      toEmail: "b@example.com",
    });
    mockDecideApproval.mockResolvedValue({
      id: "ap_2",
      kind: "outbound_email",
      status: "rejected",
      decidedByUserId: "u1",
      payload: { emailId: "e2" },
    });

    const res = await POST(
      new NextRequest("http://localhost/api/approvals/ap_2/decide", {
        method: "POST",
        body: JSON.stringify({ decision: "rejected" }),
        headers: { "content-type": "application/json" },
      }),
      { params: { id: "ap_2" } } as any,
    );

    expect(res.status).toBe(200);
    expect(mockCreateMessageIfAbsent).not.toHaveBeenCalled();
  });

  it("does not decide when release fails", async () => {
    mockGetApproval.mockResolvedValue({
      id: "ap_1",
      kind: "outbound_email",
      status: "pending",
      payload: { emailId: "e1" },
    });
    mockGetEmailById.mockResolvedValue({ id: "e1", status: "pending_approval", agentId: "a1" });
    mockGetAgent.mockResolvedValue({ id: "a1" });
    mockReleaseFromApproval.mockResolvedValue(null);

    const res = await POST(
      new NextRequest("http://localhost/api/approvals/ap_1/decide", {
        method: "POST",
        body: JSON.stringify({ decision: "approved" }),
        headers: { "content-type": "application/json" },
      }),
      { params: { id: "ap_1" } } as any,
    );

    expect(res.status).toBe(409);
    expect(mockDecideApproval).not.toHaveBeenCalled();
    expect(mockSendReleased).not.toHaveBeenCalled();
  });

  it("approves skill_install: installs skill then decides", async () => {
    mockGetApproval.mockResolvedValue({
      id: "ap_skill",
      kind: "skill_install",
      status: "pending",
      agentId: "ag_1",
      payload: {
        name: "deploy-helper",
        description: "Deploy apps",
        runtime: "claude",
        agentId: "ag_1",
        source_trace_id: "trace_1",
      },
    });
    mockGetAgent.mockResolvedValue({ id: "ag_1", workspaceId: "w1" });
    mockInstallAgentSkill.mockResolvedValue({
      id: "as_1",
      name: "deploy-helper",
      description: "Deploy apps",
      runtime: "claude",
      agentId: "ag_1",
    });
    mockDecideApproval.mockResolvedValue({
      id: "ap_skill",
      kind: "skill_install",
      status: "approved",
      decidedByUserId: "u1",
    });

    const res = await POST(
      new NextRequest("http://localhost/api/approvals/ap_skill/decide", {
        method: "POST",
        body: JSON.stringify({ decision: "approved" }),
        headers: { "content-type": "application/json" },
      }),
      { params: { id: "ap_skill" } } as any,
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.approval.status).toBe("approved");
    expect(body.skill.name).toBe("deploy-helper");
    expect(mockInstallAgentSkill).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        workspaceId: "w1",
        agentId: "ag_1",
        runtime: "claude",
        name: "deploy-helper",
        description: "Deploy apps",
      }),
    );
    expect(mockInstallAgentSkill.mock.invocationCallOrder[0]).toBeLessThan(
      mockDecideApproval.mock.invocationCallOrder[0],
    );
    expect(mockSendReleased).not.toHaveBeenCalled();
  });

  it("rejects skill_install without installing", async () => {
    mockGetApproval.mockResolvedValue({
      id: "ap_skill",
      kind: "skill_install",
      status: "pending",
      agentId: "ag_1",
      payload: {
        name: "deploy-helper",
        description: "Deploy apps",
        runtime: "claude",
        agentId: "ag_1",
      },
    });
    mockDecideApproval.mockResolvedValue({
      id: "ap_skill",
      kind: "skill_install",
      status: "rejected",
      decidedByUserId: "u1",
    });

    const res = await POST(
      new NextRequest("http://localhost/api/approvals/ap_skill/decide", {
        method: "POST",
        body: JSON.stringify({ decision: "rejected" }),
        headers: { "content-type": "application/json" },
      }),
      { params: { id: "ap_skill" } } as any,
    );

    expect(res.status).toBe(200);
    expect(mockInstallAgentSkill).not.toHaveBeenCalled();
    expect(mockDecideApproval).toHaveBeenCalledWith(
      {},
      "ap_skill",
      "w1",
      "rejected",
      "u1",
    );
  });

  it("does not decide skill_install when agent ACL fails", async () => {
    mockGetApproval.mockResolvedValue({
      id: "ap_skill",
      kind: "skill_install",
      status: "pending",
      agentId: "ag_1",
      payload: {
        name: "deploy-helper",
        description: "Deploy apps",
        runtime: "claude",
        agentId: "ag_1",
      },
    });
    mockGetAgent.mockResolvedValue(null);

    const res = await POST(
      new NextRequest("http://localhost/api/approvals/ap_skill/decide", {
        method: "POST",
        body: JSON.stringify({ decision: "approved" }),
        headers: { "content-type": "application/json" },
      }),
      { params: { id: "ap_skill" } } as any,
    );

    expect(res.status).toBe(404);
    expect(mockInstallAgentSkill).not.toHaveBeenCalled();
    expect(mockDecideApproval).not.toHaveBeenCalled();
  });

  it("returns 409 when skill installed but approval already decided", async () => {
    mockGetApproval.mockResolvedValue({
      id: "ap_skill",
      kind: "skill_install",
      status: "pending",
      agentId: "ag_1",
      payload: {
        name: "deploy-helper",
        description: "Deploy apps",
        runtime: "claude",
        agentId: "ag_1",
      },
    });
    mockGetAgent.mockResolvedValue({ id: "ag_1" });
    mockInstallAgentSkill.mockResolvedValue({
      id: "as_1",
      name: "deploy-helper",
      description: "Deploy apps",
      runtime: "claude",
      agentId: "ag_1",
    });
    mockDecideApproval.mockResolvedValue(null);

    const res = await POST(
      new NextRequest("http://localhost/api/approvals/ap_skill/decide", {
        method: "POST",
        body: JSON.stringify({ decision: "approved" }),
        headers: { "content-type": "application/json" },
      }),
      { params: { id: "ap_skill" } } as any,
    );

    expect(res.status).toBe(409);
    expect(mockInstallAgentSkill).toHaveBeenCalled();
    const body = await res.json();
    expect(body.skill.name).toBe("deploy-helper");
    expect(body.error).toMatch(/already decided/i);
  });

  it("returns 500 when skill_install payload lacks name/runtime/agentId", async () => {
    mockGetApproval.mockResolvedValue({
      id: "ap_skill",
      kind: "skill_install",
      status: "pending",
      agentId: null,
      payload: { description: "incomplete" },
    });

    const res = await POST(
      new NextRequest("http://localhost/api/approvals/ap_skill/decide", {
        method: "POST",
        body: JSON.stringify({ decision: "approved" }),
        headers: { "content-type": "application/json" },
      }),
      { params: { id: "ap_skill" } } as any,
    );

    expect(res.status).toBe(500);
    expect(mockInstallAgentSkill).not.toHaveBeenCalled();
    expect(mockDecideApproval).not.toHaveBeenCalled();
  });

  it("falls back to approval.agentId when payload omits agentId", async () => {
    mockGetApproval.mockResolvedValue({
      id: "ap_skill",
      kind: "skill_install",
      status: "pending",
      agentId: "ag_from_row",
      payload: {
        name: "inbox-triage",
        description: "Triage inbox",
        runtime: "codex",
        source_trace_id: "trace_x",
      },
    });
    mockGetAgent.mockResolvedValue({ id: "ag_from_row", workspaceId: "w1" });
    mockInstallAgentSkill.mockResolvedValue({
      id: "as_2",
      name: "inbox-triage",
      description: "Triage inbox",
      runtime: "codex",
      agentId: "ag_from_row",
    });
    mockDecideApproval.mockResolvedValue({
      id: "ap_skill",
      kind: "skill_install",
      status: "approved",
      decidedByUserId: "u1",
    });

    const res = await POST(
      new NextRequest("http://localhost/api/approvals/ap_skill/decide", {
        method: "POST",
        body: JSON.stringify({ decision: "approved" }),
        headers: { "content-type": "application/json" },
      }),
      { params: { id: "ap_skill" } } as any,
    );

    expect(res.status).toBe(200);
    expect(mockGetAgent).toHaveBeenCalledWith({}, "ag_from_row", "w1", "u1");
    expect(mockInstallAgentSkill).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        workspaceId: "w1",
        agentId: "ag_from_row",
        runtime: "codex",
        name: "inbox-triage",
      }),
    );
  });

  it("loads skill_install approval with workspace scope before decide", async () => {
    mockGetApproval.mockResolvedValue({
      id: "ap_skill",
      kind: "skill_install",
      status: "pending",
      agentId: "ag_1",
      payload: {
        name: "deploy-helper",
        description: "Deploy apps",
        runtime: "claude",
        agentId: "ag_1",
      },
    });
    mockGetAgent.mockResolvedValue({ id: "ag_1" });
    mockInstallAgentSkill.mockResolvedValue({
      id: "as_1",
      name: "deploy-helper",
      description: "Deploy apps",
      runtime: "claude",
      agentId: "ag_1",
    });
    mockDecideApproval.mockResolvedValue({
      id: "ap_skill",
      kind: "skill_install",
      status: "approved",
      decidedByUserId: "u1",
    });

    await POST(
      new NextRequest("http://localhost/api/approvals/ap_skill/decide", {
        method: "POST",
        body: JSON.stringify({ decision: "approved" }),
        headers: { "content-type": "application/json" },
      }),
      { params: { id: "ap_skill" } } as any,
    );

    expect(mockGetApproval).toHaveBeenCalledWith({}, "ap_skill", "w1");
    expect(mockDecideApproval).toHaveBeenCalledWith(
      {},
      "ap_skill",
      "w1",
      "approved",
      "u1",
    );
  });
});
