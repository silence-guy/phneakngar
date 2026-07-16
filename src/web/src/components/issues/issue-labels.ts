export const ISSUE_STATUS_LABELS: Record<string, string> = {
  todo: "ត្រូវធ្វើ",
  in_progress: "កំពុងដំណើរការ",
  blocked: "ត្រូវបានទប់",
  review: "រង់ចាំពិនិត្យ",
  done: "រួចរាល់",
  closed: "បានបិទ",
  canceled: "បានបោះបង់",
  failed: "បរាជ័យ",
};

export const ISSUE_EVENT_LABELS: Record<string, string> = {
  created: "បានបង្កើតបញ្ហា",
  status_changed: "បានធ្វើបច្ចុប្បន្នភាពបញ្ហា",
  dispatch_failed: "បញ្ជូនដំណើរការបរាជ័យ",
};

export const ISSUE_LABELS = {
  agent: "ភ្នាក់ងារ",
  you: "អ្នក",
  unknown: "មិនស្គាល់",
  unassigned: "មិនទាន់ចាត់តាំង",
  noneUnassigned: "គ្មាន (មិនទាន់ចាត់តាំង)",
  noActivity: "មិនទាន់មានសកម្មភាពទេ។",
  working: "កំពុងធ្វើការ",
  queued: "កំពុងរង់ចាំ",
  commentPlaceholder: "ទុកមតិយោបល់...",
  sendCommentFailed: "ផ្ញើមតិយោបល់មិនបាន",
  newIssue: "បញ្ហាថ្មី",
  untitled: "គ្មានចំណងជើង",
  describeIssue: "ពិពណ៌នាបញ្ហា...",
  chat: "ជជែក",
  thread: "ខ្សែការងារ",
  close: "បិទ",
  activity: "សកម្មភាព",
  issue: "បញ្ហា",
  newIssueTitle: "បញ្ហាថ្មី",
  issueTitle: "បញ្ហា",
  cancel: "បោះបង់",
  create: "បង្កើត",
  runIssueTitle: "ដំណើរការបញ្ហានេះ?",
  run: "ដំណើរការ",
  running: "កំពុងដំណើរការ...",
  dispatchFailed: "បញ្ជូនបញ្ហាមិនបាន",
  activeTasks: "កិច្ចការកំពុងសកម្ម",
  collapseTasksPanel: "បង្រួមផ្ទាំងកិច្ចការ",
  active: "កំពុងសកម្ម",
  connectionLostRetrying: "ការតភ្ជាប់បានដាច់ - កំពុងព្យាយាមម្តងទៀត...",
  delete: "លុប",
  issuesHeading: "បញ្ហា",
  noIssues: "គ្មានបញ្ហា",
  noIssuesYet: "មិនទាន់មានបញ្ហានៅឡើយទេ",
  createToGetStarted: "បង្កើតមួយដើម្បីចាប់ផ្តើម។",
  empty: "ទទេ",
  reviewBadge: "ពិនិត្យ",
  blockedBadge: "ទប់",
  failedBadge: "បរាជ័យ",
  claim: "ទទួលយក",
  handBack: "ប្រគល់វិញ",
  claiming: "កំពុងទទួលយក...",
  handingBack: "កំពុងប្រគល់វិញ...",
  claimed: "បានទទួល",
  selectAgentToClaim: "ជ្រើសរើសភ្នាក់ងារដើម្បីទទួលយក",
  claimFailed: "មិនអាចទទួលយកបញ្ហាបានទេ",
  handBackFailed: "មិនអាចប្រគល់បញ្ហាវិញបានទេ",
  hideCompleted: "លាក់ការងាររួចរាល់",
  showCompleted: "បង្ហាញការងាររួចរាល់",
  hideCompletedColumn: "លាក់ជួរឈររួចរាល់",
  showCompletedColumn: "បង្ហាញជួរឈររួចរាល់",
  showCompletedIssues: "បង្ហាញបញ្ហារួចរាល់",
  dropToComplete: "ទម្លាក់ដើម្បីបញ្ចប់",
  assignAgentFirst: "ចាត់តាំងភ្នាក់ងារជាមុនសិន ដើម្បីដំណើរការបញ្ហានេះ",
  issueCreated: "បានបង្កើតបញ្ហា",
  issueDeleted: "បានលុបបញ្ហា",
  loadIssuesFailed: "មិនអាចផ្ទុកបញ្ហាបានទេ",
  loadIssueFailed: "មិនអាចផ្ទុកបញ្ហានេះបានទេ",
  createIssueFailed: "មិនអាចបង្កើតបញ្ហាបានទេ",
  updateIssueFailed: "មិនអាចធ្វើបច្ចុប្បន្នភាពបញ្ហាបានទេ",
  updateStatusFailed: "មិនអាចធ្វើបច្ចុប្បន្នភាពស្ថានភាពបញ្ហាបានទេ",
  deleteIssueFailed: "មិនអាចលុបបញ្ហាបានទេ",
} as const;

export const ISSUE_COLUMN_LABELS: Record<string, string> = {
  todo: "ត្រូវធ្វើ",
  in_progress: "កំពុងដំណើរការ",
  blocked: "ត្រូវបានទប់",
  review: "ពិនិត្យ",
  completed: "រួចរាល់",
};

export function issueClaimedByLabel(agentName: string): string {
  return `${ISSUE_LABELS.claimed} · ${agentName}`;
}

function fallbackLabel(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function issueStatusLabel(status: string): string {
  return ISSUE_STATUS_LABELS[status] ?? fallbackLabel(status);
}

export function issueEventLabel(event: string): string {
  return ISSUE_EVENT_LABELS[event] ?? event;
}

export function issueStampLabel(event: string, toStatus?: string): string | null {
  if (event === "created") return "ថ្មី";
  if (event === "status_changed") return issueStatusLabel(toStatus ?? "done");
  return null;
}

export function issueAssignedMeta(assigneeName: string): string {
  return `បានចាត់តាំងទៅ ${assigneeName}`;
}

export function issueStatusTransitionMeta(fromStatus: string, toStatus: string): string {
  return `${issueStatusLabel(fromStatus)} → ${issueStatusLabel(toStatus)}`;
}

export function issueDispatchDescription(agentName: string | undefined): string {
  return `បញ្ហានេះនឹងត្រូវបានចាត់តាំងទៅ ${agentName ?? "ភ្នាក់ងារ"} ហើយចាប់ផ្តើមដំណើរការភ្លាមៗ។`;
}

export function activeTaskCountLabel(count: number): string {
  return `${count} ${ISSUE_LABELS.active}`;
}

export function activeTaskPanelTitle(count: number): string {
  return `កិច្ចការ ${count} ${ISSUE_LABELS.active}`;
}

export function viewAllTasksLabel(count: number): string {
  return `មើលកិច្ចការ ${count} ទាំងអស់`;
}

export function issueColumnLabel(columnId: string): string {
  return ISSUE_COLUMN_LABELS[columnId] ?? fallbackLabel(columnId);
}

export function showCompletedCountLabel(count: number): string {
  return `${ISSUE_LABELS.showCompleted} (${count})`;
}
