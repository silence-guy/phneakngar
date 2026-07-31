import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetAgent = vi.fn();
const mockGetMember = vi.fn();
const mockCreateBinding = vi.fn();
const mockWithWorkspaceOwner = vi.fn();
const mockWithWorkspaceMember = vi.fn();
/** Env handed to the route handler; a test can drop ENCRYPTION_KEY from it. */
let handlerEnv: Record<string, unknown> = { DB: {}, ENCRYPTION_KEY: "test-key" };

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => ({ env: { DB: {}, ENCRYPTION_KEY: "test-key" } })),
}));
vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

vi.mock("@phneakngar/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@phneakngar/shared")>();
  return {
    ...actual,
    queries: {
      agent: { getAgent: (...a: unknown[]) => mockGetAgent(...a) },
      member: { getMemberByUserAndWorkspace: (...a: unknown[]) => mockGetMember(...a) },
      gatewayBinding: {
        listGatewayBindings: vi.fn(async () => []),
        createGatewayBinding: (...a: unknown[]) => mockCreateBinding(...a),
      },
    },
  };
});

vi.mock("@/lib/middleware/auth", () => ({
  withAuth: vi.fn((handler: never) => async (req: never, ctx?: never) =>
    (handler as unknown as (r: unknown, c: unknown) => unknown)(req, {
      env: handlerEnv,
      userId: "u1",
      email: "u@t.com",
      params: (ctx as { params?: unknown } | undefined)?.params,
    }),
  ),
}));

vi.mock("@/lib/middleware/workspace", () => ({
  withWorkspaceOwner: (...a: unknown[]) => mockWithWorkspaceOwner(...a),
  withWorkspaceMember: (...a: unknown[]) => mockWithWorkspaceMember(...a),
}));

vi.mock("@/lib/middleware/helpers", () => {
  const { NextResponse } = require("next/server");
  return {
    writeJSON: (data: unknown, status = 200) => NextResponse.json(data, { status }),
    writeError: (message: string, status: number) =>
      NextResponse.json({ error: message }, { status }),
    parseBody: async (req: Request, schema: { parse: (d: unknown) => unknown }) => {
      try {
        return [schema.parse(await req.json()), null];
      } catch {
        return [null, NextResponse.json({ error: "invalid request body" }, { status: 400 })];
      }
    },
  };
});

vi.mock("@/lib/services/gateway-live-outbound", () => ({
  outboundModeBadge: (m: string) => m,
}));

import { POST } from "./route";
import { readGatewaySecret } from "@phneakngar/shared/gateway-secret";

const ROW = {
  id: "gb1",
  workspaceId: "w1",
  provider: "telegram",
  externalTeamId: "42",
  externalAccountId: null,
  agentId: "a1",
  userId: "u1",
  status: "active",
  dmPolicy: "open",
  outboundMode: "live",
  secretRef: "sealed",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function post(body: unknown) {
  return POST(
    new NextRequest("http://localhost/api/gateway/bindings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }) as never,
    {} as never,
  );
}

const VALID = {
  provider: "telegram",
  external_team_id: "42",
  agent_id: "a1",
  secret_ref: "1234567890:AAreal-telegram-bot-token",
};

beforeEach(() => {
  vi.clearAllMocks();
  handlerEnv = { DB: {}, ENCRYPTION_KEY: "test-key" };
  mockWithWorkspaceOwner.mockResolvedValue({ workspaceId: "w1", memberRole: "owner" });
  mockGetAgent.mockResolvedValue({ id: "a1", ownerId: "u1" });
  mockGetMember.mockResolvedValue({ userId: "u1", role: "owner" });
  mockCreateBinding.mockResolvedValue(ROW);
});

describe("POST /api/gateway/bindings", () => {
  it("requires workspace owner, not just membership", async () => {
    // A binding is the trust anchor inbound webhooks route on and vaults a live bot token,
    // so a plain member must not be able to create one.
    const { NextResponse } = await import("next/server");
    mockWithWorkspaceOwner.mockResolvedValue(
      NextResponse.json({ error: "owner access required" }, { status: 403 }),
    );

    const res = await post(VALID);

    expect(res.status).toBe(403);
    expect(mockCreateBinding).not.toHaveBeenCalled();
  });

  it("encrypts secret_ref before it reaches the database", async () => {
    const res = await post(VALID);

    expect(res.status).toBe(201);
    const written = mockCreateBinding.mock.calls[0]![1] as { secretRef: string };
    expect(written.secretRef).toBeTruthy();
    expect(written.secretRef).not.toBe(VALID.secret_ref);
    expect(written.secretRef).not.toContain("AAreal-telegram-bot-token");
    // And it must round-trip back to the original token at point of use.
    expect(readGatewaySecret(written.secretRef, "test-key")).toBe(VALID.secret_ref);
  });

  it("stores null when no secret is supplied", async () => {
    await post({ provider: "telegram", external_team_id: "42", agent_id: "a1" });

    const written = mockCreateBinding.mock.calls[0]![1] as { secretRef: string | null };
    expect(written.secretRef).toBeNull();
  });

  it("never returns secret_ref in the response, only has_secret", async () => {
    const res = await post(VALID);
    const body = await res.json();

    expect(body.binding.has_secret).toBe(true);
    expect(body.binding).not.toHaveProperty("secret_ref");
    expect(body.binding).not.toHaveProperty("secretRef");
    expect(JSON.stringify(body)).not.toContain("AAreal-telegram-bot-token");
  });

  it("fails closed when a secret is supplied but encryption is not configured", async () => {
    // Better to refuse the write than to persist a live bot token as plaintext.
    handlerEnv = { DB: {} };

    const res = await post(VALID);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "encryption not configured" });
    expect(mockCreateBinding).not.toHaveBeenCalled();
  });
});
