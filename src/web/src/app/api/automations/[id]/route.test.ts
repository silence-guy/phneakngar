import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetAutomation = vi.fn();
const mockUpdateAutomation = vi.fn();
const mockDeleteAutomation = vi.fn();
const mockGetChannelById = vi.fn();

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => ({ env: { DB: {} } })),
}));

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

vi.mock("@phneakngar/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@phneakngar/shared")>();
  return {
    ...actual,
    queries: {
      automation: {
        getAutomation: (...a: unknown[]) => mockGetAutomation(...a),
        updateAutomation: (...a: unknown[]) => mockUpdateAutomation(...a),
        deleteAutomation: (...a: unknown[]) => mockDeleteAutomation(...a),
      },
      channel: {
        getChannelById: (...a: unknown[]) => mockGetChannelById(...a),
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
  automationToResponse: (row: any) => ({
    id: row.id,
    title: row.title,
    enabled: row.enabled,
    schedule: row.schedule,
  }),
}));

import { GET, PATCH, DELETE } from "./route";

beforeEach(() => vi.clearAllMocks());

describe("GET /api/automations/[id]", () => {
  it("returns automation", async () => {
    mockGetAutomation.mockResolvedValue({
      id: "au_1",
      title: "Morning",
      enabled: true,
      schedule: "daily",
    });
    const res = await GET(new NextRequest("http://localhost/api/automations/au_1"), {
      params: { id: "au_1" },
    } as any);
    expect(res.status).toBe(200);
    expect(mockGetAutomation).toHaveBeenCalledWith({}, "au_1", "w1");
    expect(await res.json()).toEqual({
      automation: { id: "au_1", title: "Morning", enabled: true, schedule: "daily" },
    });
  });

  it("returns 404 when missing", async () => {
    mockGetAutomation.mockResolvedValue(null);
    const res = await GET(new NextRequest("http://localhost/api/automations/au_x"), {
      params: { id: "au_x" },
    } as any);
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/automations/[id]", () => {
  it("updates fields", async () => {
    mockGetAutomation.mockResolvedValue({ id: "au_1" });
    mockUpdateAutomation.mockResolvedValue({
      id: "au_1",
      title: "Updated",
      enabled: false,
      schedule: "weekly",
    });

    const res = await PATCH(
      new NextRequest("http://localhost/api/automations/au_1", {
        method: "PATCH",
        body: JSON.stringify({ title: "Updated", enabled: false }),
        headers: { "content-type": "application/json" },
      }),
      { params: { id: "au_1" } } as any
    );

    expect(res.status).toBe(200);
    expect(mockUpdateAutomation).toHaveBeenCalledWith({}, "au_1", "w1", {
      title: "Updated",
      enabled: false,
    });
  });

  it("returns 404 when missing", async () => {
    mockGetAutomation.mockResolvedValue(null);
    const res = await PATCH(
      new NextRequest("http://localhost/api/automations/au_x", {
        method: "PATCH",
        body: JSON.stringify({ title: "X" }),
        headers: { "content-type": "application/json" },
      }),
      { params: { id: "au_x" } } as any
    );
    expect(res.status).toBe(404);
    expect(mockUpdateAutomation).not.toHaveBeenCalled();
  });

  it("returns 404 when delivery_channel_id is outside workspace", async () => {
    mockGetAutomation.mockResolvedValue({ id: "au_1" });
    mockGetChannelById.mockResolvedValue(null);
    const res = await PATCH(
      new NextRequest("http://localhost/api/automations/au_1", {
        method: "PATCH",
        body: JSON.stringify({ delivery_channel_id: "ch_foreign" }),
        headers: { "content-type": "application/json" },
      }),
      { params: { id: "au_1" } } as any
    );
    expect(res.status).toBe(404);
    expect(mockGetChannelById).toHaveBeenCalledWith({}, "ch_foreign", "w1");
    expect(mockUpdateAutomation).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/automations/[id]", () => {
  it("deletes automation", async () => {
    mockDeleteAutomation.mockResolvedValue({ id: "au_1" });
    const res = await DELETE(new NextRequest("http://localhost/api/automations/au_1", {
      method: "DELETE",
    }), { params: { id: "au_1" } } as any);
    expect(res.status).toBe(204);
    expect(mockDeleteAutomation).toHaveBeenCalledWith({}, "au_1", "w1");
  });

  it("returns 404 when missing", async () => {
    mockDeleteAutomation.mockResolvedValue(null);
    const res = await DELETE(new NextRequest("http://localhost/api/automations/au_x", {
      method: "DELETE",
    }), { params: { id: "au_x" } } as any);
    expect(res.status).toBe(404);
  });
});
