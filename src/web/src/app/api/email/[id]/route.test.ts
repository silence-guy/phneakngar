import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as sharedMock from "@/test/shared-mock";

const mockGetEmailById = vi.fn();
const mockDeleteEmail = vi.fn();
const mockUpdateEmailStatus = vi.fn();
const mockGetAgent = vi.fn();

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => ({
    env: { DB: {}, EMAIL_BUCKET: {} },
  })),
}));

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

vi.mock("@phneakngar/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@phneakngar/shared")>();
  return {
    ...actual,
    createDb: vi.fn(() => ({})),
  queries: {
    email: {
      getEmailById: (...args: unknown[]) => mockGetEmailById(...args),
      deleteEmail: (...args: unknown[]) => mockDeleteEmail(...args),
      updateEmailStatus: (...args: unknown[]) => mockUpdateEmailStatus(...args),
    },
    agent: { getAgent: (...args: unknown[]) => mockGetAgent(...args) },
  },
  };
});

vi.mock("@/lib/middleware/auth", () => ({
  withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => {
    const params = ctx?.params instanceof Promise ? await ctx.params : ctx?.params;
    return handler(req, { env: {}, userId: "u1", email: "u@t.com", params });
  }),
}));

vi.mock("@/lib/middleware/workspace", () => ({
  withWorkspaceMember: vi.fn(async () => ({ workspaceId: "ws1" })),
}));

vi.mock("@/lib/middleware/helpers", async () => {
  const { NextResponse } = require("next/server");
  const actual = await import("@/lib/middleware/helpers");
  return {
    ...actual,
    writeJSON: (data: unknown, status = 200) => NextResponse.json(data, { status }),
    writeError: (message: string, status: number) => NextResponse.json({ error: message }, { status }),
  };
});

vi.mock("@/lib/api/responses", () => ({
  emailToResponse: (e: any) => ({ id: e.id, status: e.status }),
}));

import { GET, DELETE, PATCH } from "./route";

describe("GET /api/email/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns email scoped by workspaceId", async () => {
    mockGetEmailById.mockResolvedValue({ id: "e1", agentId: "a1" });
    mockGetAgent.mockResolvedValue({ id: "a1" });

    const req = new NextRequest("http://localhost/api/email/e1");
    const res = await GET(req, { params: Promise.resolve({ id: "e1" }) } as any);

    expect(res.status).toBe(200);
    expect(mockGetEmailById).toHaveBeenCalledWith({}, "e1", "ws1");
  });

  it("returns 404 when email not found (wrong workspace)", async () => {
    mockGetEmailById.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/email/e1");
    const res = await GET(req, { params: Promise.resolve({ id: "e1" }) } as any);

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/email/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes an email scoped by workspaceId and returns 204", async () => {
    mockGetEmailById.mockResolvedValue({ id: "e1", agentId: "a1" });
    mockGetAgent.mockResolvedValue({ id: "a1" });
    mockDeleteEmail.mockResolvedValue(undefined);

    const req = new NextRequest("http://localhost/api/email/e1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "e1" }) } as any);

    expect(res.status).toBe(204);
    expect(mockDeleteEmail).toHaveBeenCalledWith({}, "e1", "ws1");
  });

  it("returns 404 when email not found", async () => {
    mockGetEmailById.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/email/e1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "e1" }) } as any);

    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/email/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates status for valid email in workspace", async () => {
    mockGetEmailById.mockResolvedValue({ id: "e1", agentId: "a1" });
    mockGetAgent.mockResolvedValue({ id: "a1" });
    mockUpdateEmailStatus.mockResolvedValue({ id: "e1", status: "read" });

    const req = new NextRequest("http://localhost/api/email/e1", {
      method: "PATCH",
      body: JSON.stringify({ status: "read" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "e1" }) } as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ id: "e1", status: "read" });
    expect(mockUpdateEmailStatus).toHaveBeenCalledWith({}, "e1", "ws1", "read");
  });

  it("updates status to archived", async () => {
    mockGetEmailById.mockResolvedValue({ id: "e1", agentId: "a1" });
    mockGetAgent.mockResolvedValue({ id: "a1" });
    mockUpdateEmailStatus.mockResolvedValue({ id: "e1", status: "archived" });

    const req = new NextRequest("http://localhost/api/email/e1", {
      method: "PATCH",
      body: JSON.stringify({ status: "archived" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "e1" }) } as any);

    expect(res.status).toBe(200);
    expect(mockUpdateEmailStatus).toHaveBeenCalledWith({}, "e1", "ws1", "archived");
  });

  it("returns 404 when email not in workspace", async () => {
    mockGetEmailById.mockResolvedValue({ id: "e1", agentId: "a1" });
    mockGetAgent.mockResolvedValue({ id: "a1" });
    mockUpdateEmailStatus.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/email/e1", {
      method: "PATCH",
      body: JSON.stringify({ status: "read" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "e1" }) } as any);

    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid status value", async () => {
    mockGetEmailById.mockResolvedValue({ id: "e1", agentId: "a1" });
    mockGetAgent.mockResolvedValue({ id: "a1" });
    const req = new NextRequest("http://localhost/api/email/e1", {
      method: "PATCH",
      body: JSON.stringify({ status: "deleted" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "e1" }) } as any);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("validation error");
    expect(body.details).toContainEqual(expect.stringContaining("status"));
  });

  it("rejects PATCH to gated outbound statuses", async () => {
    mockGetEmailById.mockResolvedValue({ id: "e1", agentId: "a1", status: "unread" });
    mockGetAgent.mockResolvedValue({ id: "a1" });
    const req = new NextRequest("http://localhost/api/email/e1", {
      method: "PATCH",
      body: JSON.stringify({ status: "pending_approval" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "e1" }) } as any);
    expect(res.status).toBe(400);
    expect(mockUpdateEmailStatus).not.toHaveBeenCalled();
  });

  it("rejects PATCH when email is already pending_approval", async () => {
    mockGetEmailById.mockResolvedValue({
      id: "e1",
      agentId: "a1",
      status: "pending_approval",
    });
    mockGetAgent.mockResolvedValue({ id: "a1" });
    const req = new NextRequest("http://localhost/api/email/e1", {
      method: "PATCH",
      body: JSON.stringify({ status: "read" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "e1" }) } as any);
    expect(res.status).toBe(409);
    expect(mockUpdateEmailStatus).not.toHaveBeenCalled();
  });

  it("returns 400 for missing status", async () => {
    mockGetEmailById.mockResolvedValue({ id: "e1", agentId: "a1" });
    mockGetAgent.mockResolvedValue({ id: "a1" });
    const req = new NextRequest("http://localhost/api/email/e1", {
      method: "PATCH",
      body: JSON.stringify({}),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "e1" }) } as any);

    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
    mockGetEmailById.mockResolvedValue({ id: "e1", agentId: "a1" });
    mockGetAgent.mockResolvedValue({ id: "a1" });
    const req = new NextRequest("http://localhost/api/email/e1", {
      method: "PATCH",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "e1" }) } as any);

    expect(res.status).toBe(400);
  });
});
