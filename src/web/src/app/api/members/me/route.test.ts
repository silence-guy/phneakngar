import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as sharedMock from "@/test/shared-mock";

const mockGetMemberByUserAndWorkspace = vi.fn();
const mockUpdateMemberSettings = vi.fn();

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(async () => ({ env: { DB: {} } })),
}));

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

vi.mock("@phneakngar/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@phneakngar/shared")>();
  return {
    ...actual,
    createDb: vi.fn(() => ({})),
  queries: {
    member: {
      getMemberByUserAndWorkspace: (...args: unknown[]) => mockGetMemberByUserAndWorkspace(...args),
      updateMemberSettings: (...args: unknown[]) => mockUpdateMemberSettings(...args),
    },
  },
  };
});

vi.mock("@/lib/middleware/auth", () => ({
  withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => {
    const params = ctx?.params instanceof Promise ? await ctx.params : ctx?.params;
    return handler(req, { env: {}, userId: "u1", email: "u@t.com", workspaceId: "w1", params });
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

vi.mock("@/lib/middleware/workspace", async () => {
  const real = await import("@/lib/middleware/workspace");
  return {
    ...real,
    withWorkspaceMember: vi.fn(async (req: any) => {
      const workspaceId =
        new URL(req.url).searchParams.get("workspace_id") ||
        req.headers.get("X-Workspace-ID");
      if (!workspaceId) {
        const { NextResponse } = await import("next/server");
        return NextResponse.json({ error: "workspace_id is required" }, { status: 400 });
      }
      return { workspaceId };
    }),
  };
});

import { GET, PATCH } from "./route";

function getReq(workspaceId?: string) {
  const url = workspaceId
    ? `http://localhost/api/members/me?workspace_id=${workspaceId}`
    : "http://localhost/api/members/me";
  return new NextRequest(url, { method: "GET" });
}

function patchReq(body: unknown, workspaceId = "w1") {
  return new NextRequest(`http://localhost/api/members/me?workspace_id=${workspaceId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("GET /api/members/me", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns global_instruction for the current user", async () => {
    mockGetMemberByUserAndWorkspace.mockResolvedValue({
      globalInstruction: "always speak chinese",
      preferredLocale: "km",
    });

    const res = await GET(getReq("w1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.global_instruction).toBe("always speak chinese");
    expect(body.preferred_locale).toBe("km");
  });

  it("returns 400 when workspace_id is missing", async () => {
    const res = await GET(getReq());
    expect(res.status).toBe(400);
  });

  it("returns 404 when member not found", async () => {
    mockGetMemberByUserAndWorkspace.mockResolvedValue(null);

    const res = await GET(getReq("w1"));
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/members/me", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves and returns updated global instruction", async () => {
    mockUpdateMemberSettings.mockResolvedValue({
      globalInstruction: "new instruction",
      preferredLocale: "km",
    });

    const res = await PATCH(patchReq({ global_instruction: "new instruction" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.global_instruction).toBe("new instruction");
    expect(body.preferred_locale).toBe("km");
    expect(mockUpdateMemberSettings).toHaveBeenCalledWith({}, "u1", "w1", {
      globalInstruction: "new instruction",
      preferredLocale: undefined,
    });
  });

  it("saves and returns updated preferred locale", async () => {
    mockUpdateMemberSettings.mockResolvedValue({
      globalInstruction: "existing instruction",
      preferredLocale: "en",
    });

    const res = await PATCH(patchReq({ preferred_locale: "en" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.global_instruction).toBe("existing instruction");
    expect(body.preferred_locale).toBe("en");
    expect(mockUpdateMemberSettings).toHaveBeenCalledWith({}, "u1", "w1", {
      globalInstruction: undefined,
      preferredLocale: "en",
    });
  });

  it("returns 400 for invalid body", async () => {
    const res = await PATCH(patchReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 404 when member not found", async () => {
    mockUpdateMemberSettings.mockResolvedValue(null);

    const res = await PATCH(patchReq({ global_instruction: "something" }));
    expect(res.status).toBe(404);
  });
});
