import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => ({ env: { DB: {} } })),
}));

const mockDeleteMachineToken = vi.fn();
const mockListMachineTokens = vi.fn();

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

vi.mock("@phneakngar/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@phneakngar/shared")>();
  return {
    ...actual,
    createDb: vi.fn(() => ({})),
  queries: {
    machineToken: {
      deleteMachineToken: (...args: unknown[]) => mockDeleteMachineToken(...args),
      listMachineTokens: (...args: unknown[]) => mockListMachineTokens(...args),
    },
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
  withWorkspaceMember: vi.fn(async () => ({ workspaceId: "w1" })),
}));

vi.mock("@/lib/middleware/helpers", () => {
  const { NextResponse } = require("next/server");
  return {
    writeJSON: (data: unknown, status = 200) => NextResponse.json(data, { status }),
    writeError: (message: string, status: number) => NextResponse.json({ error: message }, { status }),
  };
});

const mockInvalidateMany = vi.fn();
vi.mock("@/lib/cache", () => ({
  invalidateMany: (...args: unknown[]) => mockInvalidateMany(...args),
  cacheKeys: {
    machineTokenByHash: (hash: string) => `mt:${hash}`,
    machineTokenLastUsedByHash: (hash: string) => `mt_lu:${hash}`,
  },
}));

import { DELETE } from "./route";

describe("DELETE /api/machine-tokens/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes a token and invalidates warm auth and last-used cache entries by stored hash", async () => {
    const tokenHash = "a".repeat(64);
    mockListMachineTokens.mockResolvedValue([
      { id: "tok1", token: "redacted:tok1", tokenHash },
    ]);
    mockDeleteMachineToken.mockResolvedValue(undefined);

    const req = new NextRequest("http://localhost/api/machine-tokens/tok1", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: "tok1" }) } as any);

    expect(res.status).toBe(204);
    expect(mockDeleteMachineToken).toHaveBeenCalledWith({}, "tok1", "u1", "w1");
    expect(mockInvalidateMany).toHaveBeenCalledWith([
      `mt:${tokenHash}`,
      `mt_lu:${tokenHash}`,
    ]);
  });

  it("does not invalidate cache for tokens outside the selected workspace", async () => {
    mockListMachineTokens.mockResolvedValue([
      { id: "tok-in-workspace", token: "redacted:tok-in-workspace", tokenHash: "b".repeat(64) },
    ]);
    mockDeleteMachineToken.mockResolvedValue(undefined);

    const req = new NextRequest("http://localhost/api/machine-tokens/tok-other", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: "tok-other" }) } as any);

    expect(res.status).toBe(204);
    expect(mockDeleteMachineToken).toHaveBeenCalledWith({}, "tok-other", "u1", "w1");
    expect(mockInvalidateMany).not.toHaveBeenCalled();
  });

  it("derives the durable cache hash when deleting a legacy plaintext token", async () => {
    mockListMachineTokens.mockResolvedValue([
      { id: "legacy", token: "al_legacy_token", tokenHash: null },
    ]);
    mockDeleteMachineToken.mockResolvedValue(undefined);

    const req = new NextRequest("http://localhost/api/machine-tokens/legacy", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: "legacy" }) } as any);

    expect(res.status).toBe(204);
    expect(mockInvalidateMany).toHaveBeenCalledWith([
      expect.stringMatching(/^mt:[a-f0-9]{64}$/),
      expect.stringMatching(/^mt_lu:[a-f0-9]{64}$/),
    ]);
    const [keys] = mockInvalidateMany.mock.calls[0];
    expect(keys[0].slice(3)).toBe(keys[1].slice(6));
    expect(keys.join(" ")).not.toContain("al_legacy_token");
  });
});
