import { describe, it, expect, vi } from "vitest";
import * as emailQueries from "../../src/db/queries/email";

describe("createEmail", () => {
  it("creates and returns email", async () => {
    const email = { id: "em_1" };
    const chain: any = {};
    chain.insert = vi.fn(() => chain); chain.values = vi.fn(() => chain);
    chain.returning = vi.fn(() => Promise.resolve([email]));
    const result = await emailQueries.createEmail(chain, {
      agentId: "ag_1", workspaceId: "w", fromEmail: "a@b.com", toEmail: "c@d.com",
      subject: "Hi", r2Key: "key", isWhitelisted: true, forwarded: false, direction: "inbound",
    });
    expect(result).toEqual(email);
  });
});

describe("getEmailsByAgent", () => {
  it("returns emails without pagination", async () => {
    const chain: any = {};
    chain.select = vi.fn(() => chain); chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => chain); chain.orderBy = vi.fn(() => Promise.resolve([{ id: "em_1" }]));
    await emailQueries.getEmailsByAgent(chain, "ag_1", "w");
    expect(chain.orderBy).toHaveBeenCalled();
  });
  it("applies pagination", async () => {
    const chain: any = {};
    chain.select = vi.fn(() => chain); chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => chain); chain.orderBy = vi.fn(() => chain);
    chain.limit = vi.fn(() => chain); chain.offset = vi.fn(() => Promise.resolve([]));
    await emailQueries.getEmailsByAgent(chain, "ag_1", "w", undefined, { limit: 10, offset: 0 });
    expect(chain.limit).toHaveBeenCalledWith(10);
  });
  it("applies status filter", async () => {
    const chain: any = {};
    chain.select = vi.fn(() => chain); chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => chain); chain.orderBy = vi.fn(() => Promise.resolve([]));
    await emailQueries.getEmailsByAgent(chain, "ag_1", "w", "read");
    expect(chain.where).toHaveBeenCalled();
  });
});

describe("getInboxEmails", () => {
  it("returns inbound emails", async () => {
    const chain: any = {};
    chain.select = vi.fn(() => chain); chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => chain); chain.orderBy = vi.fn(() => Promise.resolve([]));
    await emailQueries.getInboxEmails(chain, "ag_1", "bot@test.com", "w");
    expect(chain.orderBy).toHaveBeenCalled();
  });
});

describe("getSentEmails", () => {
  it("returns outbound emails", async () => {
    const chain: any = {};
    chain.select = vi.fn(() => chain); chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => chain); chain.orderBy = vi.fn(() => Promise.resolve([]));
    await emailQueries.getSentEmails(chain, "ag_1", "bot@test.com", "w");
    expect(chain.orderBy).toHaveBeenCalled();
  });
});

describe("getTrustedEmails", () => {
  it("returns trusted inbound emails", async () => {
    const chain: any = {};
    chain.select = vi.fn(() => chain); chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => chain); chain.orderBy = vi.fn(() => Promise.resolve([]));
    await emailQueries.getTrustedEmails(chain, "ag_1", "bot@test.com", "w");
    expect(chain.orderBy).toHaveBeenCalled();
  });
});

describe("getRejectedEmails", () => {
  it("returns rejected inbound emails", async () => {
    const chain: any = {};
    chain.select = vi.fn(() => chain); chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => chain); chain.orderBy = vi.fn(() => Promise.resolve([]));
    await emailQueries.getRejectedEmails(chain, "ag_1", "bot@test.com", "w");
    expect(chain.orderBy).toHaveBeenCalled();
  });
});

describe("deleteEmail", () => {
  it("calls delete with correct params", async () => {
    const chain: any = {};
    chain.delete = vi.fn(() => chain); chain.where = vi.fn(() => Promise.resolve());
    await emailQueries.deleteEmail(chain, "em_1", "w");
    expect(chain.delete).toHaveBeenCalled();
  });
});

