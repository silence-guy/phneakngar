import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetAgent = vi.fn();
const mockList = vi.fn();
const mockCreate = vi.fn();
const mockToPublic = vi.fn((row: any) => ({
  id: row.id,
  workspace_id: row.workspaceId,
  agent_id: row.agentId,
  provider: row.provider,
  status: row.status,
  config: row.config,
  has_secret: Boolean(row.secretRef),
  created_at: row.createdAt,
  updated_at: row.updatedAt,
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => ({ env: { DB: {} } })),
}));
vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

vi.mock("@phneakngar/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@phneakngar/shared")>();
  return {
    ...actual,
    isUniqueConstraintError: (err: unknown) =>
      err instanceof Error && err.message.includes("UNIQUE"),
    queries: {
      agent: { getAgent: (...a: unknown[]) => mockGetAgent(...a) },
      agentIntegration: {
        listIntegrationsForAgent: (...a: unknown[]) => mockList(...a),
        createIntegration: (...a: unknown[]) => mockCreate(...a),
        toPublicIntegration: (...a: unknown[]) => mockToPublic(...a),
      },
    },
  };
});

vi.mock("@/lib/middleware/auth", () => ({
  withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => {
    const params = ctx?.params instanceof Promise ? await ctx.params : ctx?.params;
    return handler(req, {
      env: { DB: {} },
      userId: "u1",
      email: "u@t.com",
      params,
    });
  }),
}));

vi.mock("@/lib/middleware/workspace", () => ({
  withWorkspaceMember: vi.fn(async () => ({ workspaceId: "w1" })),
}));

import { GET, POST } from "./route";

const ROW = {
  id: "ai_1",
  workspaceId: "w1",
  agentId: "a1",
  provider: "github",
  status: "active",
  config: { repo: "org/repo" },
  secretRef: "raw-secret-must-not-leak",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAgent.mockResolvedValue({ id: "a1", ownerId: "u1" });
});

describe("GET /api/agents/[id]/integrations", () => {
  it("400 when agent id missing", async () => {
    const res = await GET(
      new NextRequest("http://localhost/api/agents/x/integrations"),
      { params: {} }
    );
    expect(res.status).toBe(400);
  });

  it("404 when agent not in workspace", async () => {
    mockGetAgent.mockResolvedValue(null);
    const res = await GET(
      new NextRequest("http://localhost/api/agents/a1/integrations"),
      { params: { id: "a1" } }
    );
    expect(res.status).toBe(404);
    expect(mockList).not.toHaveBeenCalled();
  });

  it("lists integrations and never returns secret_ref/secretRef", async () => {
    mockList.mockResolvedValue([ROW]);
    const res = await GET(
      new NextRequest("http://localhost/api/agents/a1/integrations"),
      { params: { id: "a1" } }
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockList).toHaveBeenCalledWith({}, "w1", "a1");
    expect(mockToPublic).toHaveBeenCalledWith(ROW);
    expect(body.integrations).toHaveLength(1);
    expect(body.integrations[0].provider).toBe("github");
    expect(body.integrations[0].has_secret).toBe(true);
    expect(body.integrations[0]).not.toHaveProperty("secret_ref");
    expect(body.integrations[0]).not.toHaveProperty("secretRef");
    expect(JSON.stringify(body)).not.toContain("raw-secret-must-not-leak");
  });
});

describe("POST /api/agents/[id]/integrations", () => {
  function post(body: unknown, params: Record<string, string> = { id: "a1" }) {
    return POST(
      new NextRequest("http://localhost/api/agents/a1/integrations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      { params }
    );
  }

  it("403 for a non-owner collaborator attaching a secret_ref", async () => {
    mockGetAgent.mockResolvedValue({ id: "a1", ownerId: "someone-else" });
    const res = await post({ provider: "slack", secret_ref: "attacker-token" });
    expect(res.status).toBe(403);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("creates integration and strips secret from response", async () => {
    mockCreate.mockResolvedValue(ROW);
    const res = await post({
      provider: "github",
      config: { repo: "org/repo" },
      secret_ref: "raw-secret-must-not-leak",
    });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        workspaceId: "w1",
        agentId: "a1",
        provider: "github",
        secretRef: "raw-secret-must-not-leak",
      })
    );
    expect(body.has_secret).toBe(true);
    expect(body).not.toHaveProperty("secret_ref");
    expect(body).not.toHaveProperty("secretRef");
    expect(JSON.stringify(body)).not.toContain("raw-secret-must-not-leak");
  });

  it("400 on invalid body", async () => {
    const res = await post({});
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("404 when agent not in workspace", async () => {
    mockGetAgent.mockResolvedValue(null);
    const res = await post({ provider: "github" });
    expect(res.status).toBe(404);
  });

  it("409 when provider already connected", async () => {
    mockCreate.mockRejectedValue(new Error("UNIQUE constraint failed"));
    const res = await post({ provider: "github" });
    expect(res.status).toBe(409);
  });
});
