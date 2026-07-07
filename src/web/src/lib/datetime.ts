/**
 * Shared datetime formatting utilities for the web app.
 */

const RELATIVE_TIME_LABELS = {
  justNow: "ទើបតែឥឡូវ",
  minutesAgo: "N នាទីមុន",
  hoursAgo: "N ម៉ោងមុន",
  daysAgo: "N ថ្ងៃមុន",
} as const;

/**
 * Formats a date string as relative time (e.g., "5 minutes ago").
 * Returns Khmer-formatted strings like "5 នាទីមុន", "2 ម៉ោងមុន", etc.
 */
export function relativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return RELATIVE_TIME_LABELS.justNow;
  if (diffMin < 60) return RELATIVE_TIME_LABELS.minutesAgo.replace("N", String(diffMin));
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return RELATIVE_TIME_LABELS.hoursAgo.replace("N", String(diffHrs));
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return RELATIVE_TIME_LABELS.daysAgo.replace("N", String(diffDays));
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Formats duration between two timestamps as a human-readable string.
 * Returns "1h 30m", "5m 30s", "45s", or null if either timestamp is missing.
 */
export function formatDuration(startedAt: string | null, completedAt: string | null): string | null {
  if (!startedAt || !completedAt) return null;
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  if (totalSeconds >= 3600) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    return `${h}h ${m}m`;
  }
  if (totalSeconds >= 60) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}m ${s}s`;
  }
  return `${totalSeconds}s`;
}
