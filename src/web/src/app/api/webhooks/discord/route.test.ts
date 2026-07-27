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
    mockGetCloudflareContext.mockReturnValue({
      env: {
        DB: {},
        GATEWAY_TEAM_MAP: JSON.stringify({
          "discord:G1": { workspaceId: "ws1", agentId: "ag1", userId: "u1" },
        }),
        GATEWAY_WEBHOOK_SECRET: "gateway-secret",
      },
    });
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
  it("returns 503 and never reaches ingress when no secret is configured", async () => {
    // The pre-fix handler only required a secret when GATEWAY_TEAM_MAP was set, so a
    // deployment using the documented D1 gateway_binding path accepted anonymous POSTs.
    mockGetCloudflareContext.mockReturnValue({ env: { DB: {} } });
    const res = await POST(
      new NextRequest("http://localhost/api/webhooks/discord", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ guild_id: "G1", content: "injected instruction" }),
      }),
      {},
    );
    expect(res.status).toBe(503);
    expect(mockIngress).not.toHaveBeenCalled();
  });

  it("returns 401 when the shared secret is absent from an otherwise valid request", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/webhooks/discord", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ guild_id: "G1", content: "hi" }),
      }),
      {},
    );
    expect(res.status).toBe(401);
    expect(mockIngress).not.toHaveBeenCalled();
  });

  it("requires a discord signature once DISCORD_PUBLIC_KEY is configured", async () => {
    // A valid shared secret must not bypass the provider-native check.
    mockGetCloudflareContext.mockReturnValue({
      env: {
        DB: {},
        GATEWAY_WEBHOOK_SECRET: "gateway-secret",
        DISCORD_PUBLIC_KEY: "a".repeat(64),
      },
    });
    const res = await POST(
      new NextRequest("http://localhost/api/webhooks/discord", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-gateway-secret": "gateway-secret",
        },
        body: JSON.stringify({ guild_id: "G1", content: "hi" }),
      }),
      {},
    );
    expect(res.status).toBe(401);
    expect(mockIngress).not.toHaveBeenCalled();
  });

  it("does not forward request headers to ingress (no x-team-id override)", async () => {
    mockIngress.mockResolvedValue({
      ok: true,
      conversationId: "c1",
      messageId: "m1",
      createdConversation: false,
      taskId: "t1",
    });
    await POST(
      new NextRequest("http://localhost/api/webhooks/discord", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-gateway-secret": "gateway-secret",
          "x-team-id": "victim-guild",
        },
        body: JSON.stringify({ guild_id: "G1", content: "hi" }),
      }),
      {},
    );
    const arg = mockIngress.mock.calls[0][1] as Record<string, unknown>;
    expect(arg).not.toHaveProperty("headers");
  });
});
