import type {
  AgentStatusType,
  IssueStatusType,
  MeetingStatusType,
  MessageRoleType,
  RuntimeStatusType,
  TaskStatusType,
  TaskType,
} from "./constants";

export const Locale = {
  EN: "en",
  KM: "km",
} as const;

export type Locale = (typeof Locale)[keyof typeof Locale];

export const SUPPORTED_LOCALES = [Locale.KM, Locale.EN] as const satisfies readonly Locale[];
export const defaultLocale = Locale.KM;

export const AgentLanguageMode = {
  AUTO: "auto",
  BILINGUAL: "bilingual",
  EN: Locale.EN,
  KM: Locale.KM,
} as const;

export type AgentLanguageMode = (typeof AgentLanguageMode)[keyof typeof AgentLanguageMode];

export const SUPPORTED_AGENT_LANGUAGE_MODES = [
  AgentLanguageMode.KM,
  AgentLanguageMode.EN,
  AgentLanguageMode.BILINGUAL,
  AgentLanguageMode.AUTO,
] as const satisfies readonly AgentLanguageMode[];

export type ResolvedAgentLanguagePolicy = Readonly<{
  mode: AgentLanguageMode;
  defaultUserFacingLanguage: "km-KH" | "en" | "auto" | "bilingual";
  customPolicy: string | null;
}>;

export type AgentLanguagePolicyInput = Readonly<{
  taskLocaleOverride?: string | null;
  agentPreferredLocale?: string | null;
  workspaceAgentOutputLocale?: string | null;
  workspaceDefaultLocale?: string | null;
  userLocale?: string | null;
  agentLanguagePolicy?: string | null;
}>;

export type AgentPromptLanguagePolicy = Readonly<{
  default_user_facing_language: ResolvedAgentLanguagePolicy["defaultUserFacingLanguage"];
  apply_to: string;
  preserve_english_for: readonly string[];
  guidance: string;
  custom_policy?: string;
}>;

export type LocaleLabels = Readonly<Record<Locale, string>>;

export const localeDisplayLabels = {
  [Locale.EN]: {
    [Locale.EN]: "English",
    [Locale.KM]: "អង់គ្លេស",
  },
  [Locale.KM]: {
    [Locale.EN]: "Khmer",
    [Locale.KM]: "ខ្មែរ",
  },
} as const satisfies Record<Locale, LocaleLabels>;

export type CoreEntity =
  | "user"
  | "workspace"
  | "agent"
  | "teammate"
  | "runtime"
  | "memory"
  | "automation"
  | "approval"
  | "routine"
  | "template"
  | "owner"
  | "conversation"
  | "message"
  | "task"
  | "email"
  | "inbox"
  | "calendar"
  | "calendarEvent"
  | "issue"
  | "issueComment"
  | "channel"
  | "artifact"
  | "machine"
  | "machineToken"
  | "meeting"
  | "agentLink"
  | "workspaceFile";

