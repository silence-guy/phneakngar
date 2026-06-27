import { describe, expect, it } from "vitest";
import {
  UNREAD_LABELS,
  inboxStatusLabel,
  inboxTypeBadgeLabel,
  inboxFilterTypeLabel,
} from "./unread-labels";

const isKhmer = (s: string) => /[ក-៿]/.test(s);

describe("unread labels", () => {
  it("exposes Khmer header and action strings", () => {
    expect(isKhmer(UNREAD_LABELS.title)).toBe(true);
    expect(isKhmer(UNREAD_LABELS.subtitle)).toBe(true);
    expect(isKhmer(UNREAD_LABELS.filter)).toBe(true);
    expect(isKhmer(UNREAD_LABELS.showInInbox)).toBe(true);
    expect(isKhmer(UNREAD_LABELS.markAllRead)).toBe(true);
    expect(isKhmer(UNREAD_LABELS.empty.noUnread)).toBe(true);
  });

  it("maps root-task status to Khmer", () => {
    expect(inboxStatusLabel("failed")).toBe(UNREAD_LABELS.status.failed);
    expect(inboxStatusLabel("completed")).toBe(UNREAD_LABELS.status.completed);
    expect(inboxStatusLabel(null)).toBe(UNREAD_LABELS.status.completed);
    expect(isKhmer(inboxStatusLabel("failed"))).toBe(true);
  });

  it("maps type badges and filter types to Khmer, preserving unknown keys", () => {
    expect(isKhmer(inboxTypeBadgeLabel("user_dm_message"))).toBe(true);
    expect(isKhmer(inboxTypeBadgeLabel("calendar_event"))).toBe(true);
    expect(isKhmer(inboxTypeBadgeLabel("email_notification"))).toBe(true);
    expect(inboxTypeBadgeLabel("other")).toBe("other");
    expect(isKhmer(inboxFilterTypeLabel("user_dm_message"))).toBe(true);
    expect(inboxFilterTypeLabel("other")).toBe("other");
  });
});
