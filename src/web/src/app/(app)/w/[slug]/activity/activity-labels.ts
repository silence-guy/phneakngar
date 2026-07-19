// Khmer-only labels co-located with the workspace activity feed.

export const ACTIVITY_LABELS = {
  title: "សកម្មភាព",
  subtitle: "ជីវចលនៃក្រុមហ៊ុន — ការអនុម័ត ការផ្ញើចេញ និងស្វ័យប្រវត្តិ។",
  empty: {
    none: "មិនទាន់មានសកម្មភាពទេ។ ការអនុម័ត ការផ្ញើ gateway និង automation នឹងបង្ហាញនៅទីនេះ។",
  },
  kind: {
    approval_decided: "ការអនុម័ត",
    approval_decide: "ការអនុម័ត",
    gateway_egress: "Gateway egress",
    gateway_egress_ok: "Gateway egress",
    gateway_egress_fail: "Gateway egress",
    gateway_probe: "Gateway probe",
    gateway_probe_ok: "Gateway probe",
    gateway_probe_fail: "Gateway probe",
    probe: "Gateway probe",
    automation_due: "Automation",
  },
  unknownKind: "ព្រឹត្តិការណ៍",
} as const;

export function activityKindLabel(kind: string): string {
  const map = ACTIVITY_LABELS.kind as Record<string, string>;
  if (map[kind]) return map[kind];
  // Soft normalize: approval.decided → approval_decided
  const soft = kind.replace(/\./g, "_");
  if (map[soft]) return map[soft];
  return ACTIVITY_LABELS.unknownKind;
}

/** Icon key for known kinds (UI maps to lucide). */
export type ActivityIconKey =
  | "shield"
  | "send"
  | "radar"
  | "repeat"
  | "dot";

export function activityIconKey(kind: string): ActivityIconKey {
  const k = kind.replace(/\./g, "_").toLowerCase();
  if (k.includes("approval")) return "shield";
  if (k.includes("egress") || k.includes("send")) return "send";
  if (k.includes("probe")) return "radar";
  if (k.includes("automation")) return "repeat";
  return "dot";
}