export const coreEntityLabels = {
  user: {
    [Locale.EN]: "User",
    [Locale.KM]: "អ្នកប្រើ",
  },
  workspace: {
    [Locale.EN]: "Workspace",
    [Locale.KM]: "កន្លែងការងារ",
  },
  agent: {
    [Locale.EN]: "Agent",
    [Locale.KM]: "ភ្នាក់ងារ",
  },
  teammate: {
    [Locale.EN]: "Teammate",
    [Locale.KM]: "មិត្តរួមការងារ",
  },
  runtime: {
    [Locale.EN]: "Runtime",
    [Locale.KM]: "បរិស្ថានដំណើរការ",
  },
  memory: {
    [Locale.EN]: "Memory",
    [Locale.KM]: "សតិចងចាំ",
  },
  automation: {
    [Locale.EN]: "Automation",
    [Locale.KM]: "ស្វ័យប្រវត្តិកម្ម",
  },
  approval: {
    [Locale.EN]: "Approval",
    [Locale.KM]: "ការអនុម័ត",
  },
  routine: {
    [Locale.EN]: "Routine",
    [Locale.KM]: "ទម្លាប់ការងារ",
  },
  template: {
    [Locale.EN]: "Template",
    [Locale.KM]: "គំរូ",
  },
  owner: {
    [Locale.EN]: "Owner",
    [Locale.KM]: "ម្ចាស់",
  },
  conversation: {
    [Locale.EN]: "Conversation",
    [Locale.KM]: "ការសន្ទនា",
  },
  message: {
    [Locale.EN]: "Message",
    [Locale.KM]: "សារ",
  },
  task: {
    [Locale.EN]: "Task",
    [Locale.KM]: "ភារកិច្ច",
  },
  email: {
    [Locale.EN]: "Email",
    [Locale.KM]: "អ៊ីមែល",
  },
  inbox: {
    [Locale.EN]: "Inbox",
    [Locale.KM]: "ប្រអប់សារ",
  },
  calendar: {
    [Locale.EN]: "Calendar",
    [Locale.KM]: "ប្រតិទិន",
  },
  calendarEvent: {
    [Locale.EN]: "Calendar event",
    [Locale.KM]: "ព្រឹត្តិការណ៍ប្រតិទិន",
  },
  issue: {
    [Locale.EN]: "Issue",
    [Locale.KM]: "បញ្ហា",
  },
  issueComment: {
    [Locale.EN]: "Issue comment",
    [Locale.KM]: "មតិយោបល់លើបញ្ហា",
  },
  channel: {
    [Locale.EN]: "Channel",
    [Locale.KM]: "ឆានែល",
  },
  artifact: {
    [Locale.EN]: "Artifact",
    [Locale.KM]: "ឯកសារលទ្ធផល",
  },
  machine: {
    [Locale.EN]: "Machine",
    [Locale.KM]: "ម៉ាស៊ីន",
  },
  machineToken: {
    [Locale.EN]: "Machine token",
    [Locale.KM]: "ថូខឹនម៉ាស៊ីន",
  },
  meeting: {
    [Locale.EN]: "Meeting",
    [Locale.KM]: "កិច្ចប្រជុំ",
  },
  agentLink: {
    [Locale.EN]: "Agent link",
    [Locale.KM]: "តំណភ្នាក់ងារ",
  },
  workspaceFile: {
    [Locale.EN]: "Workspace file",
    [Locale.KM]: "ឯកសារកន្លែងការងារ",
  },
} as const satisfies Record<CoreEntity, LocaleLabels>;

export const agentStatusLabels = {
  active: {
    [Locale.EN]: "Active",
    [Locale.KM]: "សកម្ម",
  },
  inactive: {
    [Locale.EN]: "Inactive",
    [Locale.KM]: "មិនសកម្ម",
  },
  error: {
    [Locale.EN]: "Error",
    [Locale.KM]: "មានបញ្ហា",
  },
} as const satisfies Record<AgentStatusType, LocaleLabels>;

export const runtimeStatusLabels = {
  online: {
    [Locale.EN]: "Online",
    [Locale.KM]: "លើបណ្ដាញ",
  },
  offline: {
    [Locale.EN]: "Offline",
    [Locale.KM]: "ក្រៅបណ្ដាញ",
  },
  error: {
    [Locale.EN]: "Error",
    [Locale.KM]: "មានបញ្ហា",
  },
} as const satisfies Record<RuntimeStatusType, LocaleLabels>;

export const taskStatusLabels = {
  queued: {
    [Locale.EN]: "Queued",
    [Locale.KM]: "កំពុងរង់ចាំ",
  },
  dispatched: {
    [Locale.EN]: "Dispatched",
    [Locale.KM]: "បានបញ្ជូន",
  },
  running: {
    [Locale.EN]: "Running",
    [Locale.KM]: "កំពុងដំណើរការ",
  },
  completed: {
    [Locale.EN]: "Completed",
    [Locale.KM]: "បានបញ្ចប់",
  },
  failed: {
    [Locale.EN]: "Failed",
    [Locale.KM]: "បរាជ័យ",
  },
  cancelled: {
    [Locale.EN]: "Cancelled",
    [Locale.KM]: "បានបោះបង់",
  },
  superseded: {
    [Locale.EN]: "Superseded",
    [Locale.KM]: "ត្រូវបានជំនួស",
  },
} as const satisfies Record<TaskStatusType, LocaleLabels>;

