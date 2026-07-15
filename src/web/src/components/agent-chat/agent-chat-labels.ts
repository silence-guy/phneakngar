// Co-located Khmer (KM) label module for the agent-chat components. Flat
// `as const` object with namespaced sub-objects per component, plus helper
// functions for pluralized / interpolated strings. Mirrors the style of
// `email-labels.ts` and `issues/issue-labels.ts`.
//
// Khmer is the default (and only) UI locale here, so labels are plain strings
// (no per-locale maps). Technical tokens (clipboard, Runtime, agent runtime,
// 💤) are intentionally kept untranslated.

export const AGENT_CHAT_LABELS = {
  // agent-chat-view.tsx
  view: {
    failedToLoadConversation: "មិនអាចផ្ទុកការសន្ទនាបានទេ",
    quote: "ដកស្រង់",
    copiedToClipboard: "បានចម្លងទៅ clipboard",
    loadEarlierMessages: "ផ្ទុកសារមុនៗ",
    welcomeEmailTitle: "ភ្នាក់ងាររបស់អ្នកកំពុងផ្ញើអ៊ីមែលស្វាគមន៍ជូនអ្នក។",
    welcomeEmailSubcopy:
      "សូមរង់ចាំកិច្ចការអ៊ីមែលនៅជ្រុងខាងលើឆ្វេងឱ្យបញ្ចប់ រួចពិនិត្យប្រអប់សាររបស់អ្នក។ ឬផ្ញើសារខាងក្រោមដើម្បីចាប់ផ្តើមជជែក។",
    activeWorkingTitle: "ភ្នាក់ងារកំពុងដំណើរការកិច្ចការ…",
    activeWorkingSubcopy:
      "សារនឹងបង្ហាញនៅទីនេះនៅពេលភ្នាក់ងារឆ្លើយតប។ អ្នកនៅតែអាចផ្ញើសារខាងក្រោមបាន។",
    activeStuckTitle: "កិច្ចការហាក់ដូចជាជាប់គាំង",
    activeStuckSubcopy:
      "ភ្នាក់ងារមិនទាន់ចាប់ផ្តើមដំណើរការកិច្ចការនេះទេ។ ពិនិត្យថា runtime នៅលើម៉ាស៊ីនរបស់អ្នកកំពុងដំណើរការ (phneakngar doctor)។",
    openRuntimes: "បើក Runtime",
    nap: "សម្រាក",
    napWaitTask: "សូមរង់ចាំកិច្ចការឱ្យបញ្ចប់",
    napReset: "សម្រាក និងកំណត់សម័យបច្ចុប្បន្នឡើងវិញ",
    stop: "បញ្ឈប់",
    stopRunningTask: "បញ្ឈប់កិច្ចការដែលកំពុងដំណើរការ",
    stopNoTask: "គ្មានកិច្ចការកំពុងដំណើរការ",
    dropFilesHere: "ទម្លាក់ឯកសារនៅទីនេះ",
    global: "សកល",
    attachFiles: "ភ្ជាប់ឯកសារ",
    send: "ផ្ញើ",
    failedToStopTask: "មិនអាចបញ្ឈប់កិច្ចការបានទេ",
    failedToUpdateIssue: "មិនអាចធ្វើបច្ចុប្បន្នភាពបញ្ហាបានទេ",
    failedToUpdateStatus: "មិនអាចធ្វើបច្ចុប្បន្នភាពស្ថានភាពបានទេ",
  },
  // message-list.tsx
  messageList: {
    copied: "បានចម្លង",
    copy: "ចម្លង",
    copiedToClipboard: "បានចម្លងទៅ clipboard",
    failedToCopy: "មិនអាចចម្លងបានទេ",
    quote: "ដកស្រង់",
    replyInThread: "ឆ្លើយតបក្នុងខ្សែ",
    flag: "សម្គាល់",
    unflag: "ដកសម្គាល់",
    notDeliveredTapToRetry: "មិនបានបញ្ជូន · ប៉ះដើម្បីព្យាយាមម្តងទៀត",
  },
  // channel-bar.tsx
  channel: {
    failedToRename: "មិនអាចប្តូរឈ្មោះបានទេ",
    failedToDelete: "មិនអាចលុបបានទេ",
    failedToCreate: "មិនអាចបង្កើតបានទេ",
    addNew: "បន្ថែមឆានែលជជែកថ្មី",
    rename: "ប្តូរឈ្មោះ",
    delete: "លុប",
    cancel: "បោះបង់",
    rightClickForOptions: "ចុចស្តាំដើម្បីមើលជម្រើស",
    namePlaceholder: "ឈ្មោះ...",
  },
  // artifact-sheet.tsx
  artifact: {
    title: "ឯកសារ",
    empty: "មិនទាន់មានឯកសារដែលបានបង្ហោះនៅឡើយទេ។",
  },
  // runtime-error-block.tsx
  runtimeError: {
    retry: "ព្យាយាមម្តងទៀត",
    explanation:
      "កំហុសនេះមកពី agent runtime នៅលើម៉ាស៊ីនរបស់អ្នក មិនមែនមកពី ភ្នាក់ងារ ទេ។",
  },
  // slash-command-popup.tsx
  slash: {
    global: "សកល",
  },
} as const;

// "Say hi to {name}." — empty-conversation prompt.
export function sayHiLabel(name: string): string {
  return `សួស្តីទៅ ${name}។`;
}

// "{agentName} is well-rested and ready to go" — Nap tooltip when no session.
export function agentWellRestedLabel(agentName: string): string {
  return `${agentName} បានសម្រាកគ្រប់គ្រាន់ ហើយត្រៀមរួចរាល់`;
}

// "{n} replies" — thread reply count (Khmer has no plural inflection).
export function repliesLabel(count: number): string {
  return `${count} ការឆ្លើយតប`;
}

// "last reply {time}" — thread last-reply timestamp.
export function lastReplyLabel(time: string): string {
  return `ឆ្លើយតបចុងក្រោយ ${time}`;
}

// "View {name}'s conversation" — internal-email touch action.
export function viewConversationLabel(name: string): string {
  return `មើលការសន្ទនារបស់ ${name}`;
}

// "Error from {provider}" — runtime error block heading.
export function errorFromLabel(providerDisplayName: string): string {
  return `កំហុសពី ${providerDisplayName}`;
}

// "{agentName} took a nap" — nap separator text (caller appends the 💤 emoji).
export function napSeparatorLabel(agentName: string): string {
  return `${agentName} បានសម្រាក`;
}

// Delete-channel confirmation prompt.
export function deleteChannelConfirmLabel(name: string): string {
  return `លុប “${name}”? ការសន្ទនារបស់វានឹងត្រូវដកចេញ។`;
}
