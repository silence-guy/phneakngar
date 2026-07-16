import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockPromote = vi.fn();

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => ({ env: { DB: {}, NODE_ENV: "test" } })),
}));

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

vi.mock("@/lib/middleware/auth", () => ({
  withAuth: (handler: any) => async (req: any, ctx?: any) =>
    handler(req, { env: { DB: {}, NODE_ENV: "test" }, userId: "u1", email: "u@t.com", params: ctx?.params }),
}));

vi.mock("@/lib/middleware/workspace", () => ({
  withWorkspaceMember: vi.fn(async () => ({ workspaceId: "w1" })),
}));

vi.mock("@/lib/services/automation", () => ({
  promoteDueAutomationsForWorkspace: (...a: unknown[]) => mockPromote(...a),
}));

vi.mock("@/lib/email-domain", () => ({
  resolveServerEmailDomain: () => "example.test",
}));

import { POST } from "./route";

beforeEach(() => vi.clearAllMocks());

describe("POST /api/automations/due", () => {
  it("promotes due automations for workspace", async () => {
    mockPromote.mockResolvedValue(2);
    const res = await POST(new NextRequest("http://localhost/api/automations/due", { method: "POST" }), {} as any);
    expect(res.status).toBe(200);
    expect(mockPromote).toHaveBeenCalledWith({}, "w1", { emailDomain: "example.test" });
    expect(await res.json()).toEqual({ enqueued: 2 });
  });
});
