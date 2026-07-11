/**
 * Mock implementations for @phneakngar/shared for bun test compatibility.
 * Replace vi.importActual with direct mock values.
 */

// Constants
export const DEV_PASSWORD = "dev-pw";
export const DEV_WEB_URL = "http://localhost:3000";
export const DEV_WS_DO_URL = "http://localhost:8789";
export const DEV_EMAIL_WORKER_URL = "http://localhost:8787";
export const EMAIL_NOTIFY_SECRET_HEADER = "x-email-notify-secret";
export const POLL_INTERVAL_MS = 1000;
export const OFFLINE_THRESHOLD_MS = 30000;
export const EVENT_POLL_INTERVAL_MS = 1000;
export const AGENT_HANDLE_MIN_LENGTH = 4;
export const MAX_TASKS_PER_TRACE = 1000;

// Enums
export const AgentStatus = {
  ONLINE: "online",
  OFFLINE: "offline",
} as const;

export const RuntimeStatus = {
  READY: "ready",
  BUSY: "busy",
  INITIALIZING: "initializing",
  ERROR: "error",
} as const;

export const TaskStatus = {
  QUEUED: "queued",
  DISPATCHED: "dispatched",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
  SUPERSEDED: "superseded",
} as const;

export const TERMINAL_TASK_STATUSES = new Set(["completed", "failed", "cancelled", "superseded"]);

export const isTerminalTaskStatus = (status: string): boolean => TERMINAL_TASK_STATUSES.has(status);

export const TASK_TYPES = {
  USER_DM_MESSAGE: "user_dm_message",
  EMAIL_NOTIFICATION: "email_notification",
  CALENDAR_EVENT: "calendar_event",
  INTERNAL_TASK: "internal_task",
} as const;

export const IssueStatus = {
  TODO: "todo",
  IN_PROGRESS: "in_progress",
  DONE: "done",
} as const;

export const ACTIVE_ISSUE_STATUSES = new Set(["todo", "in_progress"]);
export const TERMINAL_ISSUE_STATUSES = new Set(["done"]);

export const isTerminalIssueStatus = (status: string): boolean => TERMINAL_ISSUE_STATUSES.has(status);

export const MessageRole = {
  USER: "user",
  ASSISTANT: "assistant",
  SYSTEM: "system",
} as const;

export const MeetingStatus = {
  PENDING: "pending",
  SCHEDULED: "scheduled",
  JOINING: "joining",
  RECORDING: "recording",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export const TERMINAL_MEETING_STATUSES = new Set(["completed", "failed"]);

// Locale
export const Locale = {
  EN: "en",
  KM: "km",
} as const;

export const SUPPORTED_LOCALES = ["en", "km"] as const;
export const AgentLanguageMode = {
  KHMER: "khmer",
  ENGLISH: "english",
} as const;
export const SUPPORTED_AGENT_LANGUAGE_MODES = ["khmer", "english"] as const;
export const defaultLocale = "km";

export const localeDisplayLabels: Record<string, string> = {
  en: "English",
  km: "ខ្មែរ",
};

export const coreEntityLabels = {
  agent: "Agent",
  conversation: "Conversation",
  message: "Message",
} as const;

export const agentStatusLabels = {
  online: "Online",
  offline: "Offline",
} as const;

export const runtimeStatusLabels = {
  ready: "Ready",
  busy: "Busy",
  initializing: "Initializing",
  error: "Error",
} as const;

export const taskStatusLabels = {
  queued: "Queued",
  dispatched: "Dispatched",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
  superseded: "Superseded",
} as const;

export const taskTypeLabels = {
  user_dm_message: "Message",
  email_notification: "Email",
  calendar_event: "Calendar",
  internal_task: "Internal",
} as const;

export const issueStatusLabels = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
} as const;

export const messageRoleLabels = {
  user: "User",
  assistant: "Assistant",
  system: "System",
} as const;

export const meetingStatusLabels = {
  pending: "Pending",
  scheduled: "Scheduled",
  joining: "Joining",
  recording: "Recording",
  completed: "Completed",
  failed: "Failed",
} as const;

export const statusLabels = {
  ...agentStatusLabels,
  ...runtimeStatusLabels,
  ...taskStatusLabels,
  ...issueStatusLabels,
  ...meetingStatusLabels,
} as const;

export const localeTechnicalTokenPolicy = "preserve" as const;

export const isSupportedLocale = (locale: string): boolean => SUPPORTED_LOCALES.includes(locale as typeof SUPPORTED_LOCALES[number]);
export const isSupportedAgentLanguageMode = (mode: string): boolean => SUPPORTED_AGENT_LANGUAGE_MODES.includes(mode as typeof SUPPORTED_AGENT_LANGUAGE_MODES[number]);

