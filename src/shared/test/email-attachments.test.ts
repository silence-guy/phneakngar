import { describe, expect, it } from "vitest";
import {
  buildEmailDraftAttachmentKey,
  getEmailDraftAttachmentPrefix,
  isEmailDraftAttachmentKeyForScope,
  sanitizeEmailAttachmentFilename,
} from "../src/email-attachments";

describe("email attachment keys", () => {
  it("builds keys scoped by workspace and user", () => {
    expect(buildEmailDraftAttachmentKey("ws1", "u1", "draft1", "doc.txt")).toBe(
      "emails/drafts/ws1/u1/draft1/doc.txt",
    );
  });

  it("sanitizes path-like filenames", () => {
    expect(sanitizeEmailAttachmentFilename("../../secret.txt")).toBe("secret.txt");
    expect(sanitizeEmailAttachmentFilename("folder\\report.pdf")).toBe("report.pdf");
    expect(sanitizeEmailAttachmentFilename("\0")).toBe("_");
    expect(sanitizeEmailAttachmentFilename("..")).toBe("attachment.bin");
  });

  it("validates user-scoped keys", () => {
    const key = "emails/drafts/ws1/u1/draft1/doc.txt";
    expect(isEmailDraftAttachmentKeyForScope(key, "ws1", "u1")).toBe(true);
    expect(isEmailDraftAttachmentKeyForScope(key, "ws1", "u2")).toBe(false);
    expect(isEmailDraftAttachmentKeyForScope("emails/inbound/raw", "ws1", "u1")).toBe(false);
  });

  it("allows workspace-only worker validation", () => {
    const key = `${getEmailDraftAttachmentPrefix("ws1")}u1/draft1/doc.txt`;
    expect(isEmailDraftAttachmentKeyForScope(key, "ws1")).toBe(true);
    expect(isEmailDraftAttachmentKeyForScope(key, "ws2")).toBe(false);
  });

  it("rejects suspicious keys", () => {
    expect(isEmailDraftAttachmentKeyForScope("emails/drafts/ws1/u1/../raw", "ws1", "u1")).toBe(false);
    expect(isEmailDraftAttachmentKeyForScope("", "ws1", "u1")).toBe(false);
  });
});