export const taskTypeLabels = {
  user_dm_message: {
    [Locale.EN]: "Direct message",
    [Locale.KM]: "សារផ្ទាល់",
  },
  email_notification: {
    [Locale.EN]: "Email notification",
    [Locale.KM]: "ការជូនដំណឹងអ៊ីមែល",
  },
  calendar_event: {
    [Locale.EN]: "Calendar event",
    [Locale.KM]: "ព្រឹត្តិការណ៍ប្រតិទិន",
  },
  issue_event: {
    [Locale.EN]: "Issue event",
    [Locale.KM]: "ព្រឹត្តិការណ៍បញ្ហា",
  },
  automation_event: {
    [Locale.EN]: "Automation",
    [Locale.KM]: "ស្វ័យប្រវត្តិកម្ម",
  },
  playbook_step: {
    [Locale.EN]: "Playbook step",
    [Locale.KM]: "ជំហានសៀវភៅដំណើរការ",
  },
  kill_task: {
    [Locale.EN]: "Stop task",
    [Locale.KM]: "បញ្ឈប់ភារកិច្ច",
  },
} as const satisfies Record<TaskType, LocaleLabels>;

export const issueStatusLabels = {
  todo: {
    [Locale.EN]: "To do",
    [Locale.KM]: "ត្រូវធ្វើ",
  },
  in_progress: {
    [Locale.EN]: "In progress",
    [Locale.KM]: "កំពុងដំណើរការ",
  },
  review: {
    [Locale.EN]: "Review",
    [Locale.KM]: "រង់ចាំពិនិត្យ",
  },
  blocked: {
    [Locale.EN]: "Blocked",
    [Locale.KM]: "ជាប់គាំង",
  },
  done: {
    [Locale.EN]: "Done",
    [Locale.KM]: "រួចរាល់",
  },
  closed: {
    [Locale.EN]: "Closed",
    [Locale.KM]: "បានបិទ",
  },
  canceled: {
    [Locale.EN]: "Canceled",
    [Locale.KM]: "បានបោះបង់",
  },
  failed: {
    [Locale.EN]: "Failed",
    [Locale.KM]: "បរាជ័យ",
  },
} as const satisfies Record<IssueStatusType, LocaleLabels>;

export const messageRoleLabels = {
  user: {
    [Locale.EN]: "User",
    [Locale.KM]: "អ្នកប្រើ",
  },
  assistant: {
    [Locale.EN]: "Assistant",
    [Locale.KM]: "ជំនួយការ",
  },
  event: {
    [Locale.EN]: "Event",
    [Locale.KM]: "ព្រឹត្តិការណ៍",
  },
} as const satisfies Record<MessageRoleType, LocaleLabels>;

export const meetingStatusLabels = {
  pending: {
    [Locale.EN]: "Pending",
    [Locale.KM]: "កំពុងរង់ចាំ",
  },
  scheduled: {
    [Locale.EN]: "Scheduled",
    [Locale.KM]: "បានកំណត់ពេល",
  },
  joining: {
    [Locale.EN]: "Joining",
    [Locale.KM]: "កំពុងចូលរួម",
  },
  recording: {
    [Locale.EN]: "Recording",
    [Locale.KM]: "កំពុងថត",
  },
  completed: {
    [Locale.EN]: "Completed",
    [Locale.KM]: "បានបញ្ចប់",
  },
  failed: {
    [Locale.EN]: "Failed",
    [Locale.KM]: "បរាជ័យ",
  },
} as const satisfies Record<MeetingStatusType, LocaleLabels>;

export const statusLabels = {
  agent: agentStatusLabels,
  runtime: runtimeStatusLabels,
  task: taskStatusLabels,
  issue: issueStatusLabels,
  messageRole: messageRoleLabels,
  meeting: meetingStatusLabels,
} as const;