export const resolveLocale = (locale: string | null | undefined): string => locale && isSupportedLocale(locale) ? locale : defaultLocale;
export const resolveAgentLanguageMode = (mode: string | null | undefined): string => mode && isSupportedAgentLanguageMode(mode) ? mode : AgentLanguageMode.KHMER;
export const resolveAgentLanguagePolicy = (mode: string | null | undefined): string => mode || AgentLanguageMode.KHMER;
export const buildAgentPromptLanguagePolicy = (mode: string): string => mode;
export const getLocalizedLabel = (key: string, locale: string): string => localeDisplayLabels[locale] || key;

// Email utils
export const parseEmailHandle = (handle: string): string => handle.toLowerCase().trim();
export const toPhneakngarAddress = (email: string): string => {
  const local = email.split("@")[0];
  return `${local}@phneak.ngar`;
};
export const isValidHandle = (handle: string): boolean => /^[a-zA-Z0-9-]{4,}$/.test(handle);
export const isValidEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
export const isPhneakngarEmail = (email: string): boolean => email.endsWith("@phneak.ngar");

// Validation
export const isValidToken = (token: string | null | undefined): boolean => typeof token === "string" && token.length > 0;

// Status utils
export const isOnline = (lastSeenAt: string | null | undefined): boolean => {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < OFFLINE_THRESHOLD_MS;
};
export const formatStatus = (online: boolean): string => online ? "Online" : "Offline";

// DB utils
export const isUniqueConstraintError = (error: unknown): boolean => {
  if (error instanceof Error && (error.message.includes("UNIQUE") || error.message.includes("unique"))) return true;
  return false;
};

// Slug
export const generateWorkspaceSlug = (name: string): string => {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
};

// Title utils
export const truncateTitle = (title: string, maxLength: number): string => {
  if (title.length <= maxLength) return title;
  return title.slice(0, maxLength - 3) + "...";
};

export const truncateGraphemes = (str: string, maxGraphemes: number): string => {
  const graphemes = [...str];
  if (graphemes.length <= maxGraphemes) return str;
  return graphemes.slice(0, maxGraphemes - 1).join("") + "…";
};

export const sliceGraphemes = (str: string, start: number, end: number): string => {
  return [...str].slice(start, end).join("");
};

export const toGraphemes = (str: string): string[] => [...str];

// Mode
export const resolveMode = (): string => "cli";
export const cliCommand = "phneakngar";
export const cliPackageName = "@phneakngar/cli";
export const updateCommand = "phneakngar update";
export const daemonCommand = "phneakngar daemon";
export const getBaseUrl = (): string => "http://localhost:3000";
export const isTauri = (): boolean => false;
export const isDesktop = (): boolean => false;
export const isMobile = (): boolean => false;
export const tauriInvoke = async (): Promise<unknown> => { throw new Error("Not implemented"); };

// Semver
export const semverGte = (v1: string, v2: string): boolean => {
  const parts1 = v1.split(".").map(Number);
  const parts2 = v2.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (parts1[i]! > parts2[i]!) return true;
    if (parts1[i]! < parts2[i]!) return false;
  }
  return true;
};

// Email attachments
export const buildEmailDraftAttachmentKey = (id: string): string => `drafts/${id}`;
export const getEmailDraftAttachmentPrefix = (): string => "drafts/";
export const isEmailDraftAttachmentKeyForScope = (key: string): boolean => key.startsWith("drafts/");
export const sanitizeEmailAttachmentFilename = (filename: string): string => filename.replace(/[^a-zA-Z0-9._-]/g, "_");

// Network host
export const isPublicNetworkHost = (host: string): boolean => {
  if (host === "localhost" || host === "127.0.0.1") return false;
  if (host.startsWith("192.168.") || host.startsWith("10.") || host.startsWith("172.16.")) return false;
  return true;
};
export const normalizePublicNetworkHost = (host: string): string => host;

// HTML
export const isEmptyHtml = (html: string): boolean => {
  return html.replace(/<[^>]*>/g, "").replace(/\s/g, "").length === 0;
};

// Context key
export const extractThreadId = (key: string): string | null => {
  const match = key.match(/thread:([^/]+)/);
  return match ? match[1]! : null;
};
export const buildEmailMapKey = (agentId: string, threadId: string): string => `email:${agentId}:${threadId}`;

// ICS parser
export const parseIcs = (_ics: string) => {
  void _ics;
  return { events: [] };
};

// MIME
export const buildMimeMessage = () => "";
export const extractAttachmentMeta = () => null;
export const filterDownloadableAttachments = () => [];

// Calendar
export const addRepeatInterval = (date: string, _interval: string): string => {
  void _interval;
  return date;
};
export const computeNextScheduledAt = (date: string): string => date;
export const expandOccurrences = (date: string, _count: number): string[] => {
  void _count;
  return [date];
};
export const getOccurrencesPerDay = (): number => 0;

// Logger
export class Logger {
  debug = (_message: string, _data?: unknown) => {
    void _message;
    void _data;
  };
  info = (_message: string, _data?: unknown) => {
    void _message;
    void _data;
  };
  warn = (_message: string, _data?: unknown) => {
    void _message;
    void _data;
  };
  error = (_message: string, _data?: unknown) => {
    void _message;
    void _data;
  };
}
export const createLogger = (_options?: unknown) => {
  void _options;
  return new Logger();
};

