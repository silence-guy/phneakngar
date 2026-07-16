import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockIngress = vi.fn();
const mockGetCloudflareContext = vi.hoisted(() =>
  vi.fn(() => ({
    env: {
      DB: {},
      GATEWAY_TEAM_MAP: JSON.stringify({
        "teams:tenant-guid": { workspaceId: "ws1", agentId: "ag1", userId: "u1" },
      }),
      GATEWAY_WEBHOOK_SECRET: "gateway-secret",
    },
  })),
);

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: mockGetCloudflareContext,
}));
vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("@/lib/services/gateway-ingress", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/gateway-ingress")>();
  return {
    ...actual,
    ingressGatewayMessage: (...a: unknown[]) => mockIngress(...a),
  };
});

import { POST } from "./route";

function post(body: unknown, headers?: Record<string, string>) {
  return POST(
    new NextRequest("http://localhost/api/webhooks/teams", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-gateway-secret": "gateway-secret",
        ...headers,
      },
      body: JSON.stringify(body),
    }),
    {},
  );
}

describe("POST /api/webhooks/teams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCloudflareContext.mockReturnValue({
      env: {
        DB: {},
        GATEWAY_TEAM_MAP: JSON.stringify({
          "teams:tenant-guid": { workspaceId: "ws1", agentId: "ag1", userId: "u1" },
        }),
        GATEWAY_WEBHOOK_SECRET: "gateway-secret",
      },
    });
  });

  it("returns 401 when secret mismatches", async () => {
    const res = await post(
      { tenant_id: "tenant-guid", text: "hello" },
      { "x-gateway-secret": "wrong" },
    );
    expect(res.status).toBe(401);
    expect(mockIngress).not.toHaveBeenCalled();
  });

  it("forwards provider teams to ingress", async () => {
    mockIngress.mockResolvedValue({
      ok: true,
      conversationId: "c1",
      messageId: "m1",
      createdConversation: false,
      taskId: null,
    });
    const res = await post({
      tenant_id: "tenant-guid",
      text: "hello teams",
      conversation: { id: "19:chan@thread.tacv2" },
    });
    expect(res.status).toBe(200);
    expect(mockIngress).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ provider: "teams" }),
    );
  });
});