export const localeTechnicalTokenPolicy = {
  defaultContentLocale: defaultLocale,
  preserve: [
    "CLI command strings",
    "JSON keys",
    "database enum values",
    "API status values",
    "task type values",
    "routes",
    "file paths",
    "code identifiers",
    "logs",
  ],
} as const;

export function isSupportedLocale(locale: string | null | undefined): locale is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(locale ?? "");
}

export function resolveLocale(locale: string | null | undefined): Locale {
  if (isSupportedLocale(locale)) return locale;
  const baseLocale = locale?.toLowerCase().split("-")[0];
  return isSupportedLocale(baseLocale) ? baseLocale : defaultLocale;
}

export function getLocalizedLabel(labels: LocaleLabels, locale?: string | null): string {
  return labels[resolveLocale(locale)];
}

export function isSupportedAgentLanguageMode(
  mode: string | null | undefined,
): mode is AgentLanguageMode {
  return (SUPPORTED_AGENT_LANGUAGE_MODES as readonly string[]).includes(mode ?? "");
}

export function resolveAgentLanguageMode(mode: string | null | undefined): AgentLanguageMode {
  if (isSupportedAgentLanguageMode(mode)) return mode;
  const resolvedLocale = resolveLocale(mode);
  return resolvedLocale === Locale.EN ? AgentLanguageMode.EN : AgentLanguageMode.KM;
}

export function resolveAgentLanguagePolicy(
  input: AgentLanguagePolicyInput = {},
): ResolvedAgentLanguagePolicy {
  const mode = resolveAgentLanguageMode(
    input.taskLocaleOverride ??
      input.agentPreferredLocale ??
      input.workspaceAgentOutputLocale ??
      input.workspaceDefaultLocale ??
      input.userLocale ??
      defaultLocale,
  );

  const defaultUserFacingLanguage =
    mode === AgentLanguageMode.EN
      ? "en"
      : mode === AgentLanguageMode.AUTO
        ? "auto"
        : mode === AgentLanguageMode.BILINGUAL
          ? "bilingual"
          : "km-KH";

  const customPolicy = input.agentLanguagePolicy?.trim() || null;

  return { mode, defaultUserFacingLanguage, customPolicy };
}

export function buildAgentPromptLanguagePolicy(
  input: AgentLanguagePolicyInput = {},
): AgentPromptLanguagePolicy {
  const resolved = resolveAgentLanguagePolicy(input);
  const guidanceByMode: Record<AgentLanguageMode, string> = {
    [AgentLanguageMode.KM]:
      "Always write user-facing output in natural Khmer (km-KH), including greetings, DMs, emails, comments, and summaries — even when the user writes in English. Do not match the user's input language. Keep technical tokens in their original English form. When a technical English term is helpful, write the Khmer phrase first and include the English term in parentheses on first mention.",
    [AgentLanguageMode.EN]:
      "Use English by default for user-facing output. Keep Khmer terms, names, and exact quotes unchanged when they are part of the user's context.",
    [AgentLanguageMode.BILINGUAL]:
      "Use Khmer first with concise English support when it improves clarity. Keep code, commands, file paths, JSON keys, enum values, package names, logs, and exact quotes unchanged.",
    [AgentLanguageMode.AUTO]:
      "Choose the user-facing language from the sender, recipient, and task context. Keep code, commands, file paths, JSON keys, enum values, package names, logs, and exact quotes unchanged.",
  };

  const policy: AgentPromptLanguagePolicy = {
    default_user_facing_language: resolved.defaultUserFacingLanguage,
    apply_to:
      "User-facing messages, emails, DM replies, issue comments, summaries, and follow-ups.",
    preserve_english_for: [
      "CLI commands such as `phneakngar sync send-dm` and `phneakngar issue update`",
      "JSON keys such as `type`, `received_at`, `instruction`, `issue_id`, `email_id`, and `is_owner`",
      "Status values such as `in_progress`, `review`, `done`, `pending`, `failed`, and `canceled`",
      "Code, file paths, package names, API names, logs, environment variables, and exact quotes",
    ],
    guidance: guidanceByMode[resolved.mode],
  };

  return resolved.customPolicy
    ? { ...policy, custom_policy: resolved.customPolicy }
    : policy;
}
