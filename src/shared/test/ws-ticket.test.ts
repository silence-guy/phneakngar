import { describe, expect, it } from "vitest";
import {
  issueWsConnectionTicket,
  validateWsConnectionTicket,
  WS_CHHLAT_TICKET_AUDIENCE,
  WS_USER_TICKET_AUDIENCE,
} from "../src/ws-ticket";

describe("WebSocket connection tickets", () => {
  it("validates a current user ticket", async () => {
    const { ticket, payload } = await issueWsConnectionTicket("secret", {
      userId: "u1",
      nowMs: 1_000_000,
      ttlSeconds: 60,
    });

    const result = await validateWsConnectionTicket("secret", ticket, {
      expectedSubject: "u1",
      nowMs: 1_001_000,
    });

    expect(result).toEqual({ ok: true, payload });
  });

  it("rejects expired tickets", async () => {
    const { ticket } = await issueWsConnectionTicket("secret", {
      userId: "u1",
      nowMs: 1_000_000,
      ttlSeconds: 1,
    });

    const result = await validateWsConnectionTicket("secret", ticket, {
      nowMs: 1_002_000,
    });

    expect(result).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects tampered tickets", async () => {
    const { ticket } = await issueWsConnectionTicket("secret", { userId: "u1" });
    const [payload, signature] = ticket.split(".");
    const tampered = `${payload}.${signature === "a" ? "b" : "a"}${signature?.slice(1) ?? ""}`;

    const result = await validateWsConnectionTicket("secret", tampered);

    expect(result).toEqual({ ok: false, reason: "bad-signature" });
  });

  it("rejects tickets for another expected subject", async () => {
    const { ticket } = await issueWsConnectionTicket("secret", { userId: "u1" });

    const result = await validateWsConnectionTicket("secret", ticket, {
      expectedSubject: "u2",
    });

    expect(result).toEqual({ ok: false, reason: "wrong-subject" });
  });

  it("validates a chhlat ticket bound to workspace and hostname", async () => {
    const { ticket, payload } = await issueWsConnectionTicket("secret", {
      userId: "u1",
      audience: WS_CHHLAT_TICKET_AUDIENCE,
      workspaceId: "w1",
      chhlatId: "host-1",
    });

    const result = await validateWsConnectionTicket("secret", ticket, {
      expectedAudience: WS_CHHLAT_TICKET_AUDIENCE,
      expectedSubject: "u1",
      expectedWorkspaceId: "w1",
      expectedChhlatId: "host-1",
    });

    expect(result).toEqual({ ok: true, payload });
  });

  it("rejects a user ticket where a chhlat audience is required", async () => {
    const { ticket } = await issueWsConnectionTicket("secret", {
      userId: "u1",
      audience: WS_USER_TICKET_AUDIENCE,
    });

    const result = await validateWsConnectionTicket("secret", ticket, {
      expectedAudience: WS_CHHLAT_TICKET_AUDIENCE,
    });

    expect(result).toEqual({ ok: false, reason: "wrong-audience" });
  });

  it("rejects a chhlat ticket for another hostname", async () => {
    const { ticket } = await issueWsConnectionTicket("secret", {
      userId: "u1",
      audience: WS_CHHLAT_TICKET_AUDIENCE,
      workspaceId: "w1",
      chhlatId: "host-1",
    });

    const result = await validateWsConnectionTicket("secret", ticket, {
      expectedAudience: WS_CHHLAT_TICKET_AUDIENCE,
      expectedSubject: "u1",
      expectedWorkspaceId: "w1",
      expectedChhlatId: "host-2",
    });

    expect(result).toEqual({ ok: false, reason: "wrong-chhlat" });
  });

  it("rejects malformed input", async () => {
    await expect(validateWsConnectionTicket("secret", "not-a-ticket")).resolves.toEqual({
      ok: false,
      reason: "malformed",
    });
  });
});
