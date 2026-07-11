import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as sharedMock from "@/test/shared-mock";

const mockUpsertMachine = vi.fn();
const mockGetMachineByChhlat = vi.fn();
const mockBroadcastToUser = vi.fn();

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => ({
    env: { DB: {} },
  })),
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => ({})),
}));

vi.mock("@phneakngar/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@phneakngar/shared")>();
  return {
    ...actual,
    queries: {
    machine: {
      upsertMachine: (...args: unknown[]) => mockUpsertMachine(...args),
      getMachineByChhlat: (...args: unknown[]) => mockGetMachineByChhlat(...args),
    },
  },
  };
});

vi.mock("@/lib/middleware/auth", () => ({
  withAuth: vi.fn((handler: any) => async (req: any) => {
    return handler(req, { env: {}, userId: "u1", email: "u@t.com", authType: "machine" as const, workspaceId: "w1" });
  }),
}));

vi.mock("@/lib/middleware/helpers", () => {
  const { NextResponse } = require("next/server");
  return {
    writeJSON: (data: unknown, status = 200) => NextResponse.json(data, { status }),
    writeError: (message: string, status: number) => NextResponse.json({ error: message }, { status }),
    formatTimestamp: (d: Date | string | null) => d instanceof Date ? d.toISOString() : d || "",
    parseBody: async (req: Request, schema: { parse: (d: unknown) => unknown }) => {
      try {
        const data = await req.json();
        return [schema.parse(data), null];
      } catch {
        return [null, NextResponse.json({ error: "invalid request body" }, { status: 400 })];
      }
    },
  };
});

vi.mock("@/lib/broadcast", () => ({
  broadcastToUser: (...args: unknown[]) => mockBroadcastToUser(...args),
}));

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { POST } from "./route";

function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/chhlat/heartbeat", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/chhlat/heartbeat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMachineByChhlat.mockResolvedValue(null);
    mockUpsertMachine.mockResolvedValue({});
    mockBroadcastToUser.mockResolvedValue(undefined);
  });

  it("returns 400 when chhlat_id is missing", async () => {
    const res = await POST(postReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when chhlat_id is empty", async () => {
    const res = await POST(postReq({ chhlat_id: "" }));
    expect(res.status).toBe(400);
  });

  it("returns ok: true on valid request", async () => {
    const res = await POST(postReq({ chhlat_id: "d1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
  });

  it("upserts machine in D1 on every heartbeat", async () => {
    await POST(postReq({ chhlat_id: "d1" }));

    expect(mockUpsertMachine).toHaveBeenCalledWith({}, {
      chhlatId: "d1",
      workspaceId: "w1",
      deviceInfo: "d1",
      ownerId: "u1",
    });
  });

  it("broadcasts runtime.status when chhlat transitions from offline to online", async () => {
    mockGetMachineByChhlat.mockResolvedValue(null);
    await POST(postReq({ chhlat_id: "d1" }));

    expect(mockBroadcastToUser).toHaveBeenCalledWith("u1", {
      type: "runtime.status",
      chhlatId: "d1",
      workspaceId: "w1",
      status: "online",
    });
  });

  it("broadcasts when last_seen_at exceeds offline threshold", async () => {
    mockGetMachineByChhlat.mockResolvedValue({ lastSeenAt: new Date(Date.now() - 30_000).toISOString() });
    await POST(postReq({ chhlat_id: "d1" }));

    expect(mockBroadcastToUser).toHaveBeenCalledWith("u1", expect.objectContaining({
      type: "runtime.status",
      status: "online",
    }));
  });

  it("does not broadcast when chhlat was already online", async () => {
    mockGetMachineByChhlat.mockResolvedValue({ lastSeenAt: new Date().toISOString() });
    await POST(postReq({ chhlat_id: "d1" }));

    expect(mockBroadcastToUser).not.toHaveBeenCalled();
  });

  it("does not fail when upsertMachine throws", async () => {
    mockUpsertMachine.mockRejectedValue(new Error("D1 timeout"));

    const res = await POST(postReq({ chhlat_id: "d1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
  });

  it("requires machine token (workspaceId must be present)", async () => {
    vi.resetModules();

    vi.doMock("@opennextjs/cloudflare", () => ({
      getCloudflareContext: vi.fn(() => ({ env: { DB: {} } })),
    }));
    vi.doMock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));
    vi.doMock("@phneakngar/shared", () => ({
      ...sharedMock,
      queries: { machine: { upsertMachine: vi.fn(), getMachineByChhlat: vi.fn() } },
    }));
    vi.doMock("@/lib/middleware/auth", () => ({
      withAuth: vi.fn((handler: any) => async (req: any) => {
        return handler(req, { env: {}, userId: "u1", email: "u@t.com" });
      }),
    }));
    vi.doMock("@/lib/middleware/helpers", () => {
      const { NextResponse } = require("next/server");
      return {
        writeJSON: (data: unknown, status = 200) => NextResponse.json(data, { status }),
        writeError: (message: string, status: number) => NextResponse.json({ error: message }, { status }),
        formatTimestamp: (d: Date | string | null) => d instanceof Date ? d.toISOString() : d || "",
        parseBody: async (req: Request, schema: { parse: (d: unknown) => unknown }) => {
          try {
            const data = await req.json();
            return [schema.parse(data), null];
          } catch {
            return [null, NextResponse.json({ error: "invalid request body" }, { status: 400 })];
          }
        },
      };
    });
    vi.doMock("@/lib/broadcast", () => ({ broadcastToUser: vi.fn() }));
    vi.doMock("@/lib/logger", () => ({ log: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

    const { POST: POST2 } = await import("./route");
    const res = await POST2(postReq({ chhlat_id: "d1" }));
    expect(res.status).toBe(403);
  });
});
