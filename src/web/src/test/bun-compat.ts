/**
 * Bun test compatibility helpers for Vitest APIs that bun doesn't support.
 * Use these instead of vi.importActual which bun test doesn't support.
 */

import * as sharedMockModule from "./shared-mock";

type MockFn = ReturnType<typeof import("vitest").vi.fn>;

/**
 * Imports the actual implementation of a module.
 * For @phneakngar/shared, returns the shared-mock exports.
 * For other modules, uses dynamic import.
 *
 * @example
 * // Instead of:
 * vi.mock("@phneakngar/shared", async () => {
 *   const actual = await vi.importActual("@phneakngar/shared");
 *   return { ...actual, queries: { ... } };
 * });
 *
 * // Use:
 * vi.mock("@phneakngar/shared", () => ({
 *   ...importActual("@phneakngar/shared"),
 *   queries: { ... },
 * }));
 */
export function importActual(modulePath: string): Record<string, unknown> {
  if (modulePath === "@phneakngar/shared") {
    return sharedMockModule as unknown as Record<string, unknown>;
  }
  // For other modules, return empty object - caller should provide all needed exports
  return {};
}

// Helper for mocking fetch in bun test
export function mockFetch(mock: MockFn) {
  // Vitest Mock is not assignable to Workers-typed fetch; cast for test stubbing only.
  globalThis.fetch = mock as unknown as typeof globalThis.fetch;
}

// Mock for modules that use vi.mock with importActual pattern
export function createModuleMock(partialMock: Record<string, unknown>) {
  return partialMock;
}

