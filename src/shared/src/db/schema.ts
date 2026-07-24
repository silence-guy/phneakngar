import {
  sqliteTable,
  text,
  integer,
  index,
  unique,
  primaryKey,
  foreignKey,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { TASK_TYPES } from "../constants";

// ---------------------------------------------------------------------------
// Better Auth tables
// ---------------------------------------------------------------------------

export const user = sqliteTable("user", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  name: text("name").notNull().default(""),
  email: text("email").unique().notNull(),
  emailVerified: integer("emailVerified", { mode: "boolean" }),
  image: text("image"),
  createdAt: text("createdAt").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updatedAt").notNull().$defaultFn(() => new Date().toISOString()),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey().$defaultFn(() => nanoid()),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").unique().notNull(),
    expiresAt: text("expiresAt").notNull(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    createdAt: text("createdAt").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updatedAt").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [index("idx_session_token_expires").on(t.token, t.expiresAt)]
);

export const account = sqliteTable("account", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  accessTokenExpiresAt: text("accessTokenExpiresAt"),
  refreshTokenExpiresAt: text("refreshTokenExpiresAt"),
  scope: text("scope"),
  idToken: text("idToken"),
  password: text("password"),
  createdAt: text("createdAt").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updatedAt").notNull().$defaultFn(() => new Date().toISOString()),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: text("expiresAt").notNull(),
  createdAt: text("createdAt").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updatedAt").notNull().$defaultFn(() => new Date().toISOString()),
});

// ---------------------------------------------------------------------------
// Application tables
// ---------------------------------------------------------------------------

