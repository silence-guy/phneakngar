import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { validateWsConnectionTicket, WS_CHHLAT_TICKET_AUDIENCE } from "@phneakngar/shared";

const mockEnv = {
  WS_SERVICE_SECRET: "ws-service-secret",
};
let mockAuthCtx: any = {
  env: mockEnv,
  userId: "user-1",
  email: "u@test.com",
  authType: "user" as const,
};

vi.mock("@/lib/middleware/auth", () => ({
  withAuth: vi.fn((handler: any) => (req: Request) => handler(req, mockAuthCtx)),
}));

import { GET } from "./route";

describe("GET /api/ws/token", () => {
  beforeEach(() => {
    mockAuthCtx = {
      env: mockEnv,
      userId: "user-1",
      email: "u@test.com",
      authType: "user" as const,
    };
  });

  it("issues a signed ticket without exposing the Better Auth session token", async () => {
    const res = await GET(new NextRequest("http://localhost/api/ws/token"));
    const body = await res.json() as { userId?: string; token?: string; ticket?: string; expiresAt?: string };

    expect(res.status).toBe(200);
    expect(body.userId).toBe("user-1");
    expect(body.token).toBeUndefined();
    expect(body.ticket).toBeTruthy();
    expect(body.expiresAt).toBeTruthy();

    const validation = await validateWsConnectionTicket(mockEnv.WS_SERVICE_SECRET, body.ticket, {
      expectedSubject: "user-1",
    });
    expect(validation.ok).toBe(true);
  });

  it("issues a chhlat-audience ticket for a hostname-bound machine token", async () => {
    mockAuthCtx = {
      env: mockEnv,
      userId: "user-1",
      email: "u@test.com",
      authType: "machine" as const,
      workspaceId: "workspace-1",
      machineTokenHostname: "host-1",
    };

    const res = await GET(new NextRequest("http://localhost/api/ws/token?chhlat_id=host-1"));
    const body = await res.json() as { ticket?: string; chhlatId?: string; workspaceId?: string };

    expect(res.status).toBe(200);
    expect(body.chhlatId).toBe("host-1");
    expect(body.workspaceId).toBe("workspace-1");
    const validation = await validateWsConnectionTicket(mockEnv.WS_SERVICE_SECRET, body.ticket, {
      expectedAudience: WS_CHHLAT_TICKET_AUDIENCE,
      expectedSubject: "user-1",
      expectedWorkspaceId: "workspace-1",
      expectedChhlatId: "host-1",
    });
    expect(validation.ok).toBe(true);
  });

  it("rejects machine ticket requests for a different chhlat_id", async () => {
    mockAuthCtx = {
      env: mockEnv,
      userId: "user-1",
      email: "u@test.com",
      authType: "machine" as const,
      workspaceId: "workspace-1",
      machineTokenHostname: "host-1",
    };

    const res = await GET(new NextRequest("http://localhost/api/ws/token?chhlat_id=host-2"));

    expect(res.status).toBe(403);
  });
});
