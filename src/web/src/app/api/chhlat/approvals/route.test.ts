import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ApprovalKind } from "@phneakngar/shared";

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => ({ env: { DB: {} } })),
}));
vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => ({})),
  withD1Retry: vi.fn((fn: () => Promise<any>) => fn()),
}));

const mockCreateApproval = vi.fn();
const mockGetAgent = vi.fn();
const mockGetMachineByChhlat = vi.fn();
const mockInvalidate = vi.fn().mockResolvedValue(undefined);

vi.mock("@phneakngar/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@phneakngar/shared")>();
  return {
    ...actual,
    queries: {
      machine: {
        getMachineByChhlat: (...a: unknown[]) => mockGetMachineByChhlat(...a),
      },
      agent: {
        getAgent: (...a: unknown[]) => mockGetAgent(...a),
      },
      approval: {
        createApproval: (...a: unknown[]) => mockCreateApproval(...a),
      },
    },
  };
});

let injectWorkspaceId: string | undefined = "w1";
vi.mock("@/lib/middleware/auth", () => ({
  withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => {
    const params = ctx?.params instanceof Promise ? await ctx.params : ctx?.params;
    return handler(req, {
      env: {},
      userId: "u1",
      email: "u@t.com",
      authType: injectWorkspaceId ? ("machine" as const) : ("user" as const),
      workspaceId: injectWorkspaceId,
      machineTokenHostname: injectWorkspaceId ? "d1" : undefined,
      params,
    });
  }),
}));

vi.mock("@/lib/api/responses", () => ({
  approvalToResponse: (row: any) => ({
    id: row.id,
    kind: row.kind,
    status: row.status,
    title: row.title,
    summary: row.summary,
    payload: row.payload,
  }),
}));

vi.mock("@/lib/cache", () => ({
  invalidate: (...a: unknown[]) => mockInvalidate(...a),
  cacheKeys: {
    overviewAttention: (ws: string) => `ov_att:${ws}`,
  },
}));

import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  injectWorkspaceId = "w1";
  mockGetMachineByChhlat.mockResolvedValue(null);
  mockGetAgent.mockResolvedValue({ id: "a1", workspaceId: "w1" });
  mockCreateApproval.mockResolvedValue({
    id: "ap_1",
    kind: ApprovalKind.TOOL_ACTION,
    status: "pending",
    title: "Tool: Bash",
    summary: "high_stakes:shell",
    payload: {},
  });
});

function post(body: unknown) {
  return POST(
    new NextRequest("http://localhost/api/chhlat/approvals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    {},
  );
}

describe("POST /api/chhlat/approvals", () => {
  it("403 when no workspace (session token, not a machine token)", async () => {
    injectWorkspaceId = undefined;
    const res = await post({
      chhlat_id: "d1",
      tool_name: "Bash",
      tool_class: "shell",
      request_id: "req_1",
    });
    expect(res.status).toBe(403);
    expect(mockCreateApproval).not.toHaveBeenCalled();
  });

  it("creates tool_action approval for high-stakes control_request pointer", async () => {
    const res = await post({
      chhlat_id: "d1",
      agent_id: "a1",
      tool_name: "Bash",
      tool_class: "shell",
      request_id: "req_1",
      policy_reason: "high_stakes:shell",
      input: { command: "rm -rf /tmp" },
      kind: "outbound_email", // forced to tool_action
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.approval.id).toBe("ap_1");
    expect(body.approval.kind).toBe(ApprovalKind.TOOL_ACTION);

    expect(mockCreateApproval).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        workspaceId: "w1",
        agentId: "a1",
        kind: ApprovalKind.TOOL_ACTION,
        title: "Tool: Bash",
        summary: "high_stakes:shell",
        payload: expect.objectContaining({
          source: "cli_control_request",
          chhlatId: "d1",
          toolName: "Bash",
          toolClass: "shell",
          requestId: "req_1",
          policyReason: "high_stakes:shell",
          input: { command: "rm -rf /tmp" },
        }),
      }),
    );
    expect(mockInvalidate).toHaveBeenCalledWith("ov_att:w1");
  });

  it("404 when agent_id not in workspace", async () => {
    mockGetAgent.mockResolvedValue(null);
    const res = await post({
      chhlat_id: "d1",
      agent_id: "missing",
      tool_name: "Write",
    });
    expect(res.status).toBe(404);
    expect(mockCreateApproval).not.toHaveBeenCalled();
  });

  it("400 when chhlat_id missing", async () => {
    const res = await post({ tool_name: "Write" });
    expect(res.status).toBe(400);
  });

  it("allows create without agent_id", async () => {
    const res = await post({
      chhlat_id: "d1",
      tool_name: "Write",
      tool_class: "write",
      request_id: "r9",
    });
    expect(res.status).toBe(201);
    expect(mockGetAgent).not.toHaveBeenCalled();
    expect(mockCreateApproval).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        agentId: null,
        kind: ApprovalKind.TOOL_ACTION,
      }),
    );
  });
});