// Complete mock for @phneakngar/shared - use this instead of vi.importActual
// This provides all the exports that tests need
export const sharedMock = {
  // Constants
  DEV_PASSWORD: "dev-pw",
  DEV_WEB_URL: "http://localhost:3000",
  DEV_WS_DO_URL: "http://localhost:8789",
  DEV_EMAIL_WORKER_URL: "http://localhost:8787",
  EMAIL_NOTIFY_SECRET_HEADER: "x-email-notify-secret",
  POLL_INTERVAL_MS: 1000,
  OFFLINE_THRESHOLD_MS: 30000,
  EVENT_POLL_INTERVAL_MS: 1000,
  AGENT_HANDLE_MIN_LENGTH: 4,
  MAX_TASKS_PER_TRACE: 1000,

  // Enums
  AgentStatus: { ONLINE: "online", OFFLINE: "offline" },
  RuntimeStatus: { READY: "ready", BUSY: "busy", INITIALIZING: "initializing", ERROR: "error" },
  TaskStatus: { QUEUED: "queued", DISPATCHED: "dispatched", RUNNING: "running", COMPLETED: "completed", FAILED: "failed", CANCELLED: "cancelled", SUPERSEDED: "superseded" },
  TERMINAL_TASK_STATUSES: new Set(["completed", "failed", "cancelled", "superseded"]),
  isTerminalTaskStatus: (status: string) => ["completed", "failed", "cancelled", "superseded"].includes(status),
  TASK_TYPES: { USER_DM_MESSAGE: "user_dm_message", EMAIL_NOTIFICATION: "email_notification", CALENDAR_EVENT: "calendar_event", INTERNAL_TASK: "internal_task" },
  IssueStatus: { TODO: "todo", IN_PROGRESS: "in_progress", DONE: "done" },
  ACTIVE_ISSUE_STATUSES: new Set(["todo", "in_progress"]),
  TERMINAL_ISSUE_STATUSES: new Set(["done"]),
  isTerminalIssueStatus: (status: string) => ["done"].includes(status),
  MessageRole: { USER: "user", ASSISTANT: "assistant", SYSTEM: "system" },
  MeetingStatus: { PENDING: "pending", SCHEDULED: "scheduled", JOINING: "joining", RECORDING: "recording", COMPLETED: "completed", FAILED: "failed" },
  TERMINAL_MEETING_STATUSES: new Set(["completed", "failed"]),

  // Locale
  Locale: { EN: "en", KM: "km" },
  SUPPORTED_LOCALES: ["en", "km"],
  AgentLanguageMode: { KHMER: "khmer", ENGLISH: "english" },
  SUPPORTED_AGENT_LANGUAGE_MODES: ["khmer", "english"],
  defaultLocale: "km",
  localeDisplayLabels: { en: "English", km: "ខ្មែរ" },
  coreEntityLabels: { agent: "Agent", conversation: "Conversation", message: "Message" },
  agentStatusLabels: { online: "Online", offline: "Offline" },
  runtimeStatusLabels: { ready: "Ready", busy: "Busy", initializing: "Initializing", error: "Error" },
  taskStatusLabels: { queued: "Queued", dispatched: "Dispatched", running: "Running", completed: "Completed", failed: "Failed", cancelled: "Cancelled", superseded: "Superseded" },
  taskTypeLabels: { user_dm_message: "Message", email_notification: "Email", calendar_event: "Calendar", internal_task: "Internal" },
  issueStatusLabels: { todo: "To Do", in_progress: "In Progress", done: "Done" },
  messageRoleLabels: { user: "User", assistant: "Assistant", system: "System" },
  meetingStatusLabels: { pending: "Pending", scheduled: "Scheduled", joining: "Joining", recording: "Recording", completed: "Completed", failed: "Failed" },
  statusLabels: {},
  localeTechnicalTokenPolicy: "preserve",
  isSupportedLocale: (locale: string) => ["en", "km"].includes(locale),
  isSupportedAgentLanguageMode: (mode: string) => ["khmer", "english"].includes(mode),
  resolveLocale: (locale: string | null | undefined) => locale && ["en", "km"].includes(locale) ? locale : "km",
  resolveAgentLanguageMode: (mode: string | null | undefined) => mode && ["khmer", "english"].includes(mode) ? mode : "khmer",
  resolveAgentLanguagePolicy: (mode: string | null | undefined) => mode || "khmer",
  buildAgentPromptLanguagePolicy: (mode: string) => mode,
  getLocalizedLabel: (key: string, locale: string) => locale === "en" ? key : key,

  // Email utils
  parseEmailHandle: (handle: string) => handle.toLowerCase().trim(),
  toPhneakngarAddress: (email: string) => `${email.split("@")[0]}@phneak.ngar`,
  isValidHandle: (handle: string) => /^[a-zA-Z0-9-]{4,}$/.test(handle),
  isValidEmail: (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
  isPhneakngarEmail: (email: string) => email.endsWith("@phneak.ngar"),

  // Validation
  isValidToken: (token: string | null | undefined) => typeof token === "string" && token.length > 0,

  // Status
  isOnline: (lastSeenAt: string | null | undefined) => {
    if (!lastSeenAt) return false;
    return Date.now() - new Date(lastSeenAt).getTime() < 30000;
  },
  formatStatus: (online: boolean) => online ? "Online" : "Offline",

  // DB
  isUniqueConstraintError: (error: unknown) => {
    if (error instanceof Error && (error.message.includes("UNIQUE") || error.message.includes("unique"))) return true;
    return false;
  },

  // Slug
  generateWorkspaceSlug: (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),

  // Title
  truncateTitle: (title: string, maxLength: number) => {
    if (title.length <= maxLength) return title;
    return title.slice(0, maxLength - 3) + "...";
  },
  truncateGraphemes: (str: string, maxGraphemes: number) => {
    const graphemes = [...str];
    if (graphemes.length <= maxGraphemes) return str;
    return graphemes.slice(0, maxGraphemes - 1).join("") + "…";
  },
  sliceGraphemes: (str: string, start: number, end: number) => [...str].slice(start, end).join(""),
  toGraphemes: (str: string) => [...str],

  // Mode
  resolveMode: () => "cli",
  cliCommand: "phneakngar",
  cliPackageName: "@phneakngar/cli",
  updateCommand: "phneakngar update",
  chhlatCommand: "phneakngar chhlat",
  getBaseUrl: () => "http://localhost:3000",
  isTauri: () => false,
  isDesktop: () => false,
  isMobile: () => false,
  tauriInvoke: async () => { throw new Error("Not implemented"); },

  // Semver
  semverGte: (v1: string, v2: string) => {
    const parts1 = v1.split(".").map(Number);
    const parts2 = v2.split(".").map(Number);
    for (let i = 0; i < 3; i++) {
      if (parts1[i]! > parts2[i]!) return true;
      if (parts1[i]! < parts2[i]!) return false;
    }
    return true;
  },

  // Email attachments
  buildEmailDraftAttachmentKey: (id: string) => `drafts/${id}`,
  getEmailDraftAttachmentPrefix: () => "drafts/",
  isEmailDraftAttachmentKeyForScope: (key: string) => key.startsWith("drafts/"),
  sanitizeEmailAttachmentFilename: (filename: string) => filename.replace(/[^a-zA-Z0-9._-]/g, "_"),

  // Network
  isPublicNetworkHost: (host: string) => {
    if (host === "localhost" || host === "127.0.0.1") return false;
    if (host.startsWith("192.168.") || host.startsWith("10.") || host.startsWith("172.16.")) return false;
    return true;
  },
  normalizePublicNetworkHost: (host: string) => host,

  // HTML
  isEmptyHtml: (html: string) => html.replace(/<[^>]*>/g, "").replace(/\s/g, "").length === 0,

  // Context key
  extractThreadId: (key: string) => {
    const match = key.match(/thread:([^/]+)/);
    return match ? match[1]! : null;
  },
  buildEmailMapKey: (agentId: string, threadId: string) => `email:${agentId}:${threadId}`,

  // ICS
  parseIcs: (_ics: string) => {
    void _ics;
    return { events: [] };
  },

  // MIME
  buildMimeMessage: () => "",
  extractAttachmentMeta: () => null,
  filterDownloadableAttachments: () => [],

  // Calendar
  addRepeatInterval: (date: string, _interval: string) => {
    void _interval;
    return date;
  },
  computeNextScheduledAt: (date: string) => date,
  expandOccurrences: (date: string, _count: number) => {
    void _count;
    return [date];
  },
  getOccurrencesPerDay: () => 0,

  // Logger
  Logger: class { debug = () => {}; info = () => {}; warn = () => {}; error = () => {}; },
  createLogger: () => new class { debug = () => {}; info = () => {}; warn = () => {}; error = () => {}; },

  // Database
  createDb: () => ({}),

  // Prompt parser
  parsePromptMentions: (_prompt: string) => {
    void _prompt;
    return { agents: [], mentions: [] };
  },

  // Schemas
  CreateAgentRequestSchema: { parse: (data: unknown) => data },
  TaskStatusSchema: { parse: (data: unknown) => data },
};
