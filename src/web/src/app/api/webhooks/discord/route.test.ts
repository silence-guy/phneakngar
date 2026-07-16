import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockIngress = vi.fn();
const mockGetCloudflareContext = vi.hoisted(() =>
  vi.fn(() => ({
    env: {
      DB: {},
      GATEWAY_TEAM_MAP: JSON.stringify({
        "discord:G1": { workspaceId: "ws1", agentId: "ag1", userId: "u1" },
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

describe("POST /api/webhooks/discord", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps guild payload through gateway ingress", async () => {
    mockIngress.mockResolvedValue({
      ok: true,
      conversationId: "c1",
      messageId: "m1",
      createdConversation: false,
      taskId: "t1",
    });
    const res = await POST(
      new NextRequest("http://localhost/api/webhooks/discord", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-gateway-secret": "gateway-secret",
        },
        body: JSON.stringify({ guild_id: "G1", channel_id: "C1", content: "hi" }),
      }),
      {},
    );
    expect(res.status).toBe(200);
    expect((await res.json()).provider).toBe("discord");
    expect(mockIngress).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ provider: "discord" }),
    );
  });
});
