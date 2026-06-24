import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => ({ env: { DB: {} } })),
}));
vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

const mockGetAgent = vi.fn();
const mockGetRuntime = vi.fn();
const mockGetSkills = vi.fn();
const mockWithWorkspaceMember = vi.fn();
vi.mock("@alook/shared", async () => {
  const actual = await vi.importActual("@alook/shared");
  return {
    ...actual,
    queries: {
      agent: { getAgent: (...a: unknown[]) => mockGetAgent(...a) },
      runtime: { getAgentRuntime: (...a: unknown[]) => mockGetRuntime(...a) },
      agentSkill: { getSkills: (...a: unknown[]) => mockGetSkills(...a) },
    },
  };
});
vi.mock("@/lib/middleware/auth", () => ({
  withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => {
    const params = ctx?.params instanceof Promise ? await ctx.params : ctx?.params;
    return handler(req, { env: {}, userId: "u1", email: "u@t.com", authType: "user" as const, params });
  }),
}));
vi.mock("@/lib/middleware/workspace", () => ({
  withWorkspaceMember: (...args: unknown[]) => mockWithWorkspaceMember(...args),
}));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mockWithWorkspaceMember.mockResolvedValue({ workspaceId: "w1", memberRole: "member" });
});

function get(url: string, params: Record<string, string>) {
  return GET(new NextRequest(url), { params });
}

describe("GET /api/agents/[id]/skills", () => {
  it("400 when agent id missing", async () => {
    const res = await get("http://localhost/x?workspace_id=w1", {});
    expect(res.status).toBe(400);
    expect(mockWithWorkspaceMember).not.toHaveBeenCalled();
  });

  it("returns workspace membership failure before querying public/shared agents", async () => {
    mockWithWorkspaceMember.mockResolvedValue(NextResponse.json({ error: "workspace not found" }, { status: 404 }));

    const res = await get("http://localhost/x?workspace_id=w1", { id: "a1" });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("workspace not found");
    expect(mockGetAgent).not.toHaveBeenCalled();
    expect(mockGetSkills).not.toHaveBeenCalled();
  });

  it("404 when agent not found in workspace", async () => {
    mockGetAgent.mockResolvedValue(null);
    const res = await get("http://localhost/x?workspace_id=w1", { id: "a1" });
    expect(res.status).toBe(404);
    expect(mockWithWorkspaceMember).toHaveBeenCalled();
    expect(mockGetAgent).toHaveBeenCalledWith({}, "a1", "w1", "u1");
  });

  it("returns skills for the agent's runtime provider", async () => {
    mockGetAgent.mockResolvedValue({ id: "a1", runtimeId: "rt1" });
    mockGetRuntime.mockResolvedValue({ provider: "codex" });
    mockGetSkills.mockResolvedValue([{ name: "skill-a" }]);
    const res = await get("http://localhost/x?workspace_id=w1", { id: "a1" });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.skills).toEqual([{ name: "skill-a" }]);
    expect(mockGetSkills).toHaveBeenCalledWith({}, "a1", "codex", "w1");
  });

  it("defaults to claude when the runtime provider is unknown", async () => {
    mockGetAgent.mockResolvedValue({ id: "a1", runtimeId: "rt1" });
    mockGetRuntime.mockResolvedValue({ provider: "weird-runtime" });
    mockGetSkills.mockResolvedValue([]);
    await get("http://localhost/x?workspace_id=w1", { id: "a1" });
    expect(mockGetSkills).toHaveBeenCalledWith({}, "a1", "claude", "w1");
  });

  it("defaults to claude when agent has no runtimeId", async () => {
    mockGetAgent.mockResolvedValue({ id: "a1", runtimeId: null });
    mockGetSkills.mockResolvedValue([]);
    await get("http://localhost/x?workspace_id=w1", { id: "a1" });
    expect(mockGetSkills).toHaveBeenCalledWith({}, "a1", "claude", "w1");
    expect(mockGetRuntime).not.toHaveBeenCalled();
  });
});