export const workspace = sqliteTable("workspace", {
  id: text("id").primaryKey().$defaultFn(() => "sp_" + nanoid()),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  onboarded: integer("onboarded").notNull().default(0),
  defaultLocale: text("default_locale").notNull().default("km"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const member = sqliteTable(
  "member",
  {
    id: text("id").primaryKey().$defaultFn(() => nanoid()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    globalInstruction: text("global_instruction").notNull().default(""),
    preferredLocale: text("preferred_locale").notNull().default("km"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [unique("member_workspace_user").on(t.workspaceId, t.userId)]
);

export const workspaceInvite = sqliteTable(
  "workspace_invite",
  {
    id: text("id").primaryKey().$defaultFn(() => "inv_" + nanoid()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    token: text("token").unique().notNull().$defaultFn(() => nanoid(32)),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    usedBy: text("used_by").references(() => user.id, { onDelete: "set null" }),
    usedAt: text("used_at"),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    index("idx_workspace_invite_token").on(t.token),
    index("idx_workspace_invite_workspace").on(t.workspaceId),
  ]
);

export const agentAccess = sqliteTable(
  "agent_access",
  {
    id: text("id").primaryKey().$defaultFn(() => nanoid()),
    agentId: text("agent_id").notNull(),
    workspaceId: text("workspace_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    unique("agent_access_agent_ws_user").on(t.agentId, t.workspaceId, t.userId),
    index("idx_agent_access_agent_ws").on(t.agentId, t.workspaceId),
    index("idx_agent_access_user").on(t.userId),
    foreignKey({
      columns: [t.agentId, t.workspaceId],
      foreignColumns: [agent.id, agent.workspaceId],
    }).onDelete("cascade"),
  ]
);

export const agentPin = sqliteTable(
  "agent_pin",
  {
    id: text("id").primaryKey().$defaultFn(() => nanoid()),
    agentId: text("agent_id").notNull(),
    workspaceId: text("workspace_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    position: integer("position").notNull().default(0),
  },
  (t) => [
    unique("agent_pin_agent_ws_user").on(t.agentId, t.workspaceId, t.userId),
    index("idx_agent_pin_ws_user").on(t.workspaceId, t.userId),
    foreignKey({
      columns: [t.agentId, t.workspaceId],
      foreignColumns: [agent.id, agent.workspaceId],
    }).onDelete("cascade"),
  ]
);

export const agentSidebarOrder = sqliteTable(
  "agent_sidebar_order",
  {
    id: text("id").primaryKey().$defaultFn(() => nanoid()),
    agentId: text("agent_id").notNull(),
    workspaceId: text("workspace_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (t) => [
    unique("agent_sidebar_order_agent_ws_user").on(t.agentId, t.workspaceId, t.userId),
    index("idx_agent_sidebar_order_ws_user").on(t.workspaceId, t.userId),
    foreignKey({
      columns: [t.agentId, t.workspaceId],
      foreignColumns: [agent.id, agent.workspaceId],
    }).onDelete("cascade"),
  ]
);

export const machine = sqliteTable(
  "machine",
  {
    chhlatId: text("chhlat_id").notNull(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    deviceInfo: text("device_info").notNull().default(""),
    lastSeenAt: text("last_seen_at"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    pendingUpdateVersion: text("pending_update_version"),
    pendingRescan: integer("pending_rescan", { mode: "boolean" }).default(false),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
    ownerId: text("owner_id").references(() => user.id, { onDelete: "set null" }),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.chhlatId] })]
);

export const agentRuntime = sqliteTable(
  "agent_runtime",
  {
    id: text("id").primaryKey().$defaultFn(() => nanoid()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    chhlatId: text("chhlat_id").notNull(),
    runtimeMode: text("runtime_mode").notNull().default("local"),
    provider: text("provider").notNull(),
    deviceInfo: text("device_info").notNull().default(""),
    metadata: text("metadata", { mode: "json" }),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    unique("agent_runtime_workspace_chhlat_provider").on(
      t.workspaceId,
      t.chhlatId,
      t.provider
    ),
    index("idx_agent_runtime_workspace_chhlat").on(t.workspaceId, t.chhlatId),
    index("idx_agent_runtime_chhlat_workspace").on(t.chhlatId, t.workspaceId),
  ]
);

export const agent = sqliteTable(
  "agent",
  {
    id: text("id").notNull().$defaultFn(() => "ag_" + nanoid(8)),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    instructions: text("instructions").notNull().default(""),
    /** Helio-style role title (e.g. "Day Planner", "Inbox AI"). */
    roleTitle: text("role_title").notNull().default(""),
    /** Long-term responsibility statement for ownership UX. */
    responsibility: text("responsibility").notNull().default(""),
    avatarUrl: text("avatar_url"),
    runtimeId: text("runtime_id").references(() => agentRuntime.id),
    runtimeMode: text("runtime_mode").notNull().default("local"),
    runtimeConfig: text("runtime_config", { mode: "json" }),
    visibility: text("visibility").notNull().default("private"),
    status: text("status").notNull().default("idle"),
    maxConcurrentTasks: integer("max_concurrent_tasks").notNull().default(6),
    ownerId: text("owner_id").references(() => user.id),
    tools: text("tools", { mode: "json" }),
    triggers: text("triggers", { mode: "json" }),
    emailHandle: text("email_handle").unique(),
    preferredLocale: text("preferred_locale"),
    languagePolicy: text("language_policy"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [primaryKey({ columns: [t.id, t.workspaceId] })]
);

export const agentWhitelist = sqliteTable(
  "agent_whitelist",
  {
    id: text("id").primaryKey().$defaultFn(() => nanoid()),
    agentId: text("agent_id").notNull(),
    workspaceId: text("workspace_id").notNull(),
    email: text("email").notNull(),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    unique("agent_whitelist_agent_ws_email").on(t.agentId, t.workspaceId, t.email),
    foreignKey({
      columns: [t.agentId, t.workspaceId],
      foreignColumns: [agent.id, agent.workspaceId],
    }).onDelete("cascade"),
  ]
);

export const channel = sqliteTable(
  "channel",
  {
    id: text("id").primaryKey().$defaultFn(() => "ch_" + nanoid()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    unique("channel_workspace_name").on(t.workspaceId, t.name),
    index("idx_channel_workspace").on(t.workspaceId),
  ]
);

export const conversation = sqliteTable(
  "conversation",
  {
    id: text("id").primaryKey().$defaultFn(() => nanoid()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    agentId: text("agent_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull().default(""),
    type: text("type").notNull().default(TASK_TYPES.USER_DM_MESSAGE),
    channel: text("channel").notNull().default("default"),
    parentMessageId: text("parent_message_id"),
    threadTitle: text("thread_title").notNull().default(""),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    index("idx_conversation_agent_lookup")
      .on(t.workspaceId, t.agentId, t.userId, t.type, t.channel, t.createdAt),
    index("idx_conversation_ws_user").on(t.workspaceId, t.userId, t.createdAt),
    index("idx_conversation_thread").on(t.parentMessageId),
    unique("uq_conversation_parent_message").on(t.parentMessageId, t.workspaceId),
    foreignKey({
      columns: [t.agentId, t.workspaceId],
      foreignColumns: [agent.id, agent.workspaceId],
    }).onDelete("cascade"),
  ]
);

export const message = sqliteTable(
  "message",
  {
    id: text("id").primaryKey().$defaultFn(() => nanoid()),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull().default(""),
    taskId: text("task_id"),
    attachmentIds: text("attachment_ids"),
    metadata: text("metadata"),
    status: text("status").notNull().default("active"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    index("idx_message_conversation_status").on(t.conversationId, t.status),
  ]
);

export const agentTaskQueue = sqliteTable(
  "agent_task_queue",
  {
    id: text("id").primaryKey().$defaultFn(() => nanoid()),
    agentId: text("agent_id").notNull(),
    runtimeId: text("runtime_id")
      .notNull()
      .references(() => agentRuntime.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    prompt: text("prompt").notNull(),
    type: text("type").notNull().default(TASK_TYPES.USER_DM_MESSAGE),
    contextKey: text("context_key"),
    status: text("status").notNull().default("queued"),
    priority: integer("priority").notNull().default(0),
    result: text("result", { mode: "json" }),
    context: text("context", { mode: "json" }),
    sessionId: text("session_id"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    dispatchedAt: text("dispatched_at"),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
    error: text("error"),
    traceId: text("trace_id"),
    parentTaskId: text("parent_task_id"),
    localeOverride: text("locale_override"),
    visibleOutcomeStatus: text("visible_outcome_status").notNull().default("pending"),
    retryOfTaskId: text("retry_of_task_id"),
  },
  (t) => [
    index("idx_task_queue_pending")
      .on(t.agentId, t.status)
      .where(sql`status IN ('queued', 'dispatched')`),
    index("idx_task_queue_workspace_active")
      .on(t.workspaceId, t.status, t.agentId)
      .where(sql`status IN ('queued', 'dispatched', 'running')`),
    index("idx_task_queue_agent_history")
      .on(t.agentId, t.workspaceId, t.createdAt),
    index("idx_task_queue_conversation_status")
      .on(t.conversationId, t.status),
    index("idx_task_queue_trace").on(t.traceId),
    index("idx_task_queue_parent").on(t.parentTaskId),
    index("idx_task_queue_visible_outcome").on(t.workspaceId, t.visibleOutcomeStatus, t.completedAt),
    index("idx_task_queue_workspace_type_status").on(t.workspaceId, t.type, t.status),
    index("idx_task_queue_workspace_status_dispatched").on(t.workspaceId, t.status, t.dispatchedAt),
    index("idx_task_queue_inbox").on(t.workspaceId, t.status, t.completedAt),
    index("idx_task_queue_runtime_pending")
      .on(t.workspaceId, t.runtimeId, t.status)
      .where(sql`status IN ('queued', 'dispatched')`),
    index("idx_task_queue_agent_running")
      .on(t.agentId, t.workspaceId, t.status)
      .where(sql`status IN ('dispatched', 'running')`),
    index("idx_task_queue_inbox_convo")
      .on(t.workspaceId, t.status, t.conversationId, t.completedAt)
      .where(sql`status IN ('completed', 'failed') AND parent_task_id IS NULL`),
    foreignKey({
      columns: [t.agentId, t.workspaceId],
      foreignColumns: [agent.id, agent.workspaceId],
    }).onDelete("cascade"),
  ]
);

export const issue = sqliteTable(
  "issue",
  {
    id: text("id").primaryKey().$defaultFn(() => "iss_" + nanoid()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    agentId: text("agent_id"),
    creatorUserId: text("creator_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id")
      .references(() => conversation.id, { onDelete: "cascade" }),
    latestTaskId: text("latest_task_id").references(() => agentTaskQueue.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: text("status").notNull().default("todo"),
    /** Agent currently holding atomic claim (Helio-style). Null = unclaimed. */
    claimedByAgentId: text("claimed_by_agent_id"),
    claimedAt: text("claimed_at"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
    completedAt: text("completed_at"),
  },
  (t) => [
    index("idx_issue_workspace_status_agent").on(t.workspaceId, t.status, t.agentId),
    index("idx_issue_workspace_updated").on(t.workspaceId, t.updatedAt),
    index("idx_issue_workspace_claimed").on(t.workspaceId, t.claimedByAgentId),
    unique("issue_conversation_unique").on(t.conversationId),
    foreignKey({
      columns: [t.agentId, t.workspaceId],
      foreignColumns: [agent.id, agent.workspaceId],
    }).onDelete("cascade"),
  ]
);

export const issueComment = sqliteTable(
  "issue_comment",
  {
    id: text("id").primaryKey().$defaultFn(() => "ic_" + nanoid()),
    issueId: text("issue_id")
      .notNull()
      .references(() => issue.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    authorType: text("author_type").notNull().default("user"),
    authorId: text("author_id").notNull(),
    content: text("content").notNull(),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    index("idx_issue_comment_issue").on(t.issueId, t.createdAt),
    index("idx_issue_comment_workspace").on(t.workspaceId, t.issueId),
  ]
);

export const taskMessage = sqliteTable(
  "task_message",
  {
    id: text("id").primaryKey().$defaultFn(() => nanoid()),
    taskId: text("task_id")
      .notNull()
      .references(() => agentTaskQueue.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    type: text("type").notNull().default(""),
    tool: text("tool").notNull().default(""),
    content: text("content").notNull().default(""),
    callId: text("call_id").notNull().default(""),
    input: text("input", { mode: "json" }),
    output: text("output").notNull().default(""),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    unique("task_message_task_seq_unique").on(t.taskId, t.seq),
    index("idx_task_message_task_seq").on(t.taskId, t.seq),
    index("idx_task_message_task_created").on(t.taskId, t.createdAt),
  ]
);

export const emails = sqliteTable(
  "emails",
  {
    id: text("id").primaryKey().$defaultFn(() => nanoid()),
    agentId: text("agent_id").notNull(),
    workspaceId: text("workspace_id").notNull(),
    fromEmail: text("from_email").notNull(),
    toEmail: text("to_email").notNull(),
    subject: text("subject").notNull().default(""),
    r2Key: text("r2_key").notNull(),
    isWhitelisted: integer("is_whitelisted", { mode: "boolean" }).notNull().default(false),
    forwarded: integer("forwarded", { mode: "boolean" }).notNull().default(false),
    messageId: text("message_id").notNull().default(""),
    deliveryKey: text("delivery_key"),
    inReplyTo: text("in_reply_to").notNull().default(""),
    references: text("references").notNull().default(""),
    htmlBody: text("html_body").notNull().default(""),
    attachments: text("attachments").notNull().default("[]"),
    status: text("status").notNull().default("unread"),
    direction: text("direction").notNull().default("inbound"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    foreignKey({
      columns: [t.agentId, t.workspaceId],
      foreignColumns: [agent.id, agent.workspaceId],
    }).onDelete("cascade"),
    index("idx_emails_agent_ws_status").on(t.agentId, t.workspaceId, t.status),
    index("idx_emails_to_direction").on(t.toEmail, t.direction),
    index("idx_emails_from_direction").on(t.fromEmail, t.direction),
    index("idx_emails_message_id").on(t.messageId),
    unique("emails_workspace_delivery_key").on(t.workspaceId, t.deliveryKey),
    // Outbound claim recovery: workspace + agent + delivery_key lookups
    index("idx_emails_outbound_claim").on(t.workspaceId, t.agentId, t.deliveryKey),
    index("idx_emails_created_at").on(t.createdAt),
  ]
);

export const calendarEvent = sqliteTable(
  "calendar_event",
  {
    id: text("id").primaryKey().$defaultFn(() => "ce_" + nanoid()),
    agentId: text("agent_id").notNull(),
    workspaceId: text("workspace_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    scheduledAt: text("scheduled_at").notNull(),
    repeatInterval: text("repeat_interval"),
    repeatStopAt: text("repeat_stop_at"),
    lastTriggeredAt: text("last_triggered_at"),
    exceptions: text("exceptions", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    index("idx_calendar_event_agent_ws").on(t.agentId, t.workspaceId),
    index("idx_calendar_event_ws_scheduled").on(t.workspaceId, t.scheduledAt),
    foreignKey({
      columns: [t.agentId, t.workspaceId],
      foreignColumns: [agent.id, agent.workspaceId],
    }).onDelete("cascade"),
  ]
);

export const artifact = sqliteTable(
  "artifact",
  {
    id: text("id").primaryKey().$defaultFn(() => "art_" + nanoid()),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    agentId: text("agent_id").notNull(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    /** Optional link to the producing task (delivery digests/drafts/reports). */
    taskId: text("task_id").references(() => agentTaskQueue.id, { onDelete: "set null" }),
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull().default("application/octet-stream"),
    size: integer("size").notNull(),
    r2Key: text("r2_key").notNull(),
    thumbnailR2Key: text("thumbnail_r2_key"),
    source: text("source").notNull().default("agent"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    index("idx_artifact_conversation").on(t.conversationId),
    index("idx_artifact_task").on(t.workspaceId, t.taskId),
    index("idx_artifact_ws_source").on(t.workspaceId, t.source, t.createdAt),
    foreignKey({
      columns: [t.agentId, t.workspaceId],
      foreignColumns: [agent.id, agent.workspaceId],
    }).onDelete("cascade"),
  ]
);

export const agentEmailAccount = sqliteTable(
  "agent_email_account",
  {
    id: text("id").primaryKey().$defaultFn(() => "aea_" + nanoid()),
    agentId: text("agent_id").notNull(),
    workspaceId: text("workspace_id").notNull(),
    emailAddress: text("email_address").notNull(),
    displayName: text("display_name").notNull().default(""),

    imapHost: text("imap_host").notNull(),
    imapPort: integer("imap_port").notNull().default(993),
    imapUsername: text("imap_username").notNull(),
    imapPassword: text("imap_password").notNull(),
    imapTls: integer("imap_tls", { mode: "boolean" }).notNull().default(true),

    smtpHost: text("smtp_host").notNull(),
    smtpPort: integer("smtp_port").notNull().default(587),
    smtpUsername: text("smtp_username").notNull(),
    smtpPassword: text("smtp_password").notNull(),
    smtpTls: integer("smtp_tls").notNull().default(1),

    pollIntervalSeconds: integer("poll_interval_seconds").notNull().default(60),
    lastSyncedUid: text("last_synced_uid").notNull().default("0"),
    lastSyncedAt: text("last_synced_at"),
    status: text("status").notNull().default("active"),
    errorMessage: text("error_message").notNull().default(""),

    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    index("idx_email_account_agent_ws").on(t.agentId, t.workspaceId),
    unique("email_account_agent_email").on(t.agentId, t.emailAddress),
    foreignKey({
      columns: [t.agentId, t.workspaceId],
      foreignColumns: [agent.id, agent.workspaceId],
    }).onDelete("cascade"),
  ]
);

export const meetingSession = sqliteTable(
  "meeting_session",
  {
    id: text("id").primaryKey().$defaultFn(() => "ms_" + nanoid()),
    agentId: text("agent_id").notNull(),
    workspaceId: text("workspace_id").notNull(),
    title: text("title").notNull().default(""),
    meetingUrl: text("meeting_url").notNull(),
    status: text("status").notNull().default("scheduled"),
    fromEmail: text("from_email"),
    isWhitelisted: integer("is_whitelisted", { mode: "boolean" }).notNull().default(true),
    participants: text("participants", { mode: "json" }).$type<string[]>().notNull().default([]),
    scheduledAt: text("scheduled_at"),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
    transcriptR2Key: text("transcript_r2_key"),
    summary: text("summary"),
    error: text("error"),
    workerSessionId: text("worker_session_id"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    index("idx_meeting_session_agent_ws").on(t.agentId, t.workspaceId),
    index("idx_meeting_session_status").on(t.status),
    foreignKey({
      columns: [t.agentId, t.workspaceId],
      foreignColumns: [agent.id, agent.workspaceId],
    }).onDelete("cascade"),
  ]
);

export const machineToken = sqliteTable(
  "machine_token",
  {
    id: text("id").primaryKey().$defaultFn(() => nanoid()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .references(() => workspace.id, { onDelete: "cascade" }),
    token: text("token").unique().notNull(),
    tokenHash: text("token_hash").unique(),
    name: text("name").notNull().default(""),
    status: text("status").notNull().default("active"),
    hostname: text("hostname"),
    runtimesJson: text("runtimes_json"),
    lastUsedAt: text("last_used_at"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [index("idx_machine_token").on(t.token)]
);

export const messageFlag = sqliteTable(
  "message_flag",
  {
    id: text("id").primaryKey().$defaultFn(() => nanoid()),
    messageId: text("message_id")
      .notNull()
      .references(() => message.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    unique("message_flag_message_user").on(t.messageId, t.userId),
    index("idx_message_flag_ws_user_created").on(t.workspaceId, t.userId, t.createdAt),
    index("idx_message_flag_message_user").on(t.messageId, t.userId),
  ]
);

// ---------------------------------------------------------------------------
// Workspace file request (ephemeral queue for file browsing)
// ---------------------------------------------------------------------------

export const conversationMap = sqliteTable(
  "conversation_map",
  {
    id: text("id").primaryKey().$defaultFn(() => nanoid()),
    key: text("key").notNull(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    unique("conversation_map_key_workspace").on(t.key, t.workspaceId),
  ]
);

export const agentLink = sqliteTable(
  "agent_link",
  {
    id: text("id").primaryKey().$defaultFn(() => "al_" + nanoid()),
    workspaceId: text("workspace_id").notNull(),
    sourceAgentId: text("source_agent_id").notNull(),
    targetAgentId: text("target_agent_id").notNull(),
    instruction: text("instruction").notNull().default(""),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    unique("agent_link_ws_source_target").on(t.workspaceId, t.sourceAgentId, t.targetAgentId),
    index("idx_agent_link_workspace").on(t.workspaceId),
    foreignKey({
      columns: [t.sourceAgentId, t.workspaceId],
      foreignColumns: [agent.id, agent.workspaceId],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.targetAgentId, t.workspaceId],
      foreignColumns: [agent.id, agent.workspaceId],
    }).onDelete("cascade"),
  ]
);

export const conversationReadState = sqliteTable(
  "conversation_read_state",
  {
    id: text("id").primaryKey().$defaultFn(() => nanoid()),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lastReadAt: text("last_read_at").notNull().default("1970-01-01T00:00:00.000Z"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    unique("conversation_read_state_conv_user").on(t.conversationId, t.userId),
    index("idx_conversation_read_state_user").on(t.userId),
  ]
);

export const workspaceFileRequest = sqliteTable(
  "workspace_file_request",
  {
    id: text("id").primaryKey().$defaultFn(() => "wfr_" + nanoid()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    agentId: text("agent_id").notNull(),
    requestType: text("request_type").notNull(),
    path: text("path").notNull().default("."),
    status: text("status").notNull().default("pending"),
    result: text("result"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    index("idx_wfr_workspace_status").on(t.workspaceId, t.status),
  ]
);

export const agentSkill = sqliteTable(
  "agent_skill",
  {
    id: text("id").primaryKey().$defaultFn(() => "as_" + nanoid()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    agentId: text("agent_id"),
    chhlatId: text("chhlat_id"),
    runtime: text("runtime").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    syncedAt: text("synced_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    unique("agent_skill_ws_runtime_name_agent_chhlat").on(t.workspaceId, t.runtime, t.name, t.agentId, t.chhlatId),
    index("idx_as_workspace_runtime").on(t.workspaceId, t.runtime),
    index("idx_as_agent_runtime").on(t.agentId, t.runtime),
    foreignKey({
      columns: [t.agentId, t.workspaceId],
      foreignColumns: [agent.id, agent.workspaceId],
    }).onDelete("cascade"),
  ]
);

export const inboxUnread = sqliteTable(
  "inbox_unread",
  {
    id: text("id").primaryKey().$defaultFn(() => nanoid()),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id").notNull(),
    agentId: text("agent_id").notNull(),
    taskId: text("task_id").notNull(),
    taskType: text("task_type").notNull(),
    taskStatus: text("task_status").notNull(),
    taskPrompt: text("task_prompt"),
    completedAt: text("completed_at").notNull(),
    latestMessageId: text("latest_message_id"),
  },
  (t) => [
    unique("inbox_unread_conv_user").on(t.conversationId, t.userId),
    index("idx_inbox_unread_user_ws").on(t.userId, t.workspaceId, t.taskType, t.completedAt),
  ]
);

// ---------------------------------------------------------------------------
// Helio-parity foundations: automations, memory, approvals, integrations, membership
// ---------------------------------------------------------------------------

/** Readable SOP automations owned by an agent (schedule + delivery surface). */
export const automation = sqliteTable(
  "automation",
  {
    id: text("id").primaryKey().$defaultFn(() => "au_" + nanoid()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    agentId: text("agent_id").notNull(),
    title: text("title").notNull(),
    sopMarkdown: text("sop_markdown").notNull().default(""),
    /** Cron-like or ISO interval descriptor interpreted by the runner (e.g. "0 8 * * *", "daily"). */
    schedule: text("schedule").notNull(),
    /** Next due time (ISO). Stateless due query uses this. */
    nextRunAt: text("next_run_at").notNull(),
    deliveryMode: text("delivery_mode").notNull().default("channel"),
    deliveryChannelId: text("delivery_channel_id"),
    skillName: text("skill_name"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    lastRunAt: text("last_run_at"),
    lastTaskId: text("last_task_id"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    index("idx_automation_ws_next").on(t.workspaceId, t.enabled, t.nextRunAt),
    index("idx_automation_ws_agent").on(t.workspaceId, t.agentId),
    foreignKey({
      columns: [t.agentId, t.workspaceId],
      foreignColumns: [agent.id, agent.workspaceId],
    }).onDelete("cascade"),
  ]
);

/** Durable agent/workspace memory notes (preferences, decisions, facts). */
export const agentMemory = sqliteTable(
  "agent_memory",
  {
    id: text("id").primaryKey().$defaultFn(() => "mem_" + nanoid()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    /** Null = workspace-wide memory. */
    agentId: text("agent_id"),
    kind: text("kind").notNull().default("fact"),
    content: text("content").notNull(),
    sourceTaskId: text("source_task_id"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    index("idx_agent_memory_ws_agent").on(t.workspaceId, t.agentId, t.kind),
    foreignKey({
      columns: [t.agentId, t.workspaceId],
      foreignColumns: [agent.id, agent.workspaceId],
    }).onDelete("cascade"),
  ]
);

/** High-stakes action approvals (email send, tool write-back, skill install). */
export const approval = sqliteTable(
  "approval",
  {
    id: text("id").primaryKey().$defaultFn(() => "ap_" + nanoid()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    agentId: text("agent_id"),
    kind: text("kind").notNull(),
    status: text("status").notNull().default("pending"),
    title: text("title").notNull().default(""),
    summary: text("summary").notNull().default(""),
    /** JSON payload for the action (email id, tool args, skill pack, …). */
    payload: text("payload", { mode: "json" }),
    decidedByUserId: text("decided_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    decidedAt: text("decided_at"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    index("idx_approval_ws_status").on(t.workspaceId, t.status, t.createdAt),
    index("idx_approval_ws_agent").on(t.workspaceId, t.agentId),
    foreignKey({
      columns: [t.agentId, t.workspaceId],
      foreignColumns: [agent.id, agent.workspaceId],
    }).onDelete("cascade"),
  ]
);

/** Per-assistant integration connections (not a single shared workspace bot). */
export const agentIntegration = sqliteTable(
  "agent_integration",
  {
    id: text("id").primaryKey().$defaultFn(() => "ai_" + nanoid()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    agentId: text("agent_id").notNull(),
    provider: text("provider").notNull(),
    status: text("status").notNull().default("active"),
    /** Non-secret config (repo, workspace slug, scopes). */
    config: text("config", { mode: "json" }),
    /** Secret reference only — never store raw tokens in list APIs. */
    secretRef: text("secret_ref"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    unique("agent_integration_ws_agent_provider").on(t.workspaceId, t.agentId, t.provider),
    index("idx_agent_integration_ws_agent").on(t.workspaceId, t.agentId),
    foreignKey({
      columns: [t.agentId, t.workspaceId],
      foreignColumns: [agent.id, agent.workspaceId],
    }).onDelete("cascade"),
  ]
);

/** Channel membership for humans and AI teammates (real membership, no shadow bots). */
export const channelMember = sqliteTable(
  "channel_member",
  {
    id: text("id").primaryKey().$defaultFn(() => "cm_" + nanoid()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    channelId: text("channel_id")
      .notNull()
      .references(() => channel.id, { onDelete: "cascade" }),
    /** "user" | "agent" */
    memberType: text("member_type").notNull(),
    memberId: text("member_id").notNull(),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    unique("channel_member_unique").on(t.channelId, t.memberType, t.memberId),
    index("idx_channel_member_ws").on(t.workspaceId, t.channelId),
    index("idx_channel_member_member").on(t.workspaceId, t.memberType, t.memberId),
  ]
);

/** Conversation membership for multi-party DMs (users + agents). */
export const conversationMember = sqliteTable(
  "conversation_member",
  {
    id: text("id").primaryKey().$defaultFn(() => "cvm_" + nanoid()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    /** "user" | "agent" */
    memberType: text("member_type").notNull(),
    memberId: text("member_id").notNull(),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    unique("conversation_member_unique").on(t.conversationId, t.memberType, t.memberId),
    index("idx_conversation_member_ws").on(t.workspaceId, t.conversationId),
    index("idx_conversation_member_member").on(t.workspaceId, t.memberType, t.memberId),
  ]
);

/**
 * Durable chat-gateway binding (provider + external team → workspace agent/user).
 * Env GATEWAY_TEAM_MAP remains a bootstrap override; DB is the product source of truth.
 * Full commercial Helio/OpenClaw parity is still not claimed.
 */
export const gatewayBinding = sqliteTable(
  "gateway_binding",
  {
    id: text("id").primaryKey().$defaultFn(() => "gb_" + nanoid()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    /** slack | discord | telegram | lark | teams */
    provider: text("provider").notNull(),
    /** External team / tenant / bot scope id. */
    externalTeamId: text("external_team_id").notNull(),
    /** Optional multi-account id within provider. */
    externalAccountId: text("external_account_id"),
    agentId: text("agent_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** active | disabled */
    status: text("status").notNull().default("active"),
    /** open | allowlist | pairing */
    dmPolicy: text("dm_policy").notNull().default("open"),
    /** live | preview — product badge for outbound capability */
    outboundMode: text("outbound_mode").notNull().default("preview"),
    /**
     * Write-only bot/token vault pointer (or embedded secret for self-host MVP).
     * Never returned on list/get APIs — only has_secret.
     */
    secretRef: text("secret_ref"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    unique("gateway_binding_provider_team_account").on(
      t.provider,
      t.externalTeamId,
      t.externalAccountId,
    ),
    index("idx_gateway_binding_ws").on(t.workspaceId, t.provider, t.status),
    index("idx_gateway_binding_lookup").on(t.provider, t.externalTeamId, t.status),
    foreignKey({
      columns: [t.agentId, t.workspaceId],
      foreignColumns: [agent.id, agent.workspaceId],
    }).onDelete("cascade"),
  ]
);

/**
 * Workspace-scoped activity feed (approve / egress / automation / probe).
 * Full commercial company timeline is not claimed — MVP event log only.
 */
export const activityEvent = sqliteTable(
  "activity_event",
  {
    id: text("id").primaryKey().$defaultFn(() => "ae_" + nanoid()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    actorType: text("actor_type"),
    actorId: text("actor_id"),
    subjectType: text("subject_type"),
    subjectId: text("subject_id"),
    summary: text("summary").notNull(),
    payloadJson: text("payload_json"),
    /** Optional idempotency key within workspace (e.g. gateway-egress:taskId). */
    dedupeKey: text("dedupe_key"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    index("idx_activity_event_ws_created").on(t.workspaceId, t.createdAt),
    unique("activity_event_ws_dedupe").on(t.workspaceId, t.dedupeKey),
  ]
);

/** DM pairing / allowlist peer for a gateway binding. */
export const gatewayPeerAllowlist = sqliteTable(
  "gateway_peer_allowlist",
  {
    id: text("id").primaryKey().$defaultFn(() => "gpa_" + nanoid()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    bindingId: text("binding_id")
      .notNull()
      .references(() => gatewayBinding.id, { onDelete: "cascade" }),
    /** Provider peer id (user/chat). */
    peerId: text("peer_id").notNull(),
    /** allow | deny | paired */
    status: text("status").notNull().default("allow"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    unique("gateway_peer_allowlist_unique").on(t.bindingId, t.peerId),
    index("idx_gateway_peer_ws").on(t.workspaceId, t.bindingId),
  ]
);

/** Idempotent ingress keys for external gateway messages. */
export const gatewayIngressDedupe = sqliteTable(
  "gateway_ingress_dedupe",
  {
    id: text("id").primaryKey().$defaultFn(() => "gid_" + nanoid()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    externalMessageId: text("external_message_id").notNull(),
    conversationId: text("conversation_id"),
    messageId: text("message_id"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    unique("gateway_ingress_dedupe_unique").on(t.provider, t.externalMessageId),
    index("idx_gateway_ingress_dedupe_ws").on(t.workspaceId, t.provider),
  ]
);

// ---------------------------------------------------------------------------
// SOP Playbooks: structured, state-machine procedures executed by agent runtimes
// ---------------------------------------------------------------------------

/** Versioned SOP definition owned by a workspace, optionally bound to one agent. */
export const playbook = sqliteTable(
  "playbook",
  {
    id: text("id").primaryKey().$defaultFn(() => "pb_" + nanoid()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    /** Null = workspace-level playbook runnable by any permitted agent. */
    agentId: text("agent_id"),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    /** JSON StepDef[] validated by the shared playbook schema. */
    definition: text("definition", { mode: "json" }).notNull(),
    version: integer("version").notNull().default(1),
    status: text("status").notNull().default("draft"),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    index("idx_playbook_ws_agent_status").on(t.workspaceId, t.agentId, t.status),
    index("idx_playbook_ws_updated").on(t.workspaceId, t.updatedAt),
    foreignKey({
      columns: [t.agentId, t.workspaceId],
      foreignColumns: [agent.id, agent.workspaceId],
    }).onDelete("cascade"),
  ]
);

/** One execution of a playbook; snapshots the definition at start time. */
export const playbookRun = sqliteTable(
  "playbook_run",
  {
    id: text("id").primaryKey().$defaultFn(() => "pbr_" + nanoid()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    playbookId: text("playbook_id")
      .notNull()
      .references(() => playbook.id, { onDelete: "cascade" }),
    playbookVersion: integer("playbook_version").notNull(),
    agentId: text("agent_id").notNull(),
    runtimeId: text("runtime_id").references(() => agentRuntime.id, {
      onDelete: "set null",
    }),
    conversationId: text("conversation_id").references(() => conversation.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("running"),
    currentStepId: text("current_step_id"),
    /** Frozen StepDef[] snapshot taken at run start. */
    snapshot: text("snapshot", { mode: "json" }).notNull(),
    input: text("input", { mode: "json" }),
    /** Accumulated step outputs keyed by step id. */
    output: text("output", { mode: "json" }),
    startedByUserId: text("started_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    currentTaskId: text("current_task_id"),
    currentApprovalId: text("current_approval_id"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
    error: text("error"),
  },
  (t) => [
    index("idx_playbook_run_ws_status").on(t.workspaceId, t.status),
    index("idx_playbook_run_ws_playbook").on(t.workspaceId, t.playbookId, t.createdAt),
    index("idx_playbook_run_ws_agent").on(t.workspaceId, t.agentId, t.status),
    foreignKey({
      columns: [t.agentId, t.workspaceId],
      foreignColumns: [agent.id, agent.workspaceId],
    }).onDelete("cascade"),
  ]
);

/** Per-step execution record within a playbook run. */
export const playbookStepRun = sqliteTable(
  "playbook_step_run",
  {
    id: text("id").primaryKey().$defaultFn(() => "pbsr_" + nanoid()),
    runId: text("run_id")
      .notNull()
      .references(() => playbookRun.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    stepId: text("step_id").notNull(),
    stepKind: text("step_kind").notNull(),
    status: text("status").notNull().default("pending"),
    output: text("output"),
    taskId: text("task_id"),
    approvalId: text("approval_id"),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
    error: text("error"),
  },
  (t) => [
    unique("playbook_step_run_run_step").on(t.runId, t.stepId),
    index("idx_playbook_step_run_ws_run").on(t.workspaceId, t.runId),
  ]
);