// Database mock
export const createDb = () => ({});

// Prompt parser
export const parsePromptMentions = (_prompt: string) => {
  void _prompt;
  return { agents: [], mentions: [] };
};

// Schemas (minimal mocks for testing)

// ---------------------------------------------------------------------------
// Zod-like schema stubs (parse/safeParse passthrough for route unit tests)
// ---------------------------------------------------------------------------
const passthroughSchema = {
  parse: (data: unknown) => data,
  safeParse: (data: unknown) => ({ success: true as const, data }),
  optional: () => passthroughSchema,
  nullable: () => passthroughSchema,
};

export const TaskStatusSchema = passthroughSchema;
export const PersistedLocaleSchema = passthroughSchema;
export const AgentLanguageModeSchema = passthroughSchema;
export const TaskVisibleOutcomeStatusSchema = passthroughSchema;
export const AgentPromptLanguagePolicyApiSchema = passthroughSchema;
export const ClaimedTaskRowSchema = passthroughSchema;
export const ColleagueDataApiSchema = passthroughSchema;
export const TaskAgentDataApiSchema = passthroughSchema;
export const TaskApiBaseSchema = passthroughSchema;
export const TaskSenderApiSchema = passthroughSchema;
export const TaskApiSchema = passthroughSchema;
export const HeartbeatRequestSchema = passthroughSchema;
export const SweepRequestSchema = passthroughSchema;
export const PollRequestSchema = passthroughSchema;
export const FileRequestItemSchema = passthroughSchema;
export const PollMeetingItemSchema = passthroughSchema;
export const PollResponseSchema = passthroughSchema;
export const DaemonPushMessageSchema = passthroughSchema;
export const RegisterResponseSchema = passthroughSchema;
export const DaemonRuntimeItemSchema = passthroughSchema;
export const ActivateTokenRuntimeSchema = passthroughSchema;
export const ActivateTokenRequestSchema = passthroughSchema;
export const RegisterDaemonRequestSchema = passthroughSchema;
export const DeregisterRequestSchema = passthroughSchema;
export const CompleteTaskRequestSchema = passthroughSchema;
export const FailTaskRequestSchema = passthroughSchema;
export const MessageItemSchema = passthroughSchema;
export const ReportMessagesRequestSchema = passthroughSchema;
export const RepeatIntervalSchema = passthroughSchema;
export const CreateCalendarEventRequestSchema = passthroughSchema;
export const UpdateCalendarEventRequestSchema = passthroughSchema;
export const DeleteCalendarEventRequestSchema = passthroughSchema;
export const CalendarEventApiSchema = passthroughSchema;
export const IssueStatusSchema = passthroughSchema;
export const CreateIssueRequestSchema = passthroughSchema;
export const UpdateIssueRequestSchema = passthroughSchema;
export const CreateIssueCommentBodySchema = passthroughSchema;
export const CreateIssueCommentRequestSchema = passthroughSchema;
export const IssueCommentApiSchema = passthroughSchema;
export const IssueApiSchema = passthroughSchema;
export const CreateAgentLinkRequestSchema = passthroughSchema;
export const UpdateAgentLinkRequestSchema = passthroughSchema;
export const UpsertAgentLinkRequestSchema = passthroughSchema;
export const AddWhitelistRequestSchema = passthroughSchema;
export const CreateAgentRequestSchema = passthroughSchema;
export const UpdateAgentRequestSchema = passthroughSchema;
export const CreateConversationRequestSchema = passthroughSchema;
export const CreateMessageRequestSchema = passthroughSchema;
export const AgentDmRequestSchema = passthroughSchema;
export const EmailAttachmentSchema = passthroughSchema;
export const SendEmailRequestSchema = passthroughSchema;
export const UpdateEmailStatusRequestSchema = passthroughSchema;
export const MeetingInfoSchema = passthroughSchema;
export const EmailNotifyRequestSchema = passthroughSchema;
export const CreateEmailAccountSchema = passthroughSchema;
export const UpdateEmailAccountSchema = passthroughSchema;
export const TestEmailConnectionSchema = passthroughSchema;
export const UpdateMemberRequestSchema = passthroughSchema;
export const CreateWorkspaceRequestSchema = passthroughSchema;
export const UpdateWorkspaceRequestSchema = passthroughSchema;
export const DeleteWorkspaceRequestSchema = passthroughSchema;
export const GrantAgentAccessRequestSchema = passthroughSchema;
export const WorkspaceFileBrowseRequestSchema = passthroughSchema;
export const WorkspaceFileEntrySchema = passthroughSchema;
export const WorkspaceFileReportSchema = passthroughSchema;
export const SkillEntrySchema = passthroughSchema;
export const SkillSyncRequestSchema = passthroughSchema;
export const StudioMemberSchema = passthroughSchema;
export const CreateStudioRequestSchema = passthroughSchema;
export const RecruitAgentRequestSchema = passthroughSchema;
export const CreateThreadRequestSchema = passthroughSchema;
