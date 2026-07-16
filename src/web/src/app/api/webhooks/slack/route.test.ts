import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockIngress = vi.fn();
const mockGetCloudflareContext = vi.hoisted(() =>
  vi.fn(() => ({
    env: {
      DB: {},
      GATEWAY_TEAM_MAP: JSON.stringify({
        "slack:T1": { workspaceId: "ws1", agentId: "ag1", userId: "u1" },
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
    new NextRequest("http://localhost/api/webhooks/slack", {
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

describe("POST /api/webhooks/slack", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCloudflareContext.mockReturnValue({
      env: {
        DB: {},
        GATEWAY_TEAM_MAP: JSON.stringify({
          "slack:T1": { workspaceId: "ws1", agentId: "ag1", userId: "u1" },
        }),
        GATEWAY_WEBHOOK_SECRET: "gateway-secret",
      },
    });
  });

  it("returns 503 when map is set without secret", async () => {
    mockGetCloudflareContext.mockReturnValue({
      env: {
        DB: {},
        GATEWAY_TEAM_MAP: JSON.stringify({
          "slack:T1": { workspaceId: "ws1", agentId: "ag1", userId: "u1" },
        }),
      },
    });
    const res = await post({ team_id: "T1", text: "hello" });
    expect(res.status).toBe(503);
    expect(mockIngress).not.toHaveBeenCalled();
  });

  it("returns 401 when secret mismatches", async () => {
    const res = await post(
      { team_id: "T1", text: "hello" },
      { "x-gateway-secret": "wrong" },
    );
    expect(res.status).toBe(401);
    expect(mockIngress).not.toHaveBeenCalled();
  });

  it("returns 404 when mapping rejects unknown team", async () => {
    mockIngress.mockResolvedValue({
      ok: false,
      status: 404,
      error: "unknown workspace mapping",
    });
    const res = await post({ team_id: "T-unknown", text: "hello" });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "unknown workspace mapping" });
  });

  it("creates conversation when team is mapped", async () => {
    mockIngress.mockResolvedValue({
      ok: true,
      conversationId: "conv1",
      messageId: "msg1",
      createdConversation: true,
      taskId: "t1",
    });
    const res = await post({ team_id: "T1", channel_id: "C1", text: "hello" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      provider: "slack",
      conversation_id: "conv1",
      message_id: "msg1",
      created_conversation: true,
      task_id: "t1",
    });
    expect(mockIngress).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        provider: "slack",
        body: { team_id: "T1", channel_id: "C1", text: "hello" },
        teamMapRaw: expect.stringContaining("slack:T1"),
      }),
    );
  });

  it("returns 400 for invalid JSON body", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/webhooks/slack", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-gateway-secret": "gateway-secret",
        },
        body: "{not-json",
      }),
      {},
    );
    expect(res.status).toBe(400);
  });
});
