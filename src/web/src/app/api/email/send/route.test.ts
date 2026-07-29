import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as sharedMock from "@/test/shared-mock";

const mockGetAgent = vi.fn();
const mockGetAgentByHandle = vi.fn();
const mockCreateEmail = vi.fn();
const mockClaimOutbound = vi.fn();
const mockMarkSending = vi.fn();
const mockMarkSent = vi.fn();
const mockMarkFailed = vi.fn();
const mockMarkAmbiguous = vi.fn();
const mockGetEmailById = vi.fn();
const mockIsWhitelisted = vi.fn();
const mockGetEmailAccountsByAgent = vi.fn();
const mockGetEmailAccountScoped = vi.fn();
const mockEmailWorkerFetch = vi.fn();
const mockEmailBucketGet = vi.fn();
const mockEmailBucketPut = vi.fn();
const mockWorkerSelfRefFetch = vi.fn();
const mockCreateMapping = vi.fn();
const mockGetConversationForAgent = vi.fn();
const mockCreateMessage = vi.fn();
const mockCreateApproval = vi.fn();
const mockTransitionStatus = vi.fn();

function claimedEmail(overrides: Record<string, unknown> = {}) {
  return {
    id: "e1",
    agentId: "a1",
    workspaceId: "ws1",
    fromEmail: "test-agent@agents.example",
    toEmail: "user@example.com",
    subject: "Hello",
    r2Key: "emails/claim-r2/raw",
    messageId: "<claim-msg@agents.example>",
    status: "pending",
    direction: "outbound",
    ...overrides,
  };
}

function mockFreshClaim(overrides: Record<string, unknown> = {}) {
  const email = claimedEmail(overrides);
  mockClaimOutbound.mockResolvedValue({ outcome: "claimed", email });
  mockMarkSending.mockResolvedValue({ ...email, status: "sending" });
  mockMarkSent.mockResolvedValue({ ...email, status: "sent" });
  mockGetEmailById.mockResolvedValue({ ...email, status: "sent" });
  return email;
}

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => ({
    env: {
      DB: {},
      EMAIL_WORKER: { fetch: (...args: unknown[]) => mockEmailWorkerFetch(...args) },
      EMAIL_BUCKET: {
        get: (...args: unknown[]) => mockEmailBucketGet(...args),
        put: (...args: unknown[]) => mockEmailBucketPut(...args),
      },
      WORKER_SELF_REFERENCE: { fetch: (...args: unknown[]) => mockWorkerSelfRefFetch(...args) },
      EMAIL_NOTIFY_SECRET: "notify-secret", PHNEAKNGAR_DOMAIN: "agents.example",
    },
  })),
}));

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));

vi.mock("@/lib/cache", () => ({
  cached: vi.fn((_key: string, _ttl: number, fn: () => Promise<any>) => fn()),
  invalidate: vi.fn(() => Promise.resolve()),
  cacheKeys: {
    allEmailAccounts: (ws: string) => `ea:${ws}`,
    overviewEmailStats: (ws: string) => `ov_email:${ws}`,
    overviewAttention: (ws: string) => `ov_attn:${ws}`,
  },
}));

vi.mock("@phneakngar/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@phneakngar/shared")>();
  return {
    ...actual,
    createDb: vi.fn(() => ({})),
  queries: {
    email: {
      createEmail: (...args: unknown[]) => mockCreateEmail(...args),
      claimOutboundEmailDelivery: (...args: unknown[]) => mockClaimOutbound(...args),
      markOutboundEmailSending: (...args: unknown[]) => mockMarkSending(...args),
      markOutboundEmailSent: (...args: unknown[]) => mockMarkSent(...args),
      markOutboundEmailFailed: (...args: unknown[]) => mockMarkFailed(...args),
      markOutboundEmailAmbiguous: (...args: unknown[]) => mockMarkAmbiguous(...args),
      getEmailById: (...args: unknown[]) => mockGetEmailById(...args),
      transitionOutboundEmailStatus: (...args: unknown[]) => mockTransitionStatus(...args),
    },
    approval: {
      createApproval: (...args: unknown[]) => mockCreateApproval(...args),
    },
    agent: {
      getAgent: (...args: unknown[]) => mockGetAgent(...args),
      getAgentByHandle: (...args: unknown[]) => mockGetAgentByHandle(...args),
    },
    whitelist: {
      isWhitelisted: (...args: unknown[]) => mockIsWhitelisted(...args),
    },
    emailAccount: {
      getEmailAccountsByAgent: (...args: unknown[]) => mockGetEmailAccountsByAgent(...args),
      getEmailAccountScoped: (...args: unknown[]) => mockGetEmailAccountScoped(...args),
      getAllEmailAccountsForWorkspace: (...args: unknown[]) => mockGetEmailAccountsByAgent(...args),
    },
    conversation: {
      getConversationForAgent: (...args: unknown[]) => mockGetConversationForAgent(...args),
    },
    conversationMap: {
      createMapping: (...args: unknown[]) => mockCreateMapping(...args),
    },
    message: {
      createMessage: (...args: unknown[]) => mockCreateMessage(...args),
    },
  },
  };
});

vi.mock("@/lib/middleware/auth", () => ({
  withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => {
    const params = ctx?.params instanceof Promise ? await ctx.params : ctx?.params;
    return handler(req, { env: { DB: {}, EMAIL_WORKER: { fetch: (...args: unknown[]) => mockEmailWorkerFetch(...args) }, EMAIL_BUCKET: { get: (...args: unknown[]) => mockEmailBucketGet(...args), put: (...args: unknown[]) => mockEmailBucketPut(...args) }, WORKER_SELF_REFERENCE: { fetch: (...args: unknown[]) => mockWorkerSelfRefFetch(...args) }, EMAIL_NOTIFY_SECRET: "notify-secret", PHNEAKNGAR_DOMAIN: "agents.example" }, userId: "u1", email: "u@t.com", params });
  }),
}));

