// Co-located Khmer (KM) labels for the agent-detail pages.
// Default locale is Khmer; these modules hold KM-only display strings.
// Technical product tokens (Runtime, Model, IMAP, Google Meet, chhlat, etc.)
// are kept in parentheses or left as-is per the localization policy.

import { relativeTime, formatDuration } from "@/lib/datetime";

// Re-export for backward compatibility with pages that import these
export { relativeTime, formatDuration };

export const AGENT_PAGE_LABELS = {
  // Shared top navbar / layout (layout.tsx)
  layout: {
    tabChat: "ជជែក",
    tabEmail: "អ៊ីមែល",
    tabMeetings: "កិច្ចប្រជុំ",
    tabActivity: "សកម្មភាព",
    tabFiles: "ឯកសារ",
    tabTraces: "ដាន",
    settings: "ការកំណត់",
    noDescription: "គ្មានការពិពណ៌នា",
    cancel: "បោះបង់",
    edit: "កែ",
    remove: "ដកចេញ",
    removeAgentTitle: "ដកភ្នាក់ងារចេញ",
  },

  // Meetings page (meetings/page.tsx)
  meetings: {
    heading: "កិច្ចប្រជុំ",
    joinMeeting: "ចូលរួមកិច្ចប្រជុំ",
    emptyTitle: "មិនទាន់មានកិច្ចប្រជុំទេ",
    emptyHint: "ចូលរួម Google Meet ដើម្បីចាប់ផ្តើមថតប្រតិចារិក។",
    untitled: "កិច្ចប្រជុំគ្មានចំណងជើង",
    approve: "អនុម័ត",
    stop: "បញ្ឈប់",
    sheetTitle: "ចូលរួមកិច្ចប្រជុំ",
    urlLabel: "Google Meet URL *",
    titleLabel: "ចំណងជើង",
    titlePlaceholder: "ប្រជុំប្រចាំសប្តាហ៍",
    participantsLabel: "អ្នកចូលរួម (មួយអ៊ីមែលក្នុងមួយជួរ)",
    cancel: "បោះបង់",
    deleteTitle: "លុបកិច្ចប្រជុំ",
    deleteFallbackName: "កិច្ចប្រជុំនេះ",
    // toasts
    loadFailed: "មិនអាចផ្ទុកកិច្ចប្រជុំបានទេ",
    created: "បានបង្កើតកិច្ចប្រជុំ",
    createFailed: "មិនអាចបង្កើតកិច្ចប្រជុំបានទេ",
    stopped: "បានបញ្ឈប់កិច្ចប្រជុំ",
    stopFailed: "មិនអាចបញ្ឈប់កិច្ចប្រជុំបានទេ",
    approved: "បានអនុម័តកិច្ចប្រជុំ",
    approveFailed: "មិនអាចអនុម័តកិច្ចប្រជុំបានទេ",
    deleted: "បានលុបកិច្ចប្រជុំ",
    deleteFailed: "មិនអាចលុបកិច្ចប្រជុំបានទេ",
  },

  // Activity page (activity/page.tsx)
  activity: {
    all: "ទាំងអស់",
    statusAll: "ស្ថានភាព៖ ទាំងអស់",
    typeAll: "ប្រភេទ៖ ទាំងអស់",
    queued: "កំពុងរង់ចាំ",
    running: "កំពុងដំណើរការ",
    completed: "បានបញ្ចប់",
    failed: "បរាជ័យ",
    cancelled: "បានបោះបង់",
    typeMessage: "សារ",
    typeEmail: "អ៊ីមែល",
    typeCalendar: "ប្រតិទិន",
    emptyTitle: "មិនទាន់មានសកម្មភាពទេ",
    emptyHint: "សាកល្បងផ្លាស់ប្តូរតម្រងរបស់អ្នក",
    retryTask: "ព្យាយាមភារកិច្ចម្តងទៀត",
  },

  // Files page (files/page.tsx)
  files: {
    offlineTitle: "បរិស្ថានដំណើរការ (Runtime) របស់ភ្នាក់ងារក្រៅបណ្តាញ",
    offlineHint: "ការមើលឯកសារតម្រូវឱ្យ chhlat កំពុងដំណើរការ។",
    copyFullPath: "ចម្លងផ្លូវពេញ",
    emptyDirectory: "ថតទទេ",
    empty: "ទទេ",
    selectFile: "ជ្រើសឯកសារដើម្បីមើល",
    binaryFile: "ឯកសារ binary — មិនអាចបង្ហាញបានទេ",
    raw: "ដើម",
    preview: "មើលជាមុន",
    requestTimedOut: "សំណើផុតពេល — chhlat អាចនឹងក្រៅបណ្តាញ",
    requestFileFailed: "មិនអាចស្នើសុំឯកសារបានទេ",
  },

  // New agent page (agents/new/page.tsx)
  agentNew: {
    heading: "បង្កើតភ្នាក់ងារ",
    showTour: "បង្ហាញដំណើរណែនាំ",
    customEmailConnected: "បានភ្ជាប់អ៊ីមែលផ្ទាល់ខ្លួន",
    customEmailFailed: "មិនអាចភ្ជាប់អ៊ីមែលផ្ទាល់ខ្លួនបានទេ",
  },
} as const;

// Meeting status display labels (keys map to status enum VALUES — keep keys).
export const MEETING_STATUS_LABELS: Record<string, string> = {
  pending: "កំពុងរង់ចាំ",
  scheduled: "បានកំណត់ពេល",
  joining: "កំពុងចូលរួម...",
  recording: "កំពុងថត",
  completed: "បានបញ្ចប់",
  failed: "បរាជ័យ",
};

// Activity status display labels. dispatched collapses into "queued" and
// superseded collapses into "cancelled" exactly as the page intends — keys kept.
export const ACTIVITY_STATUS_LABELS: Record<string, string> = {
  queued: AGENT_PAGE_LABELS.activity.queued,
  dispatched: AGENT_PAGE_LABELS.activity.queued,
  running: AGENT_PAGE_LABELS.activity.running,
  completed: AGENT_PAGE_LABELS.activity.completed,
  failed: AGENT_PAGE_LABELS.activity.failed,
  cancelled: AGENT_PAGE_LABELS.activity.cancelled,
  superseded: AGENT_PAGE_LABELS.activity.cancelled,
};

export function meetingStatusLabel(status: string): string {
  return MEETING_STATUS_LABELS[status] ?? MEETING_STATUS_LABELS.pending!;
}

export function activityStatusLabel(status: string): string {
  return ACTIVITY_STATUS_LABELS[status] ?? status;
}

// Relative-time labels shared by the email and activity lists.
// Delegates to shared relativeTime for consistent formatting.
export function relativeTimeLabel(dateStr: string): string {
  return relativeTime(dateStr);
}

export function meetingParticipantsLabel(count: number): string {
  return `${count} អ្នកចូលរួម`;
}

export function meetingStartedAtLabel(time: string): string {
  return `បានចាប់ផ្តើម ${time}`;
}

export function meetingDeleteDescription(title: string): string {
  return `ដក "${title}" និងប្រតិចារិករបស់វាចេញ?`;
}

export function agentDeleteDescription(name: string): string {
  return `នេះនឹងលុប "${name}" និងការសន្ទនាទាំងអស់របស់វាជាអចិន្ត្រៃយ៍។`;
}
