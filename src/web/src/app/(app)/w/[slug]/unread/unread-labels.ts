// Khmer-only labels co-located with the unread (inbox) page.
// Filter type keys stay in English; only display strings are localized.

export const UNREAD_LABELS = {
  title: "មិនទាន់អាន",
  subtitle: "ការឆ្លើយតបដែលមិនទាន់អានពីភ្នាក់ងាររបស់អ្នក។",
  filter: "តម្រង",
  showInInbox: "បង្ហាញក្នុងប្រអប់សារ៖",
  markAllRead: "សម្គាល់ថាអានទាំងអស់",
  // Root-task status shown on each row (failed | completed fallback).
  status: {
    failed: "បរាជ័យ",
    completed: "បានបញ្ចប់",
  },
  // root_task_type badge labels. DM is a channel code shown to the user.
  typeBadge: {
    user_dm_message: "សារផ្ទាល់",
    calendar_event: "ប្រតិទិន",
    email_notification: "អ៊ីមែល",
  } as Record<string, string>,
  // Inbox filter checkbox labels, keyed by InboxFilterType.
  filterType: {
    user_dm_message: "សារផ្ទាល់",
    calendar_event: "ប្រតិទិន",
    email_notification: "អ៊ីមែល",
  } as Record<string, string>,
  empty: {
    noUnread: "គ្មានសារមិនទាន់អាន",
  },
} as const;

export function inboxStatusLabel(status: string | null): string {
  return status === "failed"
    ? UNREAD_LABELS.status.failed
    : UNREAD_LABELS.status.completed;
}

export function inboxTypeBadgeLabel(type: string): string {
  return UNREAD_LABELS.typeBadge[type] ?? type;
}

export function inboxFilterTypeLabel(type: string): string {
  return UNREAD_LABELS.filterType[type] ?? type;
}
