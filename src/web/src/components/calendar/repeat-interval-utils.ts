import { CALENDAR_LABELS } from "./calendar-labels";

export type RepeatUnit = "min" | "hour" | "day" | "week" | "month";

export interface ParsedInterval {
  count: number;
  unit: RepeatUnit;
}

const INTERVAL_RE = /^(\d+)(min|hour|day|week|month)$/;

export function parseRepeatInterval(raw: string): ParsedInterval | null {
  const m = INTERVAL_RE.exec(raw);
  if (!m) return null;
  const count = parseInt(m[1]!, 10);
  if (count < 1) return null;
  return { count, unit: m[2]! as RepeatUnit };
}

export function formatRepeatInterval(count: number, unit: RepeatUnit): string {
  return `${count}${unit}`;
}

const UNIT_LABELS: Record<RepeatUnit, [string, string]> = {
  min: ["នាទី", "នាទី"],
  hour: ["ម៉ោង", "ម៉ោង"],
  day: ["ថ្ងៃ", "ថ្ងៃ"],
  week: ["សប្តាហ៍", "សប្តាហ៍"],
  month: ["ខែ", "ខែ"],
};

export function unitLabel(unit: RepeatUnit, count: number): string {
  return count === 1 ? UNIT_LABELS[unit][0] : UNIT_LABELS[unit][1];
}

export function formatRepeatDisplay(raw: string): string {
  const parsed = parseRepeatInterval(raw);
  if (!parsed) return raw;
  const { count, unit } = parsed;
  if (count === 1) return `${CALENDAR_LABELS.repeat.every}${UNIT_LABELS[unit][0]}`;
  return `${CALENDAR_LABELS.repeat.every} ${count} ${UNIT_LABELS[unit][1]}`;
}

const VALID_UNITS: Set<string> = new Set([
  "min",
  "hour",
  "day",
  "week",
  "month",
]);

export function isValidUnit(s: string): s is RepeatUnit {
  return VALID_UNITS.has(s);
}

export const REPEAT_UNITS: RepeatUnit[] = [
  "min",
  "hour",
  "day",
  "week",
  "month",
];

export const PRESET_INTERVALS = [
  { value: "1hour", label: formatRepeatDisplay("1hour") },
  { value: "1day", label: formatRepeatDisplay("1day") },
  { value: "1week", label: formatRepeatDisplay("1week") },
  { value: "1month", label: formatRepeatDisplay("1month") },
] as const;
