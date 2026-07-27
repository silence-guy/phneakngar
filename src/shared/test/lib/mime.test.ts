import { describe, it, expect } from "vitest";
import {
  extractAttachmentMeta,
  filterDownloadableAttachments,
  buildMimeMessage,
} from "../../src/lib/mime";

describe("extractAttachmentMeta", () => {
  it("returns empty array for no attachments", () => {
    expect(extractAttachmentMeta([])).toEqual([]);
  });

  it("extracts meta for disposition=attachment", () => {
    const result = extractAttachmentMeta([
      {
        disposition: "attachment",
        filename: "report.pdf",
        mimeType: "application/pdf",
        content: "aGVsbG8=",
      },
    ]);
    expect(result).toEqual([
      {
        key: "inline:0",
        filename: "report.pdf",
        size: 8,
        contentType: "application/pdf",
      },
    ]);
  });

  it("extracts meta when filename is present even without disposition", () => {
    const result = extractAttachmentMeta([
      {
        disposition: null,
        filename: "image.png",
        mimeType: "image/png",
        content: new ArrayBuffer(1024),
      },
    ]);
    expect(result).toEqual([
      {
        key: "inline:0",
        filename: "image.png",
        size: 1024,
        contentType: "image/png",
      },
    ]);
  });

  it("filters out inline attachments without filename", () => {
    const result = extractAttachmentMeta([
      { disposition: "inline", filename: null, mimeType: "text/plain", content: "hello" },
    ]);
    expect(result).toEqual([]);
  });

  it("uses fallback filename when filename is null but disposition is attachment", () => {
    const result = extractAttachmentMeta([
      { disposition: "attachment", filename: null, mimeType: "text/plain", content: "data" },
    ]);
    expect(result[0].filename).toBe("attachment-0");
  });

  it("uses fallback contentType when mimeType is empty", () => {
    const result = extractAttachmentMeta([
      { disposition: "attachment", filename: "file.bin", mimeType: "", content: "x" },
    ]);
    expect(result[0].contentType).toBe("application/octet-stream");
  });

  it("handles Uint8Array content size as 0 (no byteLength on content check)", () => {
    const content = new Uint8Array([1, 2, 3]);
    const result = extractAttachmentMeta([
      { disposition: "attachment", filename: "data.bin", mimeType: "application/octet-stream", content },
    ]);
    // Uint8Array is not ArrayBuffer and not string, so size = 0
    expect(result[0].size).toBe(0);
  });

  it("handles multiple attachments with sequential indices after filtering", () => {
    const result = extractAttachmentMeta([
      { disposition: "attachment", filename: "a.txt", mimeType: "text/plain", content: "aaa" },
      { disposition: "inline", filename: null, mimeType: "text/html", content: "<p>hi</p>" },
      { disposition: "attachment", filename: "b.txt", mimeType: "text/plain", content: "bb" },
    ]);
    expect(result).toHaveLength(2);
    // After filter, map uses post-filter indices
    expect(result[0].key).toBe("inline:0");
    expect(result[0].filename).toBe("a.txt");
    expect(result[1].key).toBe("inline:1");
    expect(result[1].filename).toBe("b.txt");
  });
});

describe("filterDownloadableAttachments", () => {
  it("returns empty array for empty input", () => {
    expect(filterDownloadableAttachments([])).toEqual([]);
  });

  it("includes attachments with disposition=attachment", () => {
    const atts = [
      { disposition: "attachment", filename: null },
      { disposition: "inline", filename: null },
    ];
    const result = filterDownloadableAttachments(atts);
    expect(result).toHaveLength(1);
    expect(result[0].disposition).toBe("attachment");
  });

  it("includes attachments with a filename regardless of disposition", () => {
    const atts = [
      { disposition: "inline", filename: "image.png" },
      { disposition: null, filename: null },
    ];
    const result = filterDownloadableAttachments(atts);
    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe("image.png");
  });

  it("preserves original object references", () => {
    const original = { disposition: "attachment" as const, filename: "f.txt", extra: 42 };
    const result = filterDownloadableAttachments([original]);
    expect(result[0]).toBe(original);
  });
});