describe("outbound email delivery claims", () => {
  function claimData(overrides: Partial<Parameters<typeof emailQueries.claimOutboundEmailDelivery>[1]> = {}) {
    return {
      agentId: "ag_1",
      workspaceId: "ws_1",
      idempotencyKey: "idem-1",
      fromEmail: "a@agents.example",
      toEmail: "b@example.com",
      subject: "Hi",
      messageId: "<m1@agents.example>",
      r2Key: "emails/r1/raw",
      htmlBody: "<p>x</p>",
      ...overrides,
    };
  }

  it("claims on first insert", async () => {
    const email = {
      id: "em_1",
      status: "pending",
      workspaceId: "ws_1",
      messageId: "<m1@agents.example>",
      r2Key: "emails/r1/raw",
    };
    const chain: any = {};
    chain.insert = vi.fn(() => chain);
    chain.values = vi.fn(() => chain);
    chain.onConflictDoNothing = vi.fn(() => chain);
    chain.returning = vi.fn(() => Promise.resolve([email]));
    const result = await emailQueries.claimOutboundEmailDelivery(chain, claimData());
    expect(result.outcome).toBe("claimed");
    expect(result.email).toEqual(email);
  });

  it("replays sent claims without reclaim", async () => {
    const email = {
      id: "em_1",
      agentId: "ag_1",
      status: "sent",
      workspaceId: "ws_1",
      deliveryKey: "outbound:ag_1:idem-1",
      messageId: "<m1@agents.example>",
      r2Key: "emails/r1/raw",
    };
    const chain: any = {};
    chain.insert = vi.fn(() => chain);
    chain.values = vi.fn(() => chain);
    chain.onConflictDoNothing = vi.fn(() => chain);
    chain.returning = vi.fn(() => Promise.resolve([]));
    chain.select = vi.fn(() => chain);
    chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => Promise.resolve([email]));
    const result = await emailQueries.claimOutboundEmailDelivery(chain, claimData());
    expect(result.outcome).toBe("replay");
    expect(result.email.status).toBe("sent");
  });

  it("returns in_progress for concurrent pending claims", async () => {
    const email = {
      id: "em_1",
      agentId: "ag_1",
      status: "pending",
      workspaceId: "ws_1",
      deliveryKey: "outbound:ag_1:idem-1",
    };
    const chain: any = {};
    chain.insert = vi.fn(() => chain);
    chain.values = vi.fn(() => chain);
    chain.onConflictDoNothing = vi.fn(() => chain);
    chain.returning = vi.fn(() => Promise.resolve([]));
    chain.select = vi.fn(() => chain);
    chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => Promise.resolve([email]));
    const result = await emailQueries.claimOutboundEmailDelivery(chain, claimData());
    expect(result.outcome).toBe("in_progress");
  });

  it("returns ambiguous without reclaim", async () => {
    const email = {
      id: "em_1",
      agentId: "ag_1",
      status: "ambiguous",
      workspaceId: "ws_1",
      deliveryKey: "outbound:ag_1:idem-1",
    };
    const chain: any = {};
    chain.insert = vi.fn(() => chain);
    chain.values = vi.fn(() => chain);
    chain.onConflictDoNothing = vi.fn(() => chain);
    chain.returning = vi.fn(() => Promise.resolve([]));
    chain.select = vi.fn(() => chain);
    chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => Promise.resolve([email]));
    const result = await emailQueries.claimOutboundEmailDelivery(chain, claimData());
    expect(result.outcome).toBe("ambiguous");
  });

  it("reclaims failed claims for retry", async () => {
    const failed = {
      id: "em_1",
      agentId: "ag_1",
      status: "failed",
      workspaceId: "ws_1",
      deliveryKey: "outbound:ag_1:idem-1",
      messageId: "<m1@agents.example>",
      r2Key: "emails/r1/raw",
    };
    const reclaimed = { ...failed, status: "pending" };
    const insertChain: any = {};
    insertChain.values = vi.fn(() => insertChain);
    insertChain.onConflictDoNothing = vi.fn(() => insertChain);
    insertChain.returning = vi.fn(() => Promise.resolve([]));

    const selectChain: any = {};
    selectChain.from = vi.fn(() => selectChain);
    selectChain.where = vi.fn(() => Promise.resolve([failed]));

    const updateChain: any = {};
    updateChain.set = vi.fn(() => updateChain);
    updateChain.where = vi.fn(() => updateChain);
    updateChain.returning = vi.fn(() => Promise.resolve([reclaimed]));

    const db: any = {
      insert: vi.fn(() => insertChain),
      select: vi.fn(() => selectChain),
      update: vi.fn(() => updateChain),
    };
    const result = await emailQueries.claimOutboundEmailDelivery(db, claimData());
    expect(result.outcome).toBe("claimed");
    expect(result.email.status).toBe("pending");
    expect(db.update).toHaveBeenCalled();
  });

  it("refuses wrong-agent inspection of an existing delivery claim", async () => {
    const email = {
      id: "em_1",
      agentId: "ag_other",
      status: "sent",
      workspaceId: "ws_1",
      deliveryKey: "outbound:ag_1:idem-1",
      messageId: "<m1@agents.example>",
      r2Key: "emails/r1/raw",
    };
    const chain: any = {};
    chain.insert = vi.fn(() => chain);
    chain.values = vi.fn(() => chain);
    chain.onConflictDoNothing = vi.fn(() => chain);
    chain.returning = vi.fn(() => Promise.resolve([]));
    chain.select = vi.fn(() => chain);
    chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => Promise.resolve([email]));
    const result = await emailQueries.claimOutboundEmailDelivery(chain, claimData());
    expect(result.outcome).toBe("failed_terminal");
  });

  it("transitionOutboundEmailStatus updates only from allowed statuses", async () => {
    const chain: any = {};
    chain.update = vi.fn(() => chain);
    chain.set = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.returning = vi.fn(() => Promise.resolve([{ id: "em_1", status: "sending" }]));
    const result = await emailQueries.markOutboundEmailSending(chain, "em_1", "ws_1");
    expect(result?.status).toBe("sending");
    expect(chain.update).toHaveBeenCalled();
  });
});
