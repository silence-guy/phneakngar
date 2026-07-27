import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as sharedMock from "@/test/shared-mock";

const mockEmailWorkerFetch = vi.fn().mockResolvedValue(new Response("ok"));
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => ({
    env: { DB: {}, ENCRYPTION_KEY: "test-key", EMAIL_NOTIFY_SECRET: "notify-secret", EMAIL_WORKER: { fetch: mockEmailWorkerFetch } },
  })),
}));
vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("@phneakngar/shared/crypto", () => ({ encrypt: vi.fn((v: string) => `enc(${v})`) }));

const mockGetAgent = vi.fn();
const mockGetAccounts = vi.fn();
const mockCreateAccount = vi.fn();

vi.mock("@phneakngar/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@phneakngar/shared")>();
  return {
    ...actual,
    queries: {
    agent: { getAgent: (...a: unknown[]) => mockGetAgent(...a) },
    emailAccount: {
      getEmailAccountsByAgent: (...a: unknown[]) => mockGetAccounts(...a),
      createEmailAccount: (...a: unknown[]) => mockCreateAccount(...a),
    },
  },
  };
});

vi.mock("@/lib/middleware/auth", () => ({
  withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => {
    const params = ctx?.params instanceof Promise ? await ctx.params : ctx?.params;
    return handler(req, { env: { DB: {}, ENCRYPTION_KEY: "test-key", EMAIL_NOTIFY_SECRET: "notify-secret", EMAIL_WORKER: { fetch: mockEmailWorkerFetch } }, userId: "u1", email: "u@t.com", params });
  }),
}));
vi.mock("@/lib/middleware/workspace", () => ({
  withWorkspaceMember: vi.fn(async () => ({ workspaceId: "w1" })),
}));
vi.mock("@/lib/cache", () => ({
  invalidate: vi.fn().mockResolvedValue(undefined),
  cacheKeys: {
    allEmailAccounts: (w: string) => `ea:${w}`,
    overviewEmailAccounts: (w: string) => `ov_ea:${w}`,
  },
}));

import { GET, POST } from "./route";

const ACCOUNT_ROW = {
  id: "acc1", agentId: "a1", workspaceId: "w1", emailAddress: "x@t.com", displayName: "X",
  imapHost: "imap.example.com", imapPort: 993, imapTls: 1, smtpHost: "smtp.example.com", smtpPort: 465, smtpTls: 1,
  pollIntervalSeconds: 60, lastSyncedAt: null, status: "active", errorMessage: null,
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};

const VALID_BODY = {
  emailAddress: "x@t.com", displayName: "X", imapHost: "imap.example.com", imapPort: 993,
  imapUsername: "u", imapPassword: "p", imapTls: true, smtpHost: "smtp.example.com", smtpPort: 465,
  smtpUsername: "su", smtpPassword: "sp", smtpTls: 1, pollIntervalSeconds: 60,
};

beforeEach(() => vi.clearAllMocks());

describe("GET /api/agents/[id]/email-accounts", () => {
  it("still lists accounts for a non-owner collaborator (read access unchanged)", async () => {
    mockGetAgent.mockResolvedValue({ id: "a1", ownerId: "someone-else" });
    mockGetAccounts.mockResolvedValue([ACCOUNT_ROW]);
    const res = await GET(
      new NextRequest("http://localhost/api/agents/a1/email-accounts"),
      { params: { id: "a1" } } as never,
    );
    expect(res.status).toBe(200);
  });

  it("lists accounts scoped to agent + workspace", async () => {
    mockGetAgent.mockResolvedValue({ id: "a1", ownerId: "u1" });
    mockGetAccounts.mockResolvedValue([ACCOUNT_ROW]);
    const req = new NextRequest("http://localhost/api/agents/a1/email-accounts");
    const res = await GET(req, { params: { id: "a1" } });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body[0].id).toBe("acc1");
    expect(mockGetAccounts).toHaveBeenCalledWith({}, "a1", "w1");
  });

  it("400 when agent id missing", async () => {
    const req = new NextRequest("http://localhost/api/agents/x/email-accounts");
    const res = await GET(req, { params: {} });
    expect(res.status).toBe(400);
  });

  it("404 when agent not in workspace", async () => {
    mockGetAgent.mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/agents/a1/email-accounts");
    const res = await GET(req, { params: { id: "a1" } });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/agents/[id]/email-accounts", () => {
  function post(body: unknown) {
    return POST(
      new NextRequest("http://localhost/api/agents/a1/email-accounts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      { params: { id: "a1" } },
    );
  }

  it("creates an account, encrypts credentials, starts the worker (201)", async () => {
    mockGetAgent.mockResolvedValue({ id: "a1", ownerId: "u1" });
    mockCreateAccount.mockResolvedValue(ACCOUNT_ROW);
    const res = await post(VALID_BODY);
    expect(res.status).toBe(201);
    const createArgs = mockCreateAccount.mock.calls[0]![1] as Record<string, unknown>;
    expect(createArgs.workspaceId).toBe("w1");
    expect(createArgs.imapPassword).toBe("enc(p)");
    expect(mockEmailWorkerFetch).toHaveBeenCalled();
  });

  it("404 when agent not in workspace", async () => {
    mockGetAgent.mockResolvedValue(null);
    const res = await post(VALID_BODY);
    expect(res.status).toBe(404);
  });

  it("403 for a non-owner collaborator with agentAccess", async () => {
    // getAgent succeeds on a view/collaboration grant; creating mailbox credentials
    // (pointed at any IMAP/SMTP host) is an ownership operation.
    mockGetAgent.mockResolvedValue({ id: "a1", ownerId: "someone-else" });
    const res = await post(VALID_BODY);
    expect(res.status).toBe(403);
    expect(mockCreateAccount).not.toHaveBeenCalled();
    expect(mockEmailWorkerFetch).not.toHaveBeenCalled();
  });

  it("403 for a non-owner on a public-visibility agent", async () => {
    mockGetAgent.mockResolvedValue({ id: "a1", visibility: "public", ownerId: "someone-else" });
    const res = await post(VALID_BODY);
    expect(res.status).toBe(403);
    expect(mockCreateAccount).not.toHaveBeenCalled();
  });

  it("400 on unsafe mail host", async () => {
    mockGetAgent.mockResolvedValue({ id: "a1", ownerId: "u1" });
    const res = await post({ ...VALID_BODY, imapHost: "127.0.0.1" });
    expect(res.status).toBe(400);
    expect(mockCreateAccount).not.toHaveBeenCalled();
    expect(mockEmailWorkerFetch).not.toHaveBeenCalled();
  });

  it("400 on invalid body", async () => {
    mockGetAgent.mockResolvedValue({ id: "a1", ownerId: "u1" });
    const res = await post({ emailAddress: "x@t.com" });
    expect(res.status).toBe(400);
  });
});
