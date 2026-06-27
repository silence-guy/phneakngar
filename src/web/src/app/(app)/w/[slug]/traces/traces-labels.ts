// Khmer-only labels co-located with the traces pages (list + detail).
// Keys/enum values stay in English; only display strings are localized.

export const TRACES_LABELS = {
  title: "ដានដំណើរការ",
  subtitle: "ដានដំណើរការនៃភ្នាក់ងាររបស់អ្នក។",
  refresh: "ផ្ទុកឡើងវិញ",
  filters: {
    statusAll: "ស្ថានភាព៖ ទាំងអស់",
    agentAll: "ភ្នាក់ងារ៖ ទាំងអស់",
    channelAll: "ឆានែល៖ ទាំងអស់",
  },
  // Status filter dropdown options (keyed by stable value).
  statusOption: {
    all: "ទាំងអស់",
    active: "សកម្ម",
    completed: "បានបញ្ចប់",
    failed: "បរាជ័យ",
  },
  // Trace-list row status (active | completed | failed).
  traceStatus: {
    active: "សកម្ម",
    completed: "បានបញ្ចប់",
    failed: "បរាជ័យ",
  },
  // Trace-detail per-task status. dispatched collapses to queued and
  // superseded collapses to cancelled, matching the original display map.
  taskStatus: {
    queued: "កំពុងរង់ចាំ",
    dispatched: "កំពុងរង់ចាំ",
    running: "កំពុងដំណើរការ",
    completed: "បានបញ្ចប់",
    failed: "បរាជ័យ",
    cancelled: "បានបោះបង់",
    superseded: "បានបោះបង់",
  } as Record<string, string>,
  outcome: {
    visible_output: "មានលទ្ធផលបង្ហាញ",
    completed_without_visible_output: "គ្មានលទ្ធផលបង្ហាញ",
    not_required: "មិនតម្រូវឱ្យមានលទ្ធផល",
  } as Record<string, string>,
  empty: {
    noTraces: "មិនទាន់មានដានទេ",
    onlyMultiAgent: "មានតែភារកិច្ចដែលពាក់ព័ន្ធនឹងភ្នាក់ងារច្រើនប៉ុណ្ណោះដែលបង្ហាញនៅទីនេះ។",
    tryChangingFilter: "សាកល្បងប្តូរតម្រងរបស់អ្នក",
  },
  detail: {
    notFound: "រកមិនឃើញដាន",
  },
  relativeTime: {
    justNow: "មុននេះបន្តិច",
  },
} as const;

export function traceStatusFilterLabel(value: string): string {
  if (value === "all") return TRACES_LABELS.filters.statusAll;
  return (
    TRACES_LABELS.statusOption[value as keyof typeof TRACES_LABELS.statusOption] ??
    value
  );
}

export function traceStatusLabel(status: string): string {
  return (
    TRACES_LABELS.traceStatus[status as keyof typeof TRACES_LABELS.traceStatus] ??
    status
  );
}

export function traceTaskStatusLabel(status: string): string {
  return TRACES_LABELS.taskStatus[status] ?? status;
}

export function traceOutcomeLabel(status: string): string {
  return TRACES_LABELS.outcome[status] ?? status;
}

export function silentTaskLabel(count: number): string {
  return `${count} ភារកិច្ចគ្មានលទ្ធផល`;
}

export function formatTraceRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return TRACES_LABELS.relativeTime.justNow;
  if (diffMin < 60) return `${diffMin} នាទីមុន`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs} ម៉ោងមុន`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays} ថ្ងៃមុន`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
