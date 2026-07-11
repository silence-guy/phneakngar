export const RUNTIME_STATUS_LABELS: Record<string, string> = {
  online: "នៅបណ្តាញ",
  offline: "ក្រៅបណ្តាញ",
};

export const RUNTIMES_LABELS = {
  heading: "បរិស្ថានដំណើរការ (Runtime)",
  subtitle: "ម៉ាស៊ីនរបស់អ្នក និងបរិស្ថានដំណើរការភ្នាក់ងាររបស់វា។",
  newMachine: "ម៉ាស៊ីនថ្មី",
  noMachinesManaged: "គ្មានម៉ាស៊ីនបានភ្ជាប់ទេ។ ប្រើកម្មវិធី desktop ឬ CLI ដើម្បីភ្ជាប់ម៉ាស៊ីន។",
  connectToStart: "ភ្ជាប់ម៉ាស៊ីនដើម្បីចាប់ផ្តើមដំណើរការភ្នាក់ងារក្នុងម៉ាស៊ីន។",
  connectMachine: "ភ្ជាប់ម៉ាស៊ីន",
  neverSeen: "មិនធ្លាប់ឃើញ",
  updating: "កំពុងធ្វើបច្ចុប្បន្នភាព...",
  update: "ធ្វើបច្ចុប្បន្នភាព",
  updateChhlatTitle: "ធ្វើបច្ចុប្បន្នភាព chhlat",
  rescanning: "កំពុងស្កេនឡើងវិញ...",
  rescan: "ស្កេនឡើងវិញ",
  rescanRuntimesTitle: "ស្កេនបរិស្ថានដំណើរការឡើងវិញ",
  remove: "ដកចេញ",
  removeMachineTitle: "ដកម៉ាស៊ីនចេញ",
  triggering: "កំពុងចាប់ផ្តើម...",
  bringOnline: "នាំម៉ាស៊ីននេះមកនៅបណ្តាញ៖",
  startChhlat: "ចាប់ផ្តើម Chhlat",
  chhlatStarted: "បានចាប់ផ្តើម chhlat",
  startChhlatFailed: "មិនអាចចាប់ផ្តើម chhlat បានទេ",
  machineConnected: "ម៉ាស៊ីនបានភ្ជាប់",
  connectMachineSheetTitle: "ភ្ជាប់ម៉ាស៊ីន",
  connectMachineSheetDescription:
    "ម៉ាស៊ីនរបស់អ្នកដំណើរការភ្នាក់ងារ AI ក្នុងម៉ាស៊ីនដោយប្រើ Claude Code, Codex ឬ OpenCode។",
  updateTriggered: "បានចាប់ផ្តើមធ្វើបច្ចុប្បន្នភាព",
  updateTriggerFailed: "មិនអាចចាប់ផ្តើមធ្វើបច្ចុប្បន្នភាពបានទេ",
  rescanTriggered: "បានចាប់ផ្តើមស្កេនឡើងវិញ — chhlat នឹងចាប់ផ្តើមឡើងវិញដើម្បីរកបរិស្ថានដំណើរការ",
  rescanTriggerFailed: "មិនអាចចាប់ផ្តើមស្កេនឡើងវិញបានទេ",
} as const;

export function runtimeStatusLabel(status: string): string {
  return RUNTIME_STATUS_LABELS[status] ?? status;
}

export function updateChhlatDescription(displayName: string): string {
  return `ការនេះនឹងធ្វើបច្ចុប្បន្នភាព chhlat នៅលើ "${displayName}" ទៅកំណែ CLI ចុងក្រោយ។ chhlat នឹងចាប់ផ្តើមឡើងវិញកំឡុងពេលធ្វើបច្ចុប្បន្នភាព។`;
}

export function rescanRuntimesDescription(displayName: string): string {
  return `ការនេះនឹងចាប់ផ្តើម chhlat នៅលើ "${displayName}" ឡើងវិញ ដើម្បីរកបរិស្ថានដំណើរការដែលមាន (Claude Code, Codex, OpenCode)។`;
}

export function removeMachineDescription(displayName: string): string {
  return `ការនេះនឹងដក "${displayName}" និងបរិស្ថានដំណើរការទាំងអស់របស់វាចេញ។ ភ្នាក់ងារដែលប្រើបរិស្ថានដំណើរការទាំងនេះនឹងត្រូវផ្តាច់ការតភ្ជាប់។`;
}