describe("buildMimeMessage", () => {
  it("builds a simple text/html message without attachments", () => {
    const msg = buildMimeMessage({
      from: "sender@example.com",
      to: "recipient@example.com",
      subject: "Hello",
      date: "Mon, 01 Jan 2026 00:00:00 GMT",
      body: "<p>Hi there</p>",
    });
    expect(msg).toContain("From: sender@example.com");
    expect(msg).toContain("To: recipient@example.com");
    expect(msg).toContain("Subject: Hello");
    expect(msg).toContain("Date: Mon, 01 Jan 2026 00:00:00 GMT");
    expect(msg).toContain("MIME-Version: 1.0");
    expect(msg).toContain("Content-Type: text/html; charset=utf-8");
    expect(msg).toContain("<p>Hi there</p>");
    expect(msg).not.toContain("boundary");
  });

  it("builds a text/plain message when bodyType is specified", () => {
    const msg = buildMimeMessage({
      from: "a@b.com",
      to: "c@d.com",
      subject: "Plain",
      date: "Mon, 01 Jan 2026 00:00:00 GMT",
      body: "Hello plain",
      bodyType: "text/plain",
    });
    expect(msg).toContain("Content-Type: text/plain; charset=utf-8");
  });

  it("includes threading headers when provided", () => {
    const msg = buildMimeMessage({
      from: "a@b.com",
      to: "c@d.com",
      subject: "Re: Thread",
      date: "Mon, 01 Jan 2026 00:00:00 GMT",
      body: "reply",
      messageId: "<msg-123@example.com>",
      inReplyTo: "<msg-122@example.com>",
      references: "<msg-121@example.com> <msg-122@example.com>",
    });
    expect(msg).toContain("Message-ID: <msg-123@example.com>");
    expect(msg).toContain("In-Reply-To: <msg-122@example.com>");
    expect(msg).toContain("References: <msg-121@example.com> <msg-122@example.com>");
  });

  it("builds multipart/mixed message with attachments", () => {
    const msg = buildMimeMessage({
      from: "a@b.com",
      to: "c@d.com",
      subject: "With attachment",
      date: "Mon, 01 Jan 2026 00:00:00 GMT",
      body: "<p>See attached</p>",
      attachments: [
        {
          filename: "doc.pdf",
          contentType: "application/pdf",
          base64: "SGVsbG8gV29ybGQ=",
        },
      ],
    });
    expect(msg).toContain("Content-Type: multipart/mixed; boundary=");
    expect(msg).toContain('Content-Disposition: attachment; filename="doc.pdf"');
    expect(msg).toContain("Content-Transfer-Encoding: base64");
    expect(msg).toContain("SGVsbG8gV29ybGQ=");
  });

  it("wraps long base64 content at 76 characters", () => {
    const longBase64 = "A".repeat(200);
    const msg = buildMimeMessage({
      from: "a@b.com",
      to: "c@d.com",
      subject: "Long",
      date: "Mon, 01 Jan 2026 00:00:00 GMT",
      body: "body",
      attachments: [{ filename: "big.bin", contentType: "application/octet-stream", base64: longBase64 }],
    });
    const lines = msg.split("\r\n");
    const base64Lines = lines.filter(l => /^A+$/.test(l));
    expect(base64Lines.length).toBeGreaterThan(1);
    expect(base64Lines[0].length).toBe(76);
  });

  it("includes multiple attachments", () => {
    const msg = buildMimeMessage({
      from: "a@b.com",
      to: "c@d.com",
      subject: "Multi",
      date: "Mon, 01 Jan 2026 00:00:00 GMT",
      body: "body",
      attachments: [
        { filename: "a.txt", contentType: "text/plain", base64: "YQ==" },
        { filename: "b.txt", contentType: "text/plain", base64: "Yg==" },
      ],
    });
    expect(msg).toContain('filename="a.txt"');
    expect(msg).toContain('filename="b.txt"');
    // Should end with boundary terminator
    expect(msg).toMatch(/--.*--$/);
  });
});

