// Co-located Khmer (KM) labels for top-level misc components.
// Khmer is the default locale, so these are flat constants used directly.

export const COMPONENT_LABELS = {
  inbox: {
    unread: "មិនទាន់អាន",
    noUnread: "គ្មានសារមិនទាន់អាន",
  },
  flag: {
    flagged: "បានដាក់សញ្ញា",
    noFlagged: "គ្មានសារដែលដាក់សញ្ញា",
  },
  status: {
    offline: "ក្រៅបណ្តាញ",
    offlineTooltip: "Runtime ក្រៅបណ្តាញ — ចុចដើម្បីគ្រប់គ្រង Runtime",
    working: "កំពុងធ្វើការ",
    online: "នៅបណ្តាញ",
    failedToLoad: "មិនអាចផ្ទុកបានទេ",
    noActiveTasks: "គ្មានភារកិច្ចសកម្ម",
  },
  preview: {
    emailCopied: "បានចម្លងអ៊ីមែលទៅ clipboard",
    failedToCopyEmail: "មិនអាចចម្លងអ៊ីមែលបានទេ",
    offline: "ក្រៅបណ្តាញ",
    working: "កំពុងធ្វើការ",
  },
  runtime: {
    updateRequiredTitle: "ត្រូវការធ្វើបច្ចុប្បន្នភាព Runtime",
    appOutdatedPrefix: "កម្មវិធី ភ្នាក់ងារ ក្នុងម៉ាស៊ីនរបស់អ្នកកំពុងដំណើរការកំណែចាស់ (កំណែអប្បបរមាដែលត្រូវការ៖ v",
    appOutdatedSuffix: ")។ សូមធ្វើបច្ចុប្បន្នភាពដើម្បីបន្ត។",
    machineOutdatedPrefix: "ម៉ាស៊ីនខាងក្រោមកំពុងដំណើរការ CLI កំណែចាស់ (កំណែអប្បបរមាដែលត្រូវការ៖ v",
    machineOutdatedSuffix: ")។ សូមធ្វើបច្ចុប្បន្នភាពដើម្បីបន្ត។",
    unknownVersion: "មិនស្គាល់",
    updating: "កំពុងធ្វើបច្ចុប្បន្នភាព...",
    update: "ធ្វើបច្ចុប្បន្នភាព",
    updateTakingTooLong: "ការធ្វើបច្ចុប្បន្នភាពយឺតពេលឬ?",
    runCommandHint: "ដំណើរការពាក្យបញ្ជានេះនៅលើម៉ាស៊ីនដើម្បីធ្វើបច្ចុប្បន្នភាពដោយដៃ៖",
    clickToCopy: "ចុចដើម្បីចម្លង",
    cliUpdated: "បានធ្វើបច្ចុប្បន្នភាព CLI",
    failedToUpdateCli: "មិនអាចធ្វើបច្ចុប្បន្នភាព CLI បានទេ",
    copiedToClipboard: "បានចម្លងទៅ clipboard",
  },
  mockNetwork: {
    prefix: "បណ្តាញសាកល្បង — ",
    suffix: "ms ការពន្យារ",
  },
} as const;

export function viewAllTasksLabel(count: number): string {
  return `មើលភារកិច្ចទាំង ${count}`;
}

export function eventCountSuffixLabel(count: number): string {
  // "{n} event(s)" — Khmer has no plural inflection
  return `${count} ព្រឹត្តិការណ៍`;
}

export function requiresVersionLabel(version: string): string {
  return `ត្រូវការ v${version}`;
}

export function appOutdatedDescription(version: string): string {
  return `${COMPONENT_LABELS.runtime.appOutdatedPrefix}${version}${COMPONENT_LABELS.runtime.appOutdatedSuffix}`;
}

export function machineOutdatedDescription(version: string): string {
  return `${COMPONENT_LABELS.runtime.machineOutdatedPrefix}${version}${COMPONENT_LABELS.runtime.machineOutdatedSuffix}`;
}

export function mockNetworkLabel(delayMs: string | number): string {
  return `${COMPONENT_LABELS.mockNetwork.prefix}${delayMs}${COMPONENT_LABELS.mockNetwork.suffix}`;
}
