import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockAnswerPlaybookHumanInput = vi.fn();

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => ({ env: { DB: {} } })),
}));

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("@/lib/email-domain", () => ({ resolveServerEmailDomain: vi.fn(() => "test.dev") }));

vi.mock("@/lib/services/playbook-engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/playbook-engine")>();
  return {
    ...actual,
    answerPlaybookHumanInput: (...a: unknown[]) => mockAnswerPlaybookHumanInput(...a),
  };
});

vi.mock("@/lib/middleware/auth", () => ({
  withAuth: (handler: any) => async (req: any, ctx?: any) => {
    const params = ctx?.params instanceof Promise ? await ctx.params : ctx?.params;
    return handler(req, { env: {}, userId: "u1", email: "u@t.com", params });
  },
}));

vi.mock("@/lib/middleware/workspace", () => ({
  withWorkspaceMember: vi.fn(async () => ({ workspaceId: "w1" })),
}));

vi.mock("@/lib/api/responses", () => ({
  playbookRunToResponse: (row: any) => ({ id: row.id, status: row.status }),
}));

import { POST } from "./route";
import { PlaybookEngineError } from "@/lib/services/playbook-engine";

beforeEach(() => vi.clearAllMocks());

const ctx = { params: { runId: "pbr1" } } as any;

describe("POST /api/playbooks/runs/[runId]/answer", () => {
  it("answers a human-input step", async () => {
    mockAnswerPlaybookHumanInput.mockResolvedValue({ id: "pbr1", status: "running" });
    const res = await POST(
      new NextRequest("http://localhost/api/playbooks/runs/pbr1/answer", {
        method: "POST",
        body: JSON.stringify({ answer: "0.0.5" }),
      }),
      ctx,
    );
    expect(res.status).toBe(200);
    expect(mockAnswerPlaybookHumanInput).toHaveBeenCalledWith({}, "w1", "pbr1", "0.0.5", {
      emailDomain: "test.dev",
    });
  });

  it("rejects an empty answer", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/playbooks/runs/pbr1/answer", {
        method: "POST",
        body: JSON.stringify({ answer: "" }),
      }),
      ctx,
    );
    expect(res.status).toBe(400);
    expect(mockAnswerPlaybookHumanInput).not.toHaveBeenCalled();
  });

  it("400 when the run is not awaiting input", async () => {
    mockAnswerPlaybookHumanInput.mockRejectedValue(
      new PlaybookEngineError("run is not awaiting input"),
    );
    const res = await POST(
      new NextRequest("http://localhost/api/playbooks/runs/pbr1/answer", {
        method: "POST",
        body: JSON.stringify({ answer: "x" }),
      }),
      ctx,
    );
    expect(res.status).toBe(400);
  });
});