// ---------------------------------------------------------------------------
// Header injection (CWE-93). Header values are interpolated into the raw
// message, so an embedded CRLF would let a caller append arbitrary headers.
// ---------------------------------------------------------------------------

describe("buildMimeMessage header injection", () => {
  const base = {
    from: "agent@agents.example",
    to: "user@example.com",
    subject: "Hello",
    body: "<p>hi</p>",
  };

  it("rejects CRLF in subject (forged Bcc)", () => {
    expect(() =>
      buildMimeMessage({ ...base, subject: "hi\r\nBcc: attacker@evil.example" }),
    ).toThrow(/subject must not contain line breaks/);
  });

  it("rejects a bare LF as well as CRLF", () => {
    expect(() => buildMimeMessage({ ...base, subject: "hi\nBcc: a@b.c" })).toThrow(
      /subject must not contain line breaks/,
    );
    expect(() => buildMimeMessage({ ...base, subject: "hi\rBcc: a@b.c" })).toThrow(
      /subject must not contain line breaks/,
    );
  });

  it("rejects CRLF in to, from, inReplyTo, references and messageId", () => {
    expect(() => buildMimeMessage({ ...base, to: "a@b.c\r\nBcc: x@y.z" })).toThrow(
      /to must not contain line breaks/,
    );
    expect(() => buildMimeMessage({ ...base, from: "a@b.c\r\nBcc: x@y.z" })).toThrow(
      /from must not contain line breaks/,
    );
    expect(() => buildMimeMessage({ ...base, inReplyTo: "<a>\r\nBcc: x@y.z" })).toThrow(
      /inReplyTo must not contain line breaks/,
    );
    expect(() => buildMimeMessage({ ...base, references: "<a>\r\nBcc: x@y.z" })).toThrow(
      /references must not contain line breaks/,
    );
    expect(() => buildMimeMessage({ ...base, messageId: "<a>\r\nBcc: x@y.z" })).toThrow(
      /messageId must not contain line breaks/,
    );
  });

  it("rejects CRLF in attachment filename and contentType", () => {
    const att = { filename: "ok.txt", contentType: "text/plain", base64: "aGk=" };
    expect(() =>
      buildMimeMessage({
        ...base,
        attachments: [{ ...att, filename: 'a"\r\nContent-Type: text/html\r\n\r\n<script>' }],
      }),
    ).toThrow(/attachment filename must not contain line breaks/);
    expect(() =>
      buildMimeMessage({
        ...base,
        attachments: [{ ...att, contentType: "text/plain\r\nX-Injected: 1" }],
      }),
    ).toThrow(/attachment contentType must not contain line breaks/);
  });

  it("escapes quotes in an attachment filename instead of breaking out of the param", () => {
    const mime = buildMimeMessage({
      ...base,
      attachments: [
        { filename: 'in"quote.txt', contentType: "text/plain", base64: "aGk=" },
      ],
    });
    expect(mime).toContain('filename="in\\"quote.txt"');
    // The raw unescaped form must not appear — it would terminate the quoted string.
    expect(mime).not.toContain('filename="in"quote.txt"');
  });

  it("escapes backslashes in an attachment filename", () => {
    const mime = buildMimeMessage({
      ...base,
      attachments: [
        { filename: "back\\slash.txt", contentType: "text/plain", base64: "aGk=" },
      ],
    });
    expect(mime).toContain('filename="back\\\\slash.txt"');
  });

  it("still builds a normal message with unicode and a long subject", () => {
    const subject = "Résumé — ភ្នាក់ងារ " + "x".repeat(200);
    const mime = buildMimeMessage({ ...base, subject });
    expect(mime).toContain(`Subject: ${subject}`);
    expect(mime).toContain("To: user@example.com");
  });
});
