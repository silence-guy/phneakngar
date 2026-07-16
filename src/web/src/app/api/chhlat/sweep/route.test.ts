import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as sharedMock from "@/test/shared-mock";

const mockSweepStaleState = vi.fn();
const mockPromoteDue = vi.fn(async () => 0);
const mockGetMachineByChhlat = vi.fn();

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => ({
    env: {
      DB: {},
      CACHE_KV: {
        put: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue(null),
        delete: vi.fn().mockResolvedValue(undefined),
      },
    },
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
      getMachineByChhlat: (...args: unknown[]) => mockGetMachineByChhlat(...args),
    },
  },
  };
});

vi.mock("@/lib/middleware/auth", () => ({
  withAuth: vi.fn((handler: any) => async (req: any) => {
    return handler(req, { env: {}, userId: "u1", email: "u@t.com", authType: "machine" as const, workspaceId: "w1", machineTokenHostname: "d1" });
  }),
}));

vi.mock("@/lib/middleware/helpers", () => ({
  writeJSON: (data: unknown, status = 200) => { const { NextResponse } = require("next/server"); return NextResponse.json(data, { status }); },
  writeError: (message: string, status: number) => { const { NextResponse } = require("next/server"); return NextResponse.json({ error: message }, { status }); },
  formatTimestamp: (date: Date | string | null) => date ? new Date(date as string).toISOString().replace(/\.\d{3}Z$/, "Z") : "",
  formatTimestampNullable: (date: Date | string | null) => date ? new Date(date as string).toISOString().replace(/\.\d{3}Z$/, "Z") : null,
  parseBody: async (req: Request, schema: { parse: (d: unknown) => unknown }) => {
    try {
      const data = await req.json();
      return [schema.parse(data), null];
    } catch {
      return [null, { status: 400, error: "invalid request body" }];
    }
  },
}));

vi.mock("@/lib/services/sweep", () => ({
  sweepStaleState: (...args: unknown[]) => mockSweepStaleState(...args),
}));

vi.mock("@/lib/services/calendar", () => ({
  promoteDueCalendarEventsForWorkspace: (...args: unknown[]) => mockPromoteDue(...args),
}));

const mockPromoteAutomations = vi.fn();
vi.mock("@/lib/services/automation", () => ({
  promoteDueAutomationsForWorkspace: (...args: unknown[]) => mockPromoteAutomations(...args),
}));

vi.mock("@/lib/email-domain", () => ({
  resolveServerEmailDomain: () => "example.test",
}));

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/cache", () => ({
  throttled: vi.fn((_key: string, _interval: number, fn: () => Promise<any>) => fn()),
}));

import { POST } from "./route";

function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/chhlat/sweep", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/chhlat/sweep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSweepStaleState.mockResolvedValue(undefined);
    mockPromoteDue.mockResolvedValue(0);
    mockPromoteAutomations.mockResolvedValue(0);
    mockGetMachineByChhlat.mockResolvedValue(null);
  });

  it("returns 403 without machine token auth", async () => {
    vi.resetModules();

    vi.doMock("@opennextjs/cloudflare", () => ({
      getCloudflareContext: vi.fn(() => ({
        env: { DB: {}, CACHE_KV: { put: vi.fn(), get: vi.fn().mockResolvedValue(null), delete: vi.fn() } },
      })),
    }));
    vi.doMock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));
    vi.doMock("@phneakngar/shared", () => ({ ...(sharedMock as unknown as Record<string, unknown>) }));
    vi.doMock("@/lib/middleware/auth", () => ({
      withAuth: vi.fn((handler: any) => async (req: any) => {
        return handler(req, { env: {}, userId: "u1", email: "u@t.com" });
      }),
    }));
    vi.doMock("@/lib/middleware/helpers", () => ({
      writeJSON: (data: unknown, status = 200) => { const { NextResponse } = require("next/server"); return NextResponse.json(data, { status }); },
      writeError: (message: string, status: number) => { const { NextResponse } = require("next/server"); return NextResponse.json({ error: message }, { status }); },
      formatTimestamp: (date: Date | string | null) => date ? new Date(date as string).toISOString().replace(/\.\d{3}Z$/, "Z") : "",
      formatTimestampNullable: (date: Date | string | null) => date ? new Date(date as string).toISOString().replace(/\.\d{3}Z$/, "Z") : null,
      parseBody: async (req: Request, schema: { parse: (d: unknown) => unknown }) => {
        try {
          const data = await req.json();
          return [schema.parse(data), null];
        } catch {
          return [null, { status: 400, error: "invalid request body" }];
        }
      },
    }));
    vi.doMock("@/lib/services/sweep", () => ({ sweepStaleState: vi.fn() }));
    vi.doMock("@/lib/services/calendar", () => ({ promoteDueCalendarEventsForWorkspace: vi.fn() }));
    vi.doMock("@/lib/services/automation", () => ({ promoteDueAutomationsForWorkspace: vi.fn() }));
    vi.doMock("@/lib/email-domain", () => ({ resolveServerEmailDomain: () => "example.test" }));
    vi.doMock("@/lib/logger", () => ({ log: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
    vi.doMock("@/lib/cache", () => ({ throttled: vi.fn((_k: string, _i: number, fn: () => Promise<any>) => fn()) }));

    const { POST: POST2 } = await import("./route");
    const res = await POST2(postReq({ chhlat_id: "d1" }));
    expect(res.status).toBe(403);
  });

  it("calls sweepStaleState with correct db and workspaceId", async () => {
    await POST(postReq({ chhlat_id: "d1" }));

    expect(mockSweepStaleState).toHaveBeenCalledWith({}, "w1");
  });

  it("calls promoteDueCalendarEventsForWorkspace (throttled)", async () => {
    await POST(postReq({ chhlat_id: "d1" }));

    expect(mockPromoteDue).toHaveBeenCalledWith({}, "w1");
  });

  it("calls promoteDueAutomationsForWorkspace (throttled)", async () => {
    await POST(postReq({ chhlat_id: "d1" }));

    expect(mockPromoteAutomations).toHaveBeenCalledWith({}, "w1", {
      emailDomain: "example.test",
    });
  });

  it("returns { ok: true } on success", async () => {
    const res = await POST(postReq({ chhlat_id: "d1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
  });

  it("survives sweepStaleState throwing (still returns 200)", async () => {
    mockSweepStaleState.mockRejectedValue(new Error("D1 timeout"));

    const res = await POST(postReq({ chhlat_id: "d1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
  });

  it("survives calendar promotion throwing (still returns 200)", async () => {
    mockPromoteDue.mockRejectedValue(new Error("calendar error"));

    const res = await POST(postReq({ chhlat_id: "d1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
  });
});
