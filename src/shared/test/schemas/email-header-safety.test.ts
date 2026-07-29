import { describe, it, expect } from "vitest";
import {
  SendEmailRequestSchema,
  EmailAttachmentSchema,
} from "../../src/schemas";

/**
 * Header-injection guards at the API boundary (CWE-93). buildMimeMessage also throws on
 * CR/LF; rejecting here turns what would be a 500 into a 400 and keeps the bad value from
 * ever reaching the MIME builder.
 */

const VALID = {
  agentId: "a1",
  to: "user@example.com",
  subject: "Hello",
  htmlBody: "<p>hi</p>",
};

describe("SendEmailRequestSchema header safety", () => {
  it("accepts a normal request", () => {
    const parsed = SendEmailRequestSchema.parse(VALID);
    expect(parsed.to).toBe("user@example.com");
    expect(parsed.subject).toBe("Hello");
  });

  it("rejects CRLF in subject (the forged-Bcc payload)", () => {
    const r = SendEmailRequestSchema.safeParse({
      ...VALID,
      subject: "hi\r\nBcc: attacker@evil.example",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(JSON.stringify(r.error.issues)).toContain("must not contain line breaks");
    }
  });

  it("rejects a bare LF and a bare CR in subject", () => {
    expect(SendEmailRequestSchema.safeParse({ ...VALID, subject: "a\nb" }).success).toBe(false);
    expect(SendEmailRequestSchema.safeParse({ ...VALID, subject: "a\rb" }).success).toBe(false);
  });

  it("rejects CRLF in to", () => {
    expect(
      SendEmailRequestSchema.safeParse({
        ...VALID,
        to: "user@example.com\r\nBcc: attacker@evil.example",
      }).success,
    ).toBe(false);
  });

  it("rejects CRLF in inReplyTo and references", () => {
    expect(
      SendEmailRequestSchema.safeParse({ ...VALID, inReplyTo: "<a>\r\nX-Injected: 1" }).success,
    ).toBe(false);
    expect(
      SendEmailRequestSchema.safeParse({ ...VALID, references: "<a>\r\nX-Injected: 1" }).success,
    ).toBe(false);
  });

  it("still enforces the original non-empty constraints", () => {
    expect(SendEmailRequestSchema.safeParse({ ...VALID, subject: "" }).success).toBe(false);
    expect(SendEmailRequestSchema.safeParse({ ...VALID, to: "" }).success).toBe(false);
  });

  it("accepts unicode and long subjects unchanged", () => {
    const subject = "Résumé — ភ្នាក់ងារ " + "x".repeat(300);
    const parsed = SendEmailRequestSchema.parse({ ...VALID, subject });
    expect(parsed.subject).toBe(subject);
  });
});

describe("EmailAttachmentSchema header safety", () => {
  const ATT = { key: "k1", filename: "report.pdf", contentType: "application/pdf" };

  it("accepts a normal attachment", () => {
    expect(EmailAttachmentSchema.parse(ATT).filename).toBe("report.pdf");
  });

  it("rejects CRLF in filename", () => {
    const r = EmailAttachmentSchema.safeParse({
      ...ATT,
      filename: 'a"\r\nContent-Type: text/html\r\n\r\n<script>evil</script>',
    });
    expect(r.success).toBe(false);
  });

  it("rejects CRLF in contentType", () => {
    expect(
      EmailAttachmentSchema.safeParse({ ...ATT, contentType: "text/plain\r\nX-Injected: 1" })
        .success,
    ).toBe(false);
  });

  it("allows a quote in the filename (escaped downstream, not rejected)", () => {
    // Quotes are safe once escaped by buildMimeMessage; only line breaks are fatal.
    expect(EmailAttachmentSchema.safeParse({ ...ATT, filename: 'in"quote.txt' }).success).toBe(
      true,
    );
  });
});
