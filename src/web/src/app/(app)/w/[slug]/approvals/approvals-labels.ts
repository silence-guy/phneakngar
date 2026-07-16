// Khmer-only labels co-located with the approvals page.

export const APPROVALS_LABELS = {
  title: "ការអនុម័ត",
  subtitle: "សកម្មភាពដែលត្រូវការអនុម័តពីអ្នក មុនពេលភ្នាក់ងារបន្ត។",
  approve: "អនុម័ត",
  reject: "បដិសេធ",
  openAgentEmail: "មើលអ៊ីមែលភ្នាក់ងារ",
  empty: {
    noPending: "គ្មានការអនុម័តរង់ចាំ",
  },
  kind: {
    outbound_email: "អ៊ីមែលចេញ",
    tool_action: "សកម្មភាពឧបករណ៍",
    skill_install: "ដំឡើងជំនាញ",
    automation_promote: "លើកឋានៈស្វ័យប្រវត្តិ",
  },
} as const;

export function approvalKindLabel(kind: string): string {
  return (APPROVALS_LABELS.kind as Record<string, string>)[kind] ?? kind;
}

/** Pure helpers for outbound_email approval row display. */
export function outboundApprovalMeta(payload: unknown): {
  emailId: string | null;
  to: string | null;
} {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { emailId: null, to: null };
  }
  const p = payload as Record<string, unknown>;
  const emailId = typeof p.emailId === "string" && p.emailId.trim() ? p.emailId.trim() : null;
  // summary often carries "To …"; payload may not store to separately
  return { emailId, to: null };
}

export function parseOutboundToFromSummary(summary: string | null | undefined): string | null {
  if (!summary) return null;
  const m = summary.match(/^To\s+(.+)$/i) ?? summary.match(/^ទៅ\s+(.+)$/);
  return m?.[1]?.trim() || null;
}
