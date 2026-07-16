import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockUpdateMemory = vi.fn();
const mockDeleteMemory = vi.fn();

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => ({ env: { DB: {} } })),
}));

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

vi.mock("@phneakngar/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@phneakngar/shared")>();
  return {
    ...actual,
    queries: {
      agentMemory: {
        updateMemory: (...a: unknown[]) => mockUpdateMemory(...a),
        deleteMemory: (...a: unknown[]) => mockDeleteMemory(...a),
      },
    },
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
  memoryToResponse: (row: any) => ({
    id: row.id,
    content: row.content,
    kind: row.kind,
  }),
}));

import { PATCH, DELETE } from "./route";

beforeEach(() => vi.clearAllMocks());

describe("PATCH /api/memory/[id]", () => {
  it("updates memory content", async () => {
    mockUpdateMemory.mockResolvedValue({ id: "mem_1", content: "new", kind: "fact" });
    const res = await PATCH(
      new NextRequest("http://localhost/api/memory/mem_1", {
        method: "PATCH",
        body: JSON.stringify({ content: "new" }),
        headers: { "content-type": "application/json" },
      }),
      { params: { id: "mem_1" } } as any
    );
    expect(res.status).toBe(200);
    expect(mockUpdateMemory).toHaveBeenCalledWith({}, "mem_1", "w1", {
      content: "new",
      kind: undefined,
    });
  });

  it("returns 404 when missing", async () => {
    mockUpdateMemory.mockResolvedValue(null);
    const res = await PATCH(
      new NextRequest("http://localhost/api/memory/mem_x", {
        method: "PATCH",
        body: JSON.stringify({ content: "x" }),
        headers: { "content-type": "application/json" },
      }),
      { params: { id: "mem_x" } } as any
    );
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/memory/[id]", () => {
  it("deletes memory", async () => {
    mockDeleteMemory.mockResolvedValue({ id: "mem_1" });
    const res = await DELETE(
      new NextRequest("http://localhost/api/memory/mem_1", { method: "DELETE" }),
      { params: { id: "mem_1" } } as any
    );
    expect(res.status).toBe(204);
    expect(mockDeleteMemory).toHaveBeenCalledWith({}, "mem_1", "w1");
  });

  it("returns 404 when missing", async () => {
    mockDeleteMemory.mockResolvedValue(null);
    const res = await DELETE(
      new NextRequest("http://localhost/api/memory/mem_x", { method: "DELETE" }),
      { params: { id: "mem_x" } } as any
    );
    expect(res.status).toBe(404);
  });
});
