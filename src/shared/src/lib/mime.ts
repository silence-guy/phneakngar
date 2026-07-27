import { nanoid } from "nanoid";

export interface InboundAttachmentMeta {
  key: string;
  filename: string;
  size: number;
  contentType: string;
}

interface ParsedAttachment {
  disposition: string | null;
  filename: string | null;
  mimeType: string;
  content: string | ArrayBuffer | Uint8Array;
}

export function extractAttachmentMeta(attachments: ParsedAttachment[]): InboundAttachmentMeta[] {
  return attachments
    .filter(att => att.disposition === "attachment" || att.filename)
    .map((att, i) => ({
      key: `inline:${i}`,
      filename: att.filename || `attachment-${i}`,
      size: att.content instanceof ArrayBuffer ? att.content.byteLength : typeof att.content === "string" ? att.content.length : 0,
      contentType: att.mimeType || "application/octet-stream",
    }));
}

export function filterDownloadableAttachments<T extends { disposition: string | null; filename: string | null }>(attachments: T[]): T[] {
  return attachments.filter(att => att.disposition === "attachment" || att.filename);
}

export interface MimeAttachment {
  filename: string;
  contentType: string;
  base64: string;
}

export interface BuildMimeOptions {
  from: string;
  to: string;
  subject: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
  date?: string;
  body: string;
  bodyType?: "text/html" | "text/plain";
  attachments?: MimeAttachment[];
}

/**
 * Reject CR/LF in a value destined for an RFC822 header.
 *
 * Header values are interpolated into the raw message, so an embedded CRLF lets a caller
 * append arbitrary headers (a forged `Bcc:` being the obvious one). Throwing rather than
 * silently stripping keeps the bug visible: a caller passing a newline has a defect, and
 * quietly repairing it hides that from them.
 */
function assertHeaderSafe(value: string, field: string): string {
  if (/[\r\n]/.test(value)) {
    throw new Error(`${field} must not contain line breaks`);
  }
  return value;
}

/**
 * Escape a value used inside a quoted MIME parameter (filename="...").
 * Rejects CR/LF, then backslash-escapes quotes and backslashes so the value cannot
 * terminate the quoted string early and inject further parameters.
 */
function quoteMimeParam(value: string, field: string): string {
  return assertHeaderSafe(value, field).replace(/[\\"]/g, "\\$&");
}

export function buildMimeMessage(opts: BuildMimeOptions): string {
  const from = assertHeaderSafe(opts.from, "from");
  const to = assertHeaderSafe(opts.to, "to");
  const subject = assertHeaderSafe(opts.subject, "subject");

  const threadingHeaders: string[] = [];
  if (opts.messageId) threadingHeaders.push(`Message-ID: ${assertHeaderSafe(opts.messageId, "messageId")}`);
  if (opts.inReplyTo) threadingHeaders.push(`In-Reply-To: ${assertHeaderSafe(opts.inReplyTo, "inReplyTo")}`);
  if (opts.references) threadingHeaders.push(`References: ${assertHeaderSafe(opts.references, "references")}`);

  const date = opts.date ?? new Date().toUTCString();
  const bodyType = opts.bodyType ?? "text/html";
  const attachments = opts.attachments ?? [];

  if (attachments.length === 0) {
    return [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `Date: ${date}`,
      ...threadingHeaders,
      `MIME-Version: 1.0`,
      `Content-Type: ${bodyType}; charset=utf-8`,
      "",
      opts.body,
    ].join("\r\n");
  }

  const boundary = `----=_Part_${nanoid(16)}`;
  const parts = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Date: ${date}`,
    ...threadingHeaders,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    `Content-Type: ${bodyType}; charset=utf-8`,
    `Content-Transfer-Encoding: 7bit`,
    "",
    opts.body,
  ];

  for (const att of attachments) {
    const contentType = assertHeaderSafe(att.contentType, "attachment contentType");
    const filename = quoteMimeParam(att.filename, "attachment filename");
    parts.push(
      [
        `--${boundary}`,
        `Content-Type: ${contentType}; name="${filename}"`,
        `Content-Disposition: attachment; filename="${filename}"`,
        `Content-Transfer-Encoding: base64`,
        "",
        att.base64.match(/.{1,76}/g)?.join("\r\n") ?? att.base64,
      ].join("\r\n")
    );
  }
  parts.push(`--${boundary}--`);
  return parts.join("\r\n");
}