vi.mock("@/lib/middleware/workspace", () => ({
  withWorkspaceMember: vi.fn(async () => ({ workspaceId: "ws1" })),
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

vi.mock("@/lib/api/responses", () => ({
  emailToResponse: (e: any) => e,
  approvalToResponse: (a: any) => a,
}));

vi.mock("@/lib/broadcast", () => ({
  broadcastToUser: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "./route";

function makeReq(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/email/send?workspace_id=ws1", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/email/send", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Echo claimed identities so route identity-contract checks pass by default.
    mockEmailWorkerFetch.mockImplementation(async (_url: string, init?: { body?: string }) => {
      const body = init?.body ? JSON.parse(init.body) : {};
      return Response.json({
        ok: true,
        r2Key: body.r2Key ?? "emails/echo/raw",
        messageId: body.messageId ?? "<echo@agents.example>",
      });
    });
  });

  it("sends email via EMAIL_WORKER and returns the claimed sent record", async () => {
    mockGetAgent.mockResolvedValue({ id: "a1", emailHandle: "test-agent" });
    const claim = mockFreshClaim();
    mockEmailWorkerFetch.mockResolvedValue(
      Response.json({ ok: true, r2Key: claim.r2Key, messageId: claim.messageId }),
    );

    const req = makeReq({
      agentId: "a1",
      to: "user@example.com",
      subject: "Hello",
      htmlBody: "<p>Hi there</p>",
      idempotencyKey: "key-1",
    });

    const res = await POST(req, {} as any);
    expect(res.status).toBe(200);

    expect(mockClaimOutbound).toHaveBeenCalledOnce();
    const claimArgs = mockClaimOutbound.mock.calls[0]![1] as any;
    expect(claimArgs.idempotencyKey).toBe("key-1");

    expect(mockEmailWorkerFetch).toHaveBeenCalledOnce();
    const [url, init] = mockEmailWorkerFetch.mock.calls[0];
    expect(url).toBe("http://internal/send/agent");
    expect(init.method).toBe("POST");
    const fetchBody = JSON.parse(init.body);
    expect(fetchBody.agentId).toBe("a1");
    expect(fetchBody.to).toBe("user@example.com");
    expect(fetchBody.subject).toBe("Hello");
    expect(fetchBody.htmlBody).toBe("<p>Hi there</p>");
    expect(fetchBody.messageId).toBe(claim.messageId);
    expect(fetchBody.r2Key).toBe(claim.r2Key);
    expect(fetchBody.attachmentKeys).toBeUndefined();

    expect(mockMarkSent).toHaveBeenCalledOnce();
    expect(mockCreateEmail).not.toHaveBeenCalled();
  });

  it("sends email with attachments via EMAIL_WORKER", async () => {
    mockGetAgent.mockResolvedValue({ id: "a1", emailHandle: "test-agent" });
    const claim = mockFreshClaim();
    mockEmailWorkerFetch.mockResolvedValue(
      Response.json({ ok: true, r2Key: claim.r2Key, messageId: claim.messageId }),
    );

    const attachments = [
      { key: "emails/drafts/ws1/u1/x/doc.txt", filename: "doc.txt", size: 12, contentType: "text/plain" },
    ];

    const req = makeReq({
      agentId: "a1",
      to: "user@example.com",
      subject: "With attachment",
      htmlBody: "<p>See attached</p>",
      attachments,
      idempotencyKey: "key-att",
    });

    const res = await POST(req, {} as any);
    expect(res.status).toBe(200);

    const fetchBody = JSON.parse(mockEmailWorkerFetch.mock.calls[0][1].body);
    expect(fetchBody.attachmentKeys).toEqual([
      { key: "emails/drafts/ws1/u1/x/doc.txt", filename: "doc.txt", contentType: "text/plain" },
    ]);
    expect(fetchBody.messageId).toBe(claim.messageId);
    expect(fetchBody.r2Key).toBe(claim.r2Key);

    const claimArgs = mockClaimOutbound.mock.calls[0]![1] as any;
    expect(claimArgs.attachments).toBe(JSON.stringify(attachments));
  });

  it("rejects attachment keys outside the authenticated user's draft scope", async () => {
    mockGetAgent.mockResolvedValue({ id: "a1", emailHandle: "test-agent" });

    const req = makeReq({
      agentId: "a1",
      to: "user@example.com",
      subject: "Bad attachment",
      htmlBody: "<p>Nope</p>",
      attachments: [
        { key: "emails/drafts/ws1/u2/x/doc.txt", filename: "doc.txt", size: 12, contentType: "text/plain" },
      ],
    });

    const res = await POST(req, {} as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid attachment key");
    expect(mockEmailWorkerFetch).not.toHaveBeenCalled();
    expect(mockEmailBucketGet).not.toHaveBeenCalled();
    expect(mockClaimOutbound).not.toHaveBeenCalled();
  });

  it("returns error when EMAIL_WORKER fails pre-send", async () => {
    mockGetAgent.mockResolvedValue({ id: "a1", emailHandle: "test-agent" });
    mockFreshClaim();
    mockEmailWorkerFetch.mockResolvedValue(
      new Response(JSON.stringify({ error: "agent not found", phase: "pre_send" }), { status: 404 }),
    );

    const req = makeReq({
      agentId: "a1",
      to: "user@example.com",
      subject: "Hello",
      htmlBody: "<p>Hi</p>",
      idempotencyKey: "fail-pre",
    });

    const res = await POST(req, {} as any);
    expect(res.status).toBe(404);
    expect(mockMarkFailed).toHaveBeenCalledOnce();
    expect(mockMarkAmbiguous).not.toHaveBeenCalled();
  });

  it("exact retry returns sent claim without second provider send", async () => {
    mockGetAgent.mockResolvedValue({ id: "a1", emailHandle: "test-agent" });
    const email = claimedEmail({ status: "sent" });
    mockClaimOutbound.mockResolvedValue({ outcome: "replay", email });

    const req = makeReq({
      agentId: "a1",
      to: "user@example.com",
      subject: "Hello",
      htmlBody: "<p>Hi</p>",
      idempotencyKey: "replay-1",
    });

    const res = await POST(req, {} as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.messageId).toBe(email.messageId);
    expect(body.r2Key).toBe(email.r2Key);
    expect(mockEmailWorkerFetch).not.toHaveBeenCalled();
    expect(mockMarkSending).not.toHaveBeenCalled();
  });

  it("ambiguous claim does not resend", async () => {
    mockGetAgent.mockResolvedValue({ id: "a1", emailHandle: "test-agent" });
    const email = claimedEmail({ status: "ambiguous" });
    mockClaimOutbound.mockResolvedValue({ outcome: "ambiguous", email });

    const res = await POST(makeReq({
      agentId: "a1",
      to: "user@example.com",
      subject: "Hello",
      htmlBody: "<p>Hi</p>",
      idempotencyKey: "amb-1",
    }), {} as any);

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.status).toBe("ambiguous");
    expect(mockEmailWorkerFetch).not.toHaveBeenCalled();
  });

  it("marks ambiguous when worker reports post-send failure", async () => {
    mockGetAgent.mockResolvedValue({ id: "a1", emailHandle: "test-agent" });
    mockFreshClaim();
    mockEmailWorkerFetch.mockResolvedValue(
      new Response(JSON.stringify({ error: "SMTP send failed", phase: "send" }), { status: 500 }),
    );

    const res = await POST(makeReq({
      agentId: "a1",
      to: "user@example.com",
      subject: "Hello",
      htmlBody: "<p>Hi</p>",
      idempotencyKey: "amb-send",
    }), {} as any);

    expect(res.status).toBe(502);
    expect(mockMarkAmbiguous).toHaveBeenCalledOnce();
    expect(mockMarkFailed).not.toHaveBeenCalled();
  });

  it("concurrent in-progress claim does not double-send", async () => {
    mockGetAgent.mockResolvedValue({ id: "a1", emailHandle: "test-agent" });
    const email = claimedEmail({ status: "sending" });
    mockClaimOutbound.mockResolvedValue({ outcome: "in_progress", email });

    const res = await POST(makeReq({
      agentId: "a1",
      to: "user@example.com",
      subject: "Hello",
      htmlBody: "<p>Hi</p>",
      idempotencyKey: "concurrent",
    }), {} as any);

    expect(res.status).toBe(409);
    expect(mockEmailWorkerFetch).not.toHaveBeenCalled();
  });

  it("returns 400 when agent has no emailHandle", async () => {
    mockGetAgent.mockResolvedValue({ id: "a1", emailHandle: null });

    const req = makeReq({
      agentId: "a1",
      to: "user@example.com",
      subject: "Hello",
      htmlBody: "<p>Hi</p>",
    });

    const res = await POST(req, {} as any);
    expect(res.status).toBe(400);
  });

  it("returns 404 when agent not in workspace", async () => {
    mockGetAgent.mockResolvedValue(null);

    const req = makeReq({
      agentId: "a1",
      to: "user@example.com",
      subject: "Hello",
      htmlBody: "<p>Hi</p>",
    });

    const res = await POST(req, {} as any);
    expect(res.status).toBe(404);
  });

  it("returns 400 when required fields are missing", async () => {
    const req = makeReq({ agentId: "a1" });

    const res = await POST(req, {} as any);
    expect(res.status).toBe(400);
  });

  it("returns 400 for a CRLF-injected subject instead of building forged headers", async () => {
    // Rejected at the schema boundary, so the value never reaches buildMimeMessage
    // (which would throw and surface as a 500).
    mockGetAgent.mockResolvedValue({ id: "a1", emailHandle: "sender-agent", workspaceId: "ws1" });
    const req = makeReq({
      agentId: "a1",
      to: "user@example.com",
      subject: "hi\r\nBcc: attacker@evil.example",
      htmlBody: "<p>Hi</p>",
    });

    const res = await POST(req, {} as any);
    expect(res.status).toBe(400);
  });

  it("returns 400 for a CRLF-injected recipient", async () => {
    mockGetAgent.mockResolvedValue({ id: "a1", emailHandle: "sender-agent", workspaceId: "ws1" });
    const req = makeReq({
      agentId: "a1",
      to: "user@example.com\r\nBcc: attacker@evil.example",
      subject: "Hi",
      htmlBody: "<p>Hi</p>",
    });

    const res = await POST(req, {} as any);
    expect(res.status).toBe(400);
  });

  // --- Local delivery tests ---

  describe("local delivery shortcut", () => {
    it("delivers locally when recipient is same-workspace @agents.example agent", async () => {
      mockGetAgent.mockResolvedValue({ id: "a1", emailHandle: "sender-agent", workspaceId: "ws1" });
      mockGetAgentByHandle.mockResolvedValue({ id: "a2", emailHandle: "agent-b", workspaceId: "ws1" });
      mockIsWhitelisted.mockResolvedValue(true);
      mockWorkerSelfRefFetch.mockResolvedValue(Response.json({ ok: true }));
      const claim = mockFreshClaim({
        fromEmail: "sender-agent@agents.example",
        toEmail: "agent-b@agents.example",
        subject: "Hello local",
        direction: "outbound",
      });

      const req = makeReq({
        agentId: "a1",
        to: "agent-b@agents.example",
        subject: "Hello local",
        htmlBody: "<p>Internal</p>",
        idempotencyKey: "local-1",
      });

      const res = await POST(req, {} as any);
      expect(res.status).toBe(200);

      expect(mockEmailWorkerFetch).not.toHaveBeenCalled();
      expect(mockWorkerSelfRefFetch).toHaveBeenCalledOnce();

      const [url, init] = mockWorkerSelfRefFetch.mock.calls[0];
      expect(url).toBe("http://internal/api/email/notify");
      expect(init.headers["X-Phneakngar-Email-Notify-Secret"]).toBe("notify-secret");
      const payload = JSON.parse(init.body);
      expect(payload.agentId).toBe("a2");
      expect(payload.workspaceId).toBe("ws1");
      expect(payload.from).toBe("sender-agent@agents.example");
      expect(payload.to).toBe("agent-b@agents.example");
      expect(payload.subject).toBe("Hello local");
      expect(payload.forwarded).toBe(false);
      expect(payload.r2Key).toBe(claim.r2Key);
      expect(payload.messageId).toBe(claim.messageId);

      expect(mockClaimOutbound).toHaveBeenCalledOnce();
      expect(mockMarkSent).toHaveBeenCalledOnce();
    });

    it("falls through to EMAIL_WORKER when recipient is in different workspace", async () => {
      mockGetAgent.mockResolvedValue({ id: "a1", emailHandle: "sender-agent", workspaceId: "ws1" });
      mockGetAgentByHandle.mockResolvedValue({ id: "a2", emailHandle: "agent-b", workspaceId: "ws-other" });
      const claim = mockFreshClaim({ fromEmail: "sender-agent@agents.example" });
      mockEmailWorkerFetch.mockResolvedValue(Response.json({ ok: true, r2Key: claim.r2Key, messageId: claim.messageId }));

      const req = makeReq({
        agentId: "a1",
        to: "agent-b@agents.example",
        subject: "Cross workspace",
        htmlBody: "<p>Hi</p>",
        idempotencyKey: "cross-ws",
      });

      const res = await POST(req, {} as any);
      expect(res.status).toBe(200);

      expect(mockWorkerSelfRefFetch).not.toHaveBeenCalled();
      expect(mockEmailWorkerFetch).toHaveBeenCalledOnce();
    });

    it("falls through to EMAIL_WORKER when handle doesn't resolve to any agent", async () => {
      mockGetAgent.mockResolvedValue({ id: "a1", emailHandle: "sender-agent", workspaceId: "ws1" });
      mockGetAgentByHandle.mockResolvedValue(null);
      const claim = mockFreshClaim({ fromEmail: "sender-agent@agents.example" });
      mockEmailWorkerFetch.mockResolvedValue(Response.json({ ok: true, r2Key: claim.r2Key, messageId: claim.messageId }));

      const req = makeReq({
        agentId: "a1",
        to: "nonexistent@agents.example",
        subject: "No agent",
        htmlBody: "<p>Hi</p>",
        idempotencyKey: "no-agent",
      });

      const res = await POST(req, {} as any);
      expect(res.status).toBe(200);

      expect(mockWorkerSelfRefFetch).not.toHaveBeenCalled();
      expect(mockEmailWorkerFetch).toHaveBeenCalledOnce();
    });

    it("falls through to EMAIL_WORKER when recipient is not @agents.example", async () => {
      mockGetAgent.mockResolvedValue({ id: "a1", emailHandle: "sender-agent", workspaceId: "ws1" });
      const claim = mockFreshClaim({ fromEmail: "sender-agent@agents.example" });
      mockEmailWorkerFetch.mockResolvedValue(Response.json({ ok: true, r2Key: claim.r2Key, messageId: claim.messageId }));

      const req = makeReq({
        agentId: "a1",
        to: "user@gmail.com",
        subject: "External",
        htmlBody: "<p>Hi</p>",
        idempotencyKey: "external",
      });

      const res = await POST(req, {} as any);
      expect(res.status).toBe(200);

      expect(mockGetAgentByHandle).not.toHaveBeenCalled();
      expect(mockWorkerSelfRefFetch).not.toHaveBeenCalled();
      expect(mockEmailWorkerFetch).toHaveBeenCalledOnce();
    });

    it("allows self-send via local delivery", async () => {
      mockGetAgent.mockResolvedValue({ id: "a1", emailHandle: "sender-agent", workspaceId: "ws1" });
      mockGetAgentByHandle.mockResolvedValue({ id: "a1", emailHandle: "sender-agent", workspaceId: "ws1" });
      mockIsWhitelisted.mockResolvedValue(false);
      mockWorkerSelfRefFetch.mockResolvedValue(Response.json({ ok: true }));
      mockFreshClaim({ fromEmail: "sender-agent@agents.example", toEmail: "sender-agent@agents.example" });

      const req = makeReq({
        agentId: "a1",
        to: "sender-agent@agents.example",
        subject: "Self",
        htmlBody: "<p>Self</p>",
        idempotencyKey: "self",
      });

      const res = await POST(req, {} as any);
      expect(res.status).toBe(200);

      expect(mockEmailWorkerFetch).not.toHaveBeenCalled();
      expect(mockWorkerSelfRefFetch).toHaveBeenCalledOnce();
    });

    it("fetches attachments from R2 and includes them in MIME for local delivery", async () => {
      mockGetAgent.mockResolvedValue({ id: "a1", emailHandle: "sender-agent", workspaceId: "ws1" });
      mockGetAgentByHandle.mockResolvedValue({ id: "a2", emailHandle: "agent-b", workspaceId: "ws1" });
      mockIsWhitelisted.mockResolvedValue(false);
      mockWorkerSelfRefFetch.mockResolvedValue(Response.json({ ok: true }));
      mockFreshClaim({ fromEmail: "sender-agent@agents.example", toEmail: "agent-b@agents.example" });

      const fileContent = new TextEncoder().encode("hello file");
      mockEmailBucketGet.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(fileContent.buffer),
      });
      mockEmailBucketPut.mockResolvedValue(undefined);

      const attachments = [
        { key: "emails/drafts/ws1/u1/x/doc.txt", filename: "doc.txt", size: 10, contentType: "text/plain" },
      ];

      const req = makeReq({
        agentId: "a1",
        to: "agent-b@agents.example",
        subject: "With file",
        htmlBody: "<p>See attached</p>",
        attachments,
      });

      const res = await POST(req, {} as any);
      expect(res.status).toBe(200);

      expect(mockEmailBucketGet).toHaveBeenCalledWith("emails/drafts/ws1/u1/x/doc.txt");
      expect(mockEmailBucketPut).toHaveBeenCalledOnce();
      const [putKey, putBody, putOpts] = mockEmailBucketPut.mock.calls[0];
      expect(putKey).toMatch(/^emails\/.+\/raw$/);
      expect(putBody).toContain("multipart/mixed");
      expect(putBody).toContain('filename="doc.txt"');
      expect(putOpts.httpMetadata.contentType).toBe("message/rfc822");
    });

    it("fetches multiple attachments from R2 in parallel for local delivery", async () => {
      mockGetAgent.mockResolvedValue({ id: "a1", emailHandle: "sender-agent", workspaceId: "ws1" });
      mockGetAgentByHandle.mockResolvedValue({ id: "a2", emailHandle: "agent-b", workspaceId: "ws1" });
      mockIsWhitelisted.mockResolvedValue(false);
      mockWorkerSelfRefFetch.mockResolvedValue(Response.json({ ok: true }));
      mockFreshClaim({ fromEmail: "sender-agent@agents.example", toEmail: "agent-b@agents.example" });

      const file1 = new TextEncoder().encode("file one");
      const file2 = new TextEncoder().encode("file two");
      const file3 = new TextEncoder().encode("file three");
      mockEmailBucketGet
        .mockResolvedValueOnce({ arrayBuffer: () => Promise.resolve(file1.buffer) })
        .mockResolvedValueOnce({ arrayBuffer: () => Promise.resolve(file2.buffer) })
        .mockResolvedValueOnce({ arrayBuffer: () => Promise.resolve(file3.buffer) });
      mockEmailBucketPut.mockResolvedValue(undefined);

      const attachments = [
        { key: "emails/drafts/ws1/u1/x/a.txt", filename: "a.txt", size: 8, contentType: "text/plain" },
        { key: "emails/drafts/ws1/u1/x/b.txt", filename: "b.txt", size: 8, contentType: "text/plain" },
        { key: "emails/drafts/ws1/u1/x/c.txt", filename: "c.txt", size: 10, contentType: "text/plain" },
      ];

      const req = makeReq({
        agentId: "a1",
        to: "agent-b@agents.example",
        subject: "Multi attach",
        htmlBody: "<p>See files</p>",
        attachments,
      });

      const res = await POST(req, {} as any);
      expect(res.status).toBe(200);

      expect(mockEmailBucketGet).toHaveBeenCalledTimes(3);
      expect(mockEmailBucketGet).toHaveBeenCalledWith("emails/drafts/ws1/u1/x/a.txt");
      expect(mockEmailBucketGet).toHaveBeenCalledWith("emails/drafts/ws1/u1/x/b.txt");
      expect(mockEmailBucketGet).toHaveBeenCalledWith("emails/drafts/ws1/u1/x/c.txt");

      const putBody = mockEmailBucketPut.mock.calls[0][1] as string;
      expect(putBody).toContain('filename="a.txt"');
      expect(putBody).toContain('filename="b.txt"');
      expect(putBody).toContain('filename="c.txt"');
    });

    it("handles large attachments (>64KB) without RangeError", async () => {
      mockGetAgent.mockResolvedValue({ id: "a1", emailHandle: "sender-agent", workspaceId: "ws1" });
      mockGetAgentByHandle.mockResolvedValue({ id: "a2", emailHandle: "agent-b", workspaceId: "ws1" });
      mockIsWhitelisted.mockResolvedValue(false);
      mockWorkerSelfRefFetch.mockResolvedValue(Response.json({ ok: true }));
      mockFreshClaim();

      // Create a 100KB buffer — larger than the ~65,536 arg limit that caused the stack overflow
      const largeBuffer = new Uint8Array(100 * 1024);
      for (let i = 0; i < largeBuffer.length; i++) largeBuffer[i] = i % 256;
      mockEmailBucketGet.mockResolvedValue({
        arrayBuffer: () => Promise.resolve(largeBuffer.buffer),
      });
      mockEmailBucketPut.mockResolvedValue(undefined);

      const attachments = [
        { key: "emails/drafts/ws1/u1/x/large.bin", filename: "large.bin", size: 100 * 1024, contentType: "application/octet-stream" },
      ];

      const req = makeReq({
        agentId: "a1",
        to: "agent-b@agents.example",
        subject: "Large attachment",
        htmlBody: "<p>Big file</p>",
        attachments,
      });

      const res = await POST(req, {} as any);
      expect(res.status).toBe(200);

      expect(mockEmailBucketGet).toHaveBeenCalledWith("emails/drafts/ws1/u1/x/large.bin");
      const putBody = mockEmailBucketPut.mock.calls[0][1] as string;
      expect(putBody).toContain('filename="large.bin"');
    });

    it("skips attachments that return null from R2 in parallel fetch", async () => {
      mockGetAgent.mockResolvedValue({ id: "a1", emailHandle: "sender-agent", workspaceId: "ws1" });
      mockGetAgentByHandle.mockResolvedValue({ id: "a2", emailHandle: "agent-b", workspaceId: "ws1" });
      mockIsWhitelisted.mockResolvedValue(false);
      mockWorkerSelfRefFetch.mockResolvedValue(Response.json({ ok: true }));
      mockFreshClaim();

      const file1 = new TextEncoder().encode("file one");
      mockEmailBucketGet
        .mockResolvedValueOnce({ arrayBuffer: () => Promise.resolve(file1.buffer) })
        .mockResolvedValueOnce(null);
      mockEmailBucketPut.mockResolvedValue(undefined);

      const attachments = [
        { key: "emails/drafts/ws1/u1/x/exists.txt", filename: "exists.txt", size: 8, contentType: "text/plain" },
        { key: "emails/drafts/ws1/u1/x/missing.txt", filename: "missing.txt", size: 5, contentType: "text/plain" },
      ];

      const req = makeReq({
        agentId: "a1",
        to: "agent-b@agents.example",
        subject: "Partial attach",
        htmlBody: "<p>Partial</p>",
        attachments,
      });

      const res = await POST(req, {} as any);
      expect(res.status).toBe(200);

      expect(mockEmailBucketGet).toHaveBeenCalledTimes(2);
      const putBody = mockEmailBucketPut.mock.calls[0][1] as string;
      expect(putBody).toContain('filename="exists.txt"');
      expect(putBody).not.toContain('filename="missing.txt"');
    });

    it("checks whitelist and passes result in notify payload", async () => {
      mockGetAgent.mockResolvedValue({ id: "a1", emailHandle: "sender-agent", workspaceId: "ws1" });
      mockGetAgentByHandle.mockResolvedValue({ id: "a2", emailHandle: "agent-b", workspaceId: "ws1" });
      mockIsWhitelisted.mockResolvedValue(true);
      mockWorkerSelfRefFetch.mockResolvedValue(Response.json({ ok: true }));
      mockFreshClaim();

      const req = makeReq({
        agentId: "a1",
        to: "agent-b@agents.example",
        subject: "Whitelist test",
        htmlBody: "<p>Check</p>",
      });

      await POST(req, {} as any);

      expect(mockIsWhitelisted).toHaveBeenCalledWith(
        expect.anything(), "a2", "ws1", "sender-agent@agents.example", "agents.example"
      );
      const payload = JSON.parse(mockWorkerSelfRefFetch.mock.calls[0][1].body);
      expect(payload.isWhitelisted).toBe(true);
    });

    it("notify payload matches expected schema shape", async () => {
      mockGetAgent.mockResolvedValue({ id: "a1", emailHandle: "sender-agent", workspaceId: "ws1" });
      mockGetAgentByHandle.mockResolvedValue({ id: "a2", emailHandle: "agent-b", workspaceId: "ws1" });
      mockIsWhitelisted.mockResolvedValue(false);
      mockWorkerSelfRefFetch.mockResolvedValue(Response.json({ ok: true }));
      mockFreshClaim();

      const req = makeReq({
        agentId: "a1",
        to: "agent-b@agents.example",
        subject: "Schema test",
        htmlBody: "<p>Schema</p>",
        inReplyTo: "<orig@agents.example>",
        references: "<ref1@agents.example> <ref2@agents.example>",
      });

      await POST(req, {} as any);

      const payload = JSON.parse(mockWorkerSelfRefFetch.mock.calls[0][1].body);
      expect(payload.agentId).toBe("a2");
      expect(payload.workspaceId).toBe("ws1");
      expect(payload.from).toBe("sender-agent@agents.example");
      expect(payload.to).toBe("agent-b@agents.example");
      expect(payload.subject).toBe("Schema test");
      expect(payload.forwarded).toBe(false);
      expect(payload.isWhitelisted).toBe(false);
      expect(payload.r2Key).toMatch(/^emails\/.+\/raw$/);
      expect(payload.messageId).toMatch(/^<.+@agents\.example>$/);
      expect(payload.inReplyTo).toBe("<orig@agents.example>");
      expect(payload.references).toBe("<ref1@agents.example> <ref2@agents.example>");
    });

    it("generates correct messageId and r2Key in outbound record", async () => {
      mockGetAgent.mockResolvedValue({ id: "a1", emailHandle: "sender-agent", workspaceId: "ws1" });
      mockGetAgentByHandle.mockResolvedValue({ id: "a2", emailHandle: "agent-b", workspaceId: "ws1" });
      mockIsWhitelisted.mockResolvedValue(false);
      mockWorkerSelfRefFetch.mockResolvedValue(Response.json({ ok: true }));
      mockFreshClaim();

      const req = makeReq({
        agentId: "a1",
        to: "agent-b@agents.example",
        subject: "IDs test",
        htmlBody: "<p>IDs</p>",
      });

      await POST(req, {} as any);

      const claimArgs = mockClaimOutbound.mock.calls[0]![1] as any;
      expect(claimArgs.messageId).toMatch(/^<.+@agents\.example>$/);
      expect(claimArgs.r2Key).toMatch(/^emails\/.+\/raw$/);
    });

    it("skips local delivery when sender uses custom SMTP account", async () => {
      mockGetAgent.mockResolvedValue({ id: "a1", emailHandle: "sender-agent", workspaceId: "ws1" });
      mockGetEmailAccountsByAgent.mockResolvedValue([
        { id: "acct1", agentId: "a1", emailAddress: "agent@company.com" },
      ]);

      mockFreshClaim();

      const req = makeReq({
        agentId: "a1",
        from: "agent@company.com",
        to: "agent-b@agents.example",
        subject: "Custom SMTP",
        htmlBody: "<p>Custom</p>",
      });

      const res = await POST(req, {} as any);
      expect(res.status).toBe(200);

      expect(mockGetAgentByHandle).not.toHaveBeenCalled();
      expect(mockWorkerSelfRefFetch).not.toHaveBeenCalled();
      expect(mockEmailWorkerFetch).toHaveBeenCalledOnce();
    });

    it("returns ambiguous when notify endpoint fails after local provider attempt", async () => {
      mockGetAgent.mockResolvedValue({ id: "a1", emailHandle: "sender-agent", workspaceId: "ws1" });
      mockGetAgentByHandle.mockResolvedValue({ id: "a2", emailHandle: "agent-b", workspaceId: "ws1" });
      mockIsWhitelisted.mockResolvedValue(false);
      mockEmailBucketPut.mockResolvedValue(undefined);
      mockFreshClaim({ fromEmail: "sender-agent@agents.example", toEmail: "agent-b@agents.example" });
      mockWorkerSelfRefFetch.mockResolvedValue(
        new Response("notify validation error", { status: 400 }),
      );

      const req = makeReq({
        agentId: "a1",
        to: "agent-b@agents.example",
        subject: "Fail notify",
        htmlBody: "<p>Fail</p>",
        idempotencyKey: "fail-notify",
      });

      const res = await POST(req, {} as any);
      expect(res.status).toBe(502);

      const body = await res.json();
      expect(body.error).toContain("local delivery ambiguous");
      expect(body.status).toBe("ambiguous");
      expect(mockMarkAmbiguous).toHaveBeenCalledOnce();
      expect(mockMarkSent).not.toHaveBeenCalled();
    });

    it("marks failed (retryable) when R2 archive fails before local notify", async () => {
      mockGetAgent.mockResolvedValue({ id: "a1", emailHandle: "sender-agent", workspaceId: "ws1" });
      mockGetAgentByHandle.mockResolvedValue({ id: "a2", emailHandle: "agent-b", workspaceId: "ws1" });
      mockFreshClaim({ fromEmail: "sender-agent@agents.example", toEmail: "agent-b@agents.example" });
      mockEmailBucketPut.mockRejectedValue(new Error("R2 unavailable"));

      const res = await POST(makeReq({
        agentId: "a1",
        to: "agent-b@agents.example",
        subject: "Fail R2",
        htmlBody: "<p>x</p>",
        idempotencyKey: "fail-r2",
      }), {} as any);

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.status).toBe("failed");
      expect(mockMarkFailed).toHaveBeenCalledOnce();
      expect(mockMarkAmbiguous).not.toHaveBeenCalled();
      expect(mockWorkerSelfRefFetch).not.toHaveBeenCalled();
    });

    it("marks ambiguous (not failed) when finalize fails after successful notify", async () => {
      mockGetAgent.mockResolvedValue({ id: "a1", emailHandle: "sender-agent", workspaceId: "ws1", ownerId: "u1" });
      mockGetAgentByHandle.mockResolvedValue({ id: "a2", emailHandle: "agent-b", workspaceId: "ws1" });
      mockIsWhitelisted.mockResolvedValue(false);
      mockEmailBucketPut.mockResolvedValue(undefined);
      mockFreshClaim({ fromEmail: "sender-agent@agents.example", toEmail: "agent-b@agents.example" });
      mockWorkerSelfRefFetch.mockResolvedValue(Response.json({ ok: true }));
      mockMarkSent.mockRejectedValue(new Error("d1 write failed after notify"));

      const res = await POST(makeReq({
        agentId: "a1",
        to: "agent-b@agents.example",
        subject: "Post-notify fail",
        htmlBody: "<p>x</p>",
        idempotencyKey: "post-notify-fail",
      }), {} as any);

      expect(res.status).toBe(502);
      const body = await res.json();
      expect(body.status).toBe("ambiguous");
      expect(mockMarkAmbiguous).toHaveBeenCalledOnce();
      expect(mockMarkFailed).not.toHaveBeenCalled();
    });
  });

  describe("conversation_map mapping creation", () => {
    it("creates mapping on local delivery when conversationId is provided", async () => {
      mockGetAgent.mockResolvedValue({ id: "a1", emailHandle: "sender-agent", workspaceId: "ws1" });
      mockGetAgentByHandle.mockResolvedValue({ id: "a2", emailHandle: "agent-b", workspaceId: "ws1" });
      mockIsWhitelisted.mockResolvedValue(false);
      mockWorkerSelfRefFetch.mockResolvedValue(Response.json({ ok: true }));
      mockFreshClaim();
      mockGetConversationForAgent.mockResolvedValue({ id: "conv_123" });

      const req = makeReq({
        agentId: "a1",
        to: "agent-b@agents.example",
        subject: "Map test",
        htmlBody: "<p>Map</p>",
        conversationId: "conv_123",
      });

      const res = await POST(req, {} as any);
      expect(res.status).toBe(200);
      expect(mockGetConversationForAgent).toHaveBeenCalledWith(
        {},
        "conv_123",
        "ws1",
        "u1",
        "a1",
      );
      expect(mockCreateMapping).toHaveBeenCalledOnce();
      const args = mockCreateMapping.mock.calls[0]![1] as any;
      expect(args.workspaceId).toBe("ws1");
      expect(args.conversationId).toBe("conv_123");
      expect(args.key).toMatch(/^email:a1:/);
    });

    it("does NOT create mapping on local delivery without conversationId", async () => {
      mockGetAgent.mockResolvedValue({ id: "a1", emailHandle: "sender-agent", workspaceId: "ws1" });
      mockGetAgentByHandle.mockResolvedValue({ id: "a2", emailHandle: "agent-b", workspaceId: "ws1" });
      mockIsWhitelisted.mockResolvedValue(false);
      mockWorkerSelfRefFetch.mockResolvedValue(Response.json({ ok: true }));
      mockFreshClaim();

      const req = makeReq({
        agentId: "a1",
        to: "agent-b@agents.example",
        subject: "No map",
        htmlBody: "<p>No map</p>",
      });

      const res = await POST(req, {} as any);
      expect(res.status).toBe(200);
      expect(mockCreateMapping).not.toHaveBeenCalled();
    });

    it("creates mapping on remote delivery from claimed messageId when conversationId is provided", async () => {
      mockGetAgent.mockResolvedValue({ id: "a1", emailHandle: "test-agent" });

      const claim = mockFreshClaim({ messageId: "<claim-msg@agents.example>" });
      mockGetConversationForAgent.mockResolvedValue({ id: "conv_456" });

      const req = makeReq({
        agentId: "a1",
        to: "user@example.com",
        subject: "Remote map",
        htmlBody: "<p>Remote</p>",
        conversationId: "conv_456",
        idempotencyKey: "remote-map",
      });

      const res = await POST(req, {} as any);
      expect(res.status).toBe(200);
      expect(mockCreateMapping).toHaveBeenCalledOnce();
      const args = mockCreateMapping.mock.calls[0]![1] as any;
      expect(args.workspaceId).toBe("ws1");
      expect(args.conversationId).toBe("conv_456");
      expect(args.key).toBe(`email:a1:${claim.messageId}`);
    });

    it("does NOT create mapping when conversationId does not belong to workspace", async () => {
      mockGetAgent.mockResolvedValue({ id: "a1", emailHandle: "sender-agent", workspaceId: "ws1" });
      mockGetAgentByHandle.mockResolvedValue({ id: "a2", emailHandle: "agent-b", workspaceId: "ws1" });
      mockIsWhitelisted.mockResolvedValue(false);
      mockWorkerSelfRefFetch.mockResolvedValue(Response.json({ ok: true }));
      mockFreshClaim();
      mockGetConversationForAgent.mockResolvedValue(null);

      const req = makeReq({
        agentId: "a1",
        to: "agent-b@agents.example",
        subject: "Bad conv",
        htmlBody: "<p>Bad</p>",
        conversationId: "conv_other_workspace",
      });

      const res = await POST(req, {} as any);
      expect(res.status).toBe(200);
      expect(mockCreateMapping).not.toHaveBeenCalled();
    });

    it("does not link a same-workspace conversation owned by another user", async () => {
      mockGetAgent.mockResolvedValue({
        id: "a1",
        emailHandle: "sender-agent",
        workspaceId: "ws1",
        ownerId: "u1",
      });
      mockGetAgentByHandle.mockResolvedValue({ id: "a2", emailHandle: "agent-b", workspaceId: "ws1" });
      mockIsWhitelisted.mockResolvedValue(false);
      mockWorkerSelfRefFetch.mockResolvedValue(Response.json({ ok: true, conversationId: "conv_b" }));
      mockFreshClaim();
      mockGetConversationForAgent.mockResolvedValue(null);

      const res = await POST(makeReq({
        agentId: "a1",
        to: "agent-b@agents.example",
        subject: "Other user's conversation",
        htmlBody: "<p>Private</p>",
        conversationId: "conv_other_user",
      }), {} as any);

      expect(res.status).toBe(200);
      expect(mockGetConversationForAgent).toHaveBeenCalledWith(
        {},
        "conv_other_user",
        "ws1",
        "u1",
        "a1",
      );
      expect(mockCreateMapping).not.toHaveBeenCalled();
      expect(mockCreateMessage).not.toHaveBeenCalled();
      const payload = JSON.parse(mockWorkerSelfRefFetch.mock.calls[0][1].body);
      expect(payload.senderConversationId).toBeUndefined();
      expect(payload.senderAgentId).toBeUndefined();
    });

    it("does not link a conversation owned by the user but assigned to another agent", async () => {
      mockGetAgent.mockResolvedValue({
        id: "a1",
        emailHandle: "sender-agent",
        workspaceId: "ws1",
        ownerId: "u1",
      });
      mockGetAgentByHandle.mockResolvedValue({ id: "a2", emailHandle: "agent-b", workspaceId: "ws1" });
      mockIsWhitelisted.mockResolvedValue(false);
      mockWorkerSelfRefFetch.mockResolvedValue(Response.json({ ok: true, conversationId: "conv_b" }));
      mockFreshClaim();
      mockGetConversationForAgent.mockResolvedValue(null);

      const res = await POST(makeReq({
        agentId: "a1",
        to: "agent-b@agents.example",
        subject: "Wrong agent conversation",
        htmlBody: "<p>Private</p>",
        conversationId: "conv_agent_2",
      }), {} as any);

      expect(res.status).toBe(200);
      expect(mockGetConversationForAgent).toHaveBeenCalledWith(
        {},
        "conv_agent_2",
        "ws1",
        "u1",
        "a1",
      );
      expect(mockCreateMapping).not.toHaveBeenCalled();
      expect(mockCreateMessage).not.toHaveBeenCalled();
      const payload = JSON.parse(mockWorkerSelfRefFetch.mock.calls[0][1].body);
      expect(payload.senderConversationId).toBeUndefined();
      expect(payload.senderAgentId).toBeUndefined();
    });

    it("does NOT create mapping on remote delivery when conversationId is omitted", async () => {
      mockGetAgent.mockResolvedValue({ id: "a1", emailHandle: "test-agent" });

      mockFreshClaim();

      const req = makeReq({
        agentId: "a1",
        to: "user@example.com",
        subject: "Remote no conv",
        htmlBody: "<p>No conv</p>",
        idempotencyKey: "remote-no-conv",
      });

      const res = await POST(req, {} as any);
      expect(res.status).toBe(200);
      expect(mockCreateMapping).not.toHaveBeenCalled();
    });
  });

  describe("cross-link metadata (targetConversationId)", () => {
    it("passes senderConversationId in notify payload for internal non-self delivery (TC1)", async () => {
      mockGetAgent.mockResolvedValue({ id: "a1", emailHandle: "sender-agent", workspaceId: "ws1", ownerId: "u1" });
      mockGetAgentByHandle.mockResolvedValue({ id: "a2", emailHandle: "agent-b", workspaceId: "ws1" });
      mockIsWhitelisted.mockResolvedValue(true);
      mockWorkerSelfRefFetch.mockResolvedValue(Response.json({ ok: true, conversationId: "conv_b" }));
      mockFreshClaim();
      mockGetConversationForAgent.mockResolvedValue({ id: "conv_a" });
      mockCreateMessage.mockResolvedValue({ id: "m1", conversationId: "conv_a", role: "event", content: "", taskId: null, createdAt: "2026-01-01" });

      const req = makeReq({
        agentId: "a1",
        to: "agent-b@agents.example",
        subject: "Cross link",
        htmlBody: "<p>Hi</p>",
        conversationId: "conv_a",
      });

      const res = await POST(req, {} as any);
      expect(res.status).toBe(200);

      const payload = JSON.parse(mockWorkerSelfRefFetch.mock.calls[0][1].body);
      expect(payload.senderConversationId).toBe("conv_a");
      expect(payload.senderAgentId).toBe("a1");
    });

    it("stamps targetConversationId in outbound event metadata (TC1)", async () => {
      mockGetAgent.mockResolvedValue({ id: "a1", emailHandle: "sender-agent", workspaceId: "ws1", ownerId: "u1" });
      mockGetAgentByHandle.mockResolvedValue({ id: "a2", emailHandle: "agent-b", workspaceId: "ws1" });
      mockIsWhitelisted.mockResolvedValue(true);
      mockWorkerSelfRefFetch.mockResolvedValue(Response.json({ ok: true, conversationId: "conv_b" }));
      mockFreshClaim();
      mockGetConversationForAgent.mockResolvedValue({ id: "conv_a" });
      mockCreateMessage.mockResolvedValue({ id: "m1", conversationId: "conv_a", role: "event", content: "", taskId: null, createdAt: "2026-01-01" });

      const req = makeReq({
        agentId: "a1",
        to: "agent-b@agents.example",
        subject: "Cross link",
        htmlBody: "<p>Hi</p>",
        conversationId: "conv_a",
      });

      await POST(req, {} as any);

      const metadataArg = mockCreateMessage.mock.calls[0]![1] as { metadata: string };
      const parsed = JSON.parse(metadataArg.metadata);
      expect(parsed.targetConversationId).toBe("conv_b");
      expect(parsed.targetAgentId).toBe("a2");
      expect(parsed.direction).toBe("outbound");
    });

    it("does NOT include cross-link metadata for external emails (TC3)", async () => {
      mockGetAgent.mockResolvedValue({ id: "a1", emailHandle: "test-agent", ownerId: "u1" });

      mockFreshClaim();
      mockGetConversationForAgent.mockResolvedValue({ id: "conv_a" });
      mockCreateMessage.mockResolvedValue({ id: "m1", conversationId: "conv_a", role: "event", content: "", taskId: null, createdAt: "2026-01-01" });

      const req = makeReq({
        agentId: "a1",
        to: "user@gmail.com",
        subject: "External",
        htmlBody: "<p>Hi</p>",
        conversationId: "conv_a",
      });

      await POST(req, {} as any);

      const metadataArg = mockCreateMessage.mock.calls[0]![1] as { metadata: string };
      const parsed = JSON.parse(metadataArg.metadata);
      expect(parsed.targetConversationId).toBeUndefined();
      expect(parsed.targetAgentId).toBeUndefined();
    });

    it("does NOT pass senderConversationId for self-send (TC16)", async () => {
      mockGetAgent.mockResolvedValue({ id: "a1", emailHandle: "sender-agent", workspaceId: "ws1", ownerId: "u1" });
      mockGetAgentByHandle.mockResolvedValue({ id: "a1", emailHandle: "sender-agent", workspaceId: "ws1" });
      mockIsWhitelisted.mockResolvedValue(false);
      mockWorkerSelfRefFetch.mockResolvedValue(Response.json({ ok: true }));
      mockFreshClaim();
      mockGetConversationForAgent.mockResolvedValue({ id: "conv_a" });

      const req = makeReq({
        agentId: "a1",
        to: "sender-agent@agents.example",
        subject: "Self send",
        htmlBody: "<p>Self</p>",
        conversationId: "conv_a",
      });

      await POST(req, {} as any);

      const payload = JSON.parse(mockWorkerSelfRefFetch.mock.calls[0][1].body);
      expect(payload.senderConversationId).toBeUndefined();
      expect(payload.senderAgentId).toBeUndefined();
    });

    it("notify failure does NOT create orphaned mapping (TC17)", async () => {
      mockGetAgent.mockResolvedValue({ id: "a1", emailHandle: "sender-agent", workspaceId: "ws1" });
      mockGetAgentByHandle.mockResolvedValue({ id: "a2", emailHandle: "agent-b", workspaceId: "ws1" });
      mockIsWhitelisted.mockResolvedValue(false);
      mockEmailBucketPut.mockResolvedValue(undefined);
      mockFreshClaim({ fromEmail: "sender-agent@agents.example", toEmail: "agent-b@agents.example" });
      mockWorkerSelfRefFetch.mockResolvedValue(
        new Response("notify failed", { status: 500 }),
      );
      mockGetConversationForAgent.mockResolvedValue({ id: "conv_a" });

      const req = makeReq({
        agentId: "a1",
        to: "agent-b@agents.example",
        subject: "Fail notify map",
        htmlBody: "<p>Fail</p>",
        conversationId: "conv_a",
        idempotencyKey: "fail-notify-map",
      });

      const res = await POST(req, {} as any);
      expect(res.status).toBe(502);
      expect(mockCreateMapping).not.toHaveBeenCalled();
      expect(mockMarkAmbiguous).toHaveBeenCalledOnce();
      expect(mockMarkSent).not.toHaveBeenCalled();
    });
  });

  it("requiresApproval queues pending_approval and creates approval row without sending", async () => {
    mockGetAgent.mockResolvedValue({ id: "a1", emailHandle: "test-agent" });
    const email = claimedEmail({ status: "pending_approval" });
    mockClaimOutbound.mockResolvedValue({ outcome: "claimed", email });
    mockCreateApproval.mockResolvedValue({
      id: "ap_1",
      kind: "outbound_email",
      status: "pending",
      payload: { emailId: "e1" },
    });

    const res = await POST(
      makeReq({
        agentId: "a1",
        to: "user@example.com",
        subject: "Needs review",
        htmlBody: "<p>Draft</p>",
        idempotencyKey: "approve-1",
        requiresApproval: true,
      }),
      {} as any,
    );
    const body = await res.json();

    expect(res.status).toBe(202);
    expect(body.status).toBe("pending_approval");
    expect(body.email.status).toBe("pending_approval");
    expect(body.approval.id).toBe("ap_1");
    expect(mockCreateApproval).toHaveBeenCalledOnce();
    const approvalArgs = mockCreateApproval.mock.calls[0]![1] as any;
    expect(approvalArgs.kind).toBe("outbound_email");
    expect(approvalArgs.payload.emailId).toBe("e1");
    expect(mockMarkSending).not.toHaveBeenCalled();
    expect(mockEmailWorkerFetch).not.toHaveBeenCalled();

    const claimArgs = mockClaimOutbound.mock.calls[0]![1] as any;
    expect(claimArgs.status).toBe("pending_approval");
  });

  it("returns 409 when delivery key is already pending_approval", async () => {
    mockGetAgent.mockResolvedValue({ id: "a1", emailHandle: "test-agent" });
    const email = claimedEmail({ status: "pending_approval" });
    mockClaimOutbound.mockResolvedValue({ outcome: "pending_approval", email });

    const res = await POST(
      makeReq({
        agentId: "a1",
        to: "user@example.com",
        subject: "Needs review",
        htmlBody: "<p>Draft</p>",
        idempotencyKey: "approve-dup",
        requiresApproval: true,
      }),
      {} as any,
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.status).toBe("pending_approval");
    expect(mockCreateApproval).not.toHaveBeenCalled();
    expect(mockEmailWorkerFetch).not.toHaveBeenCalled();
  });
});
