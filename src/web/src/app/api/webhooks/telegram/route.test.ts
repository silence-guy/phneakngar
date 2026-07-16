import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockIngress = vi.fn();
const mockGetCloudflareContext = vi.hoisted(() =>
  vi.fn(() => ({
    env: {
      DB: {},
      GATEWAY_TEAM_MAP: JSON.stringify({
        "telegram:42": { workspaceId: "ws1", agentId: "ag1", userId: "u1" },
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

describe("POST /api/webhooks/telegram", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps telegram message payload through gateway ingress", async () => {
    mockIngress.mockResolvedValue({
      ok: true,
      conversationId: "c1",
      messageId: "m1",
      createdConversation: true,
      taskId: "t1",
    });
    const res = await POST(
      new NextRequest("http://localhost/api/webhooks/telegram", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-gateway-secret": "gateway-secret",
        },
        body: JSON.stringify({ message: { chat: { id: 42 }, text: "hello bot" } }),
      }),
      {},
    );
    expect(res.status).toBe(200);
    expect((await res.json()).provider).toBe("telegram");
    expect(mockIngress).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ provider: "telegram" }),
    );
  });
});
