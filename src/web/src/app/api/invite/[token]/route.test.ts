import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetInviteByTokenForUser = vi.fn();
const mockRedeemInviteForUser = vi.fn();
const mockInvalidate = vi.fn();

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(async () => ({ env: { DB: {} } })),
}));

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

vi.mock("@phneakngar/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@phneakngar/shared")>();
  return {
    ...actual,
    queries: {
      workspaceInvite: {
        getInviteByTokenForUser: (...args: unknown[]) => mockGetInviteByTokenForUser(...args),
        redeemInviteForUser: (...args: unknown[]) => mockRedeemInviteForUser(...args),
      },
    },
  };
});

vi.mock("@/lib/cache", () => ({
  invalidate: (...args: unknown[]) => mockInvalidate(...args),
  cacheKeys: { allMembers: (workspaceId: string) => `members:${workspaceId}` },
}));

vi.mock("@/lib/middleware/auth", () => ({
  withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => {
    const params = ctx?.params instanceof Promise ? await ctx.params : ctx?.params;
    return handler(req, { env: {}, userId: "u1", email: "u@t.com", params });
  }),
}));

vi.mock("@/lib/middleware/helpers", async () =>
  await import("@/lib/middleware/helpers")
);

import { GET, POST } from "./route";

const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const pastDate = new Date(Date.now() - 1000).toISOString();

const sampleInvite = {
  id: "inv1",
  workspaceId: "w1",
  workspaceName: "Acme Corp",
  workspaceSlug: "acme",
  token: "tok-abc",
  createdBy: "u2",
  creatorName: "Alice",
  creatorEmail: "alice@example.com",
  usedBy: null,
  usedAt: null,
  memberId: null,
  expiresAt: futureDate,
  createdAt: "2024-01-01T00:00:00Z",
};

const request = (method: "GET" | "POST", token = "tok-abc") =>
  new NextRequest(`http://localhost/api/invite/${token}`, { method });
const params = (token = "tok-abc") => ({ params: Promise.resolve({ token }) }) as any;

describe("GET /api/invite/[token]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns invite info for a valid unused token", async () => {
    mockGetInviteByTokenForUser.mockResolvedValue(sampleInvite);

    const res = await GET(request("GET"), params());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      workspace_name: "Acme Corp",
      workspace_id: "w1",
      invited_by: "Alice",
    });
    expect(mockGetInviteByTokenForUser).toHaveBeenCalledWith({}, "tok-abc", "u1");
  });

  it("allows the redeemer to reload after a successful redemption", async () => {
    mockGetInviteByTokenForUser.mockResolvedValue({
      ...sampleInvite,
      usedBy: "u1",
      usedAt: new Date().toISOString(),
      memberId: "m1",
      expiresAt: pastDate,
    });

    expect((await GET(request("GET"), params())).status).toBe(200);
  });

  it("allows the same user to reload a partially redeemed invite so POST can repair it", async () => {
    mockGetInviteByTokenForUser.mockResolvedValue({
      ...sampleInvite,
      usedBy: "u1",
      usedAt: new Date().toISOString(),
      memberId: null,
      expiresAt: pastDate,
    });

    expect((await GET(request("GET"), params())).status).toBe(200);
  });

  it.each([
    [null, 404],
    [{ ...sampleInvite, usedBy: "u2" }, 410],
    [{ ...sampleInvite, expiresAt: pastDate }, 410],
  ])("rejects unavailable invite %#", async (invite, status) => {
    mockGetInviteByTokenForUser.mockResolvedValue(invite);
    expect((await GET(request("GET"), params())).status).toBe(status);
  });
});

describe("POST /api/invite/[token]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redeems atomically and invalidates the member list", async () => {
    mockRedeemInviteForUser.mockResolvedValue({
      status: "success",
      workspaceId: "w1",
      workspaceSlug: "acme",
    });

    const res = await POST(request("POST"), params());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ workspace_id: "w1", workspace_slug: "acme" });
    expect(mockRedeemInviteForUser).toHaveBeenCalledWith({}, "tok-abc", "u1");
    expect(mockInvalidate).toHaveBeenCalledWith("members:w1");
  });

  it("returns the same success for a safe same-user retry", async () => {
    mockRedeemInviteForUser.mockResolvedValue({
      status: "success",
      workspaceId: "w1",
      workspaceSlug: "acme",
    });

    expect((await POST(request("POST"), params())).status).toBe(200);
    expect((await POST(request("POST"), params())).status).toBe(200);
  });

  it("returns success for same-user partial-state repair", async () => {
    mockRedeemInviteForUser.mockResolvedValue({
      status: "success",
      workspaceId: "w1",
      workspaceSlug: "acme",
    });

    const res = await POST(request("POST"), params());

    expect(res.status).toBe(200);
    expect(mockInvalidate).toHaveBeenCalledWith("members:w1");
  });

  it("rejects same-user partial-state repair when the workspace is at capacity", async () => {
    mockRedeemInviteForUser.mockResolvedValue({ status: "capacity_full" });

    const res = await POST(request("POST"), params());
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("workspace capacity reached");
    expect(mockInvalidate).not.toHaveBeenCalled();
  });

  it.each([
    ["not_found", 404],
    ["expired", 410],
    ["used", 410],
    ["inconsistent", 410],
    ["already_member", 409],
    ["capacity_full", 409],
  ])("maps %s outcome to %i", async (status, httpStatus) => {
    mockRedeemInviteForUser.mockResolvedValue({ status });

    const res = await POST(request("POST"), params());

    expect(res.status).toBe(httpStatus);
    expect(mockInvalidate).not.toHaveBeenCalled();
  });

  it("returns 503 when the atomic batch fails", async () => {
    mockRedeemInviteForUser.mockRejectedValue(new Error("D1 batch failed"));

    const res = await POST(request("POST"), params());

    expect(res.status).toBe(503);
    expect(mockInvalidate).not.toHaveBeenCalled();
  });
});
