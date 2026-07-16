import { z } from "zod";
import { IssueStatus, MAX_POLL_TASKS, TASK_TYPES } from "./constants";
import { isPublicNetworkHost } from "./network-host";
import { withChhlatIdFields } from "./chhlat-id";

// ---------------------------------------------------------------------------
// Task status
// ---------------------------------------------------------------------------

export const TaskStatusSchema = z.enum([
  "queued",
  "dispatched",
  "running",
  "completed",
  "failed",
  "cancelled",
  "superseded",
]);

export const PersistedLocaleSchema = z.enum(["km", "en"]);
export type PersistedLocale = z.infer<typeof PersistedLocaleSchema>;

export const AgentLanguageModeSchema = z.enum(["km", "en", "bilingual", "auto"]);
export type AgentLanguageModeApi = z.infer<typeof AgentLanguageModeSchema>;

export const TaskVisibleOutcomeStatusSchema = z.enum([
  "pending",
  "visible_output",
  "completed_without_visible_output",
  "not_required",
]);
export type TaskVisibleOutcomeStatus = z.infer<typeof TaskVisibleOutcomeStatusSchema>;

export const AgentPromptLanguagePolicyApiSchema = z.object({
  default_user_facing_language: z.enum(["km-KH", "en", "auto", "bilingual"]),
  apply_to: z.string(),
  preserve_english_for: z.array(z.string()).readonly(),
  guidance: z.string(),
  custom_policy: z.string().optional(),
});
export type AgentPromptLanguagePolicyApi = z.infer<typeof AgentPromptLanguagePolicyApiSchema>;

// ---------------------------------------------------------------------------
// Raw SQL row from agent_task_queue (boundary: DB -> App)
// ---------------------------------------------------------------------------

export const ClaimedTaskRowSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  runtimeId: z.string(),
  workspaceId: z.string(),
  conversationId: z.string(),
  prompt: z.string(),
  status: z.string(),
  priority: z.coerce.number(),
  result: z.unknown().nullable(),
  context: z.unknown().nullable(),
  type: z.string().default(TASK_TYPES.USER_DM_MESSAGE),
  contextKey: z.string().nullable().optional(),
  sessionId: z.string().nullable(),
  createdAt: z.coerce.date(),
  dispatchedAt: z.coerce.date().nullable(),
  startedAt: z.coerce.date().nullable(),
  completedAt: z.coerce.date().nullable(),
  error: z.string().nullable(),
  traceId: z.string().nullable().optional(),
  parentTaskId: z.string().nullable().optional(),
  localeOverride: z.string().nullable().optional(),
  visibleOutcomeStatus: TaskVisibleOutcomeStatusSchema.default("pending"),
  retryOfTaskId: z.string().nullable().optional(),
});
export type ClaimedTaskRow = z.infer<typeof ClaimedTaskRowSchema>;

// ---------------------------------------------------------------------------
// API wire format — task agent data (embedded in claim response)
// ---------------------------------------------------------------------------

export const ColleagueDataApiSchema = z.object({
  name: z.string(),
  email: z.string(),
  description: z.string(),
  instruction: z.string(),
});

export const TaskAgentDataApiSchema = z.object({
  instructions: z.string(),
  name: z.string(),
  runtime_config: z.record(z.string(), z.unknown()).default({}),
  email_handle: z.string().nullable().optional(),
  email_address: z.string().nullable().optional(),
  email_addresses: z.array(z.string()).default([]),
  user_email: z.string().nullable().optional(),
  user_name: z.string().nullable().optional(),
  colleagues: z.array(ColleagueDataApiSchema).default([]),
  preferred_locale: AgentLanguageModeSchema.nullable().optional(),
  language_policy: z.string().nullable().optional(),
});
export type TaskAgentDataApi = z.infer<typeof TaskAgentDataApiSchema>;

// ---------------------------------------------------------------------------
// API wire format — base task (output of taskToResponse)
// ---------------------------------------------------------------------------

export const TaskApiBaseSchema = z.object({
  id: z.string(),
  agent_id: z.string(),
  runtime_id: z.string(),
  conversation_id: z.string(),
  workspace_id: z.string(),
  prompt: z.string(),
  status: z.string(),
  priority: z.number(),
  dispatched_at: z.string().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  result: z.unknown().nullable(),
  error: z.string().nullable(),
  created_at: z.string(),
  type: z.string(),
  context_key: z.string().nullable().optional(),
  context: z.unknown().nullable().optional(),
  trace_id: z.string().nullable().optional(),
  parent_task_id: z.string().nullable().optional(),
  locale_override: z.string().nullable().optional(),
  visible_outcome_status: TaskVisibleOutcomeStatusSchema.nullable().optional(),
  retry_of_task_id: z.string().nullable().optional(),
  language_policy: AgentPromptLanguagePolicyApiSchema.optional(),
  channel: z.string().nullable().optional(),
});
export type TaskApiBase = z.infer<typeof TaskApiBaseSchema>;

// ---------------------------------------------------------------------------
// API wire format — full task (claim response includes agent + prior session)
// ---------------------------------------------------------------------------

export const TaskSenderApiSchema = z.object({
  name: z.string(),
  email: z.string(),
  is_owner: z.boolean(),
});
export type TaskSenderApi = z.infer<typeof TaskSenderApiSchema>;

export const TaskApiSchema = TaskApiBaseSchema.extend({
  agent: TaskAgentDataApiSchema.nullable().optional(),
  sender: TaskSenderApiSchema.nullable().optional(),
});
export type TaskApi = z.infer<typeof TaskApiSchema>;

// ---------------------------------------------------------------------------
// Heartbeat (lightweight liveness ping, independent of poll)
// ---------------------------------------------------------------------------

export const HeartbeatRequestSchema = withChhlatIdFields({});
export type HeartbeatRequest = z.infer<typeof HeartbeatRequestSchema>;

export const SweepRequestSchema = HeartbeatRequestSchema;
export type SweepRequest = HeartbeatRequest;

// ---------------------------------------------------------------------------
// Poll request/response (replaces heartbeat + per-runtime claim)
// ---------------------------------------------------------------------------

export const PollRequestSchema = withChhlatIdFields({
  max_tasks: z.number().int().min(1).default(1).transform((value) => Math.min(value, MAX_POLL_TASKS)),
  cli_version: z.string().optional(),
});
export type PollRequest = z.infer<typeof PollRequestSchema>;

export const FileRequestItemSchema = z.object({
  id: z.string(),
  agent_id: z.string(),
  request_type: z.enum(["tree", "read"]),
  path: z.string(),
});
export type FileRequestItem = z.infer<typeof FileRequestItemSchema>;

export const PollMeetingItemSchema = z.object({
  id: z.string(),
  meeting_url: z.string(),
  participants: z.array(z.string()),
  workspace_id: z.string(),
  agent_id: z.string(),
  agent_name: z.string(),
  title: z.string().optional(),
});
export type PollMeetingItem = z.infer<typeof PollMeetingItemSchema>;

export const PollResponseSchema = z.object({
  tasks: z.array(TaskApiSchema),
  evicted: z.boolean().optional(),
  pending_update: z.object({ version: z.string() }).optional(),
  pending_rescan: z.boolean().optional(),
  file_requests: z.array(FileRequestItemSchema).optional(),
  meetings: z.array(PollMeetingItemSchema).optional(),
});
export type PollResponse = z.infer<typeof PollResponseSchema>;

// ---------------------------------------------------------------------------
// Chhlat push messages (server -> chhlat WebSocket)
// ---------------------------------------------------------------------------

export const ChhlatPushMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("chhlat.tasks"), tasks: z.array(TaskApiSchema) }),
  z.object({ type: z.literal("chhlat.file_requests"), workspaceId: z.string(), requests: z.array(FileRequestItemSchema) }),
  z.object({ type: z.literal("chhlat.meetings"), meetings: z.array(PollMeetingItemSchema) }),
  z.object({ type: z.literal("chhlat.evict"), workspaceId: z.string() }),
  z.object({ type: z.literal("chhlat.update"), version: z.string() }),
  z.object({ type: z.literal("chhlat.rescan") }),
  z.object({ type: z.literal("chhlat.kill"), workspaceId: z.string(), agentId: z.string().min(1), taskId: z.string(), targetTaskId: z.string() }),
]);
export type ChhlatPushMessageType = z.infer<typeof ChhlatPushMessageSchema>;

// ---------------------------------------------------------------------------
// Register response
// ---------------------------------------------------------------------------

export const RegisterResponseSchema = z.object({
  runtimes: z.array(z.object({ id: z.string() })),
});
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;

// ---------------------------------------------------------------------------
// Chhlat API request schemas
// ---------------------------------------------------------------------------

const ChhlatHeadroomNextActionSchema = z.enum([
  "enable_headroom",
  "install_headroom",
  "configure_headroom_path",
]);

const ChhlatHeadroomCapabilitySchema = z
  .object({
    status: z.enum(["disabled", "available", "missing"]),
    configured: z.boolean(),
    available: z.boolean(),
    mode: z.literal("proxy"),
    port: z.number().int().min(1024).max(65535),
    executable: z.string().min(1).max(100),
    next_actions: z.array(ChhlatHeadroomNextActionSchema).max(3).optional().default([]),
  })
  .strict();

export const ChhlatRuntimeItemSchema = z.object({
  type: z.string().optional(),
  provider: z.string().optional(),
  runtime_mode: z.string().optional(),
  version: z.string().optional(),
  status: z.string().optional(),
  model: z.string().optional(),
  headroom: ChhlatHeadroomCapabilitySchema.optional(),
});
export type ChhlatRuntimeItem = z.infer<typeof ChhlatRuntimeItemSchema>;

export const ActivateTokenRuntimeSchema = z.object({
  type: z.string().min(1),
  version: z.string().optional().default(""),
});
export type ActivateTokenRuntime = z.infer<typeof ActivateTokenRuntimeSchema>;

export const ActivateTokenRequestSchema = z.object({
  token: z.string().min(1),
  hostname: z.string().min(1),
  runtimes: z.array(ActivateTokenRuntimeSchema).min(1),
});
export type ActivateTokenRequest = z.infer<typeof ActivateTokenRequestSchema>;

export const RegisterChhlatRequestSchema = withChhlatIdFields({
  workspace_id: z.string().min(1).optional(),
  device_name: z.string().optional().default(""),
  cli_version: z.string().optional().default(""),
  workspaces_root: z.string().optional().default(""),
  runtimes: z.array(ChhlatRuntimeItemSchema).min(1),
});
export type RegisterChhlatRequest = z.infer<typeof RegisterChhlatRequestSchema>;

export const DeregisterRequestSchema = withChhlatIdFields({});
export type DeregisterRequest = z.infer<typeof DeregisterRequestSchema>;


export const CompleteTaskRequestSchema = z.object({
  output: z.string().optional(),
  session_id: z.string().optional(),
  branch_name: z.string().optional(),
});
export type CompleteTaskRequest = z.infer<typeof CompleteTaskRequestSchema>;

export const FailTaskRequestSchema = z.object({
  error: z.string().optional().default(""),
});
export type FailTaskRequest = z.infer<typeof FailTaskRequestSchema>;

export const MessageItemSchema = z.object({
  seq: z.number(),
  type: z.string(),
  tool: z.string().optional(),
  call_id: z.string().optional(),
  content: z.string().optional(),
  input: z.record(z.string(), z.unknown()).optional(),
  output: z.string().optional(),
});
export type MessageItem = z.infer<typeof MessageItemSchema>;

export const ReportMessagesRequestSchema = z.object({
  messages: z.array(MessageItemSchema),
});
export type ReportMessagesRequest = z.infer<typeof ReportMessagesRequestSchema>;

// ---------------------------------------------------------------------------
// Calendar event schemas
// ---------------------------------------------------------------------------

export const RepeatIntervalSchema = z
  .string()
  .regex(/^\d+(min|hour|day|week|month)$/, {
    message:
      "repeat_interval must match <positive_integer><min|hour|day|week|month>",
  });

export const CreateCalendarEventRequestSchema = z
  .object({
    agent_id: z.string().min(1),
    title: z.string().min(1),
    description: z.string().max(20_000).optional(),
    scheduled_at: z
      .string()
      .min(1)
      .refine((s) => !Number.isNaN(Date.parse(s)), {
        message: "scheduled_at must be a valid ISO datetime",
      }),
    repeat_interval: RepeatIntervalSchema.optional(),
    repeat_stop_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    conversation_id: z.string().optional(),
  })
  .refine(
    (data) =>
      !data.repeat_stop_date || !!data.repeat_interval,
    {
      message: "repeat_stop_date requires repeat_interval",
      path: ["repeat_stop_date"],
    }
  );
export type CreateCalendarEventRequestInput = z.infer<
  typeof CreateCalendarEventRequestSchema
>;

export const UpdateCalendarEventRequestSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().max(20_000).nullable().optional(),
    agent_id: z.string().min(1).optional(),
    scheduled_at: z
      .string()
      .min(1)
      .refine((s) => !Number.isNaN(Date.parse(s)), {
        message: "scheduled_at must be a valid ISO datetime",
      })
      .optional(),
    repeat_interval: RepeatIntervalSchema.nullable().optional(),
    repeat_stop_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    scope: z.enum(["this", "following"]).optional(),
    occurrence_at: z
      .string()
      .min(1)
      .refine((s) => !Number.isNaN(Date.parse(s)), {
        message: "occurrence_at must be a valid ISO datetime",
      })
      .optional(),
  })
  .refine(
    (v) =>
      v.title !== undefined ||
      v.description !== undefined ||
      v.agent_id !== undefined ||
      v.scheduled_at !== undefined ||
      v.repeat_interval !== undefined ||
      v.repeat_stop_date !== undefined,
    { message: "at least one field is required" }
  );

export const DeleteCalendarEventRequestSchema = z.object({
  scope: z.enum(["this", "following"]).optional(),
  occurrence_at: z
    .string()
    .min(1)
    .refine((s) => !Number.isNaN(Date.parse(s)), {
      message: "occurrence_at must be a valid ISO datetime",
    })
    .optional(),
});
export type DeleteCalendarEventRequestInput = z.infer<
  typeof DeleteCalendarEventRequestSchema
>;

export type UpdateCalendarEventRequestInput = z.infer<
  typeof UpdateCalendarEventRequestSchema
>;

export const CalendarEventApiSchema = z.object({
  id: z.string(),
  agent_id: z.string(),
  workspace_id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  scheduled_at: z.string(),
  occurrence_at: z.string(),
  collapsed_count: z.number().nullable().optional(),
  repeat_interval: z.string().nullable(),
  repeat_stop_at: z.string().nullable(),
  last_triggered_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type CalendarEventApi = z.infer<typeof CalendarEventApiSchema>;

// ---------------------------------------------------------------------------
// Issue schemas
// ---------------------------------------------------------------------------

export const IssueStatusSchema = z.enum([
  IssueStatus.TODO,
  IssueStatus.IN_PROGRESS,
  IssueStatus.BLOCKED,
  IssueStatus.REVIEW,
  IssueStatus.DONE,
  IssueStatus.CLOSED,
  IssueStatus.CANCELED,
  IssueStatus.FAILED,
]);

export const CreateIssueRequestSchema = z.object({
  agent_id: z.string().min(1).optional(),
  title: z.string().min(1, "title is required").max(200),
  description: z.string().max(20_000).optional().default(""),
});
export type CreateIssueRequestInput = z.infer<typeof CreateIssueRequestSchema>;

export const UpdateIssueRequestSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(20_000).optional(),
    status: IssueStatusSchema.optional(),
    agent_id: z.string().min(1).optional(),
  })
  .refine(
    (v) =>
      v.title !== undefined ||
      v.description !== undefined ||
      v.status !== undefined ||
      v.agent_id !== undefined,
    { message: "at least one field is required" }
  );
export type UpdateIssueRequestInput = z.infer<typeof UpdateIssueRequestSchema>;

export const ClaimIssueRequestSchema = z.object({
  agent_id: z.string().min(1, "agent_id is required"),
});
export type ClaimIssueRequestInput = z.infer<typeof ClaimIssueRequestSchema>;

export const HandBackIssueRequestSchema = z.object({
  agent_id: z.string().min(1).optional(),
});
export type HandBackIssueRequestInput = z.infer<typeof HandBackIssueRequestSchema>;

export const CreateIssueCommentBodySchema = z.object({
  content: z.string().min(1, "content is required").max(20_000),
});
export type CreateIssueCommentBody = z.infer<typeof CreateIssueCommentBodySchema>;

/**  Use CreateIssueCommentBodySchema instead */
export const CreateIssueCommentRequestSchema = CreateIssueCommentBodySchema;
export type CreateIssueCommentRequestInput = CreateIssueCommentBody;

export const IssueCommentApiSchema = z.object({
  id: z.string(),
  issue_id: z.string(),
  workspace_id: z.string(),
  author_type: z.enum(["user", "agent"]),
  author_id: z.string(),
  content: z.string(),
  created_at: z.string(),
});
export type IssueCommentApi = z.infer<typeof IssueCommentApiSchema>;

export const IssueApiSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  agent_id: z.string().nullable(),
  creator_user_id: z.string(),
  conversation_id: z.string().nullable(),
  latest_task_id: z.string().nullable(),
  claimed_by_agent_id: z.string().nullable().optional(),
  claimed_at: z.string().nullable().optional(),
  title: z.string(),
  description: z.string(),
  status: IssueStatusSchema,
  created_at: z.string(),
  updated_at: z.string(),
  completed_at: z.string().nullable(),
});
export type IssueApi = z.infer<typeof IssueApiSchema>;

// ---------------------------------------------------------------------------
// Agent link schemas
// ---------------------------------------------------------------------------

export const CreateAgentLinkRequestSchema = z.object({
  source_agent_id: z.string().min(1, "source_agent_id is required"),
  target_agent_id: z.string().min(1, "target_agent_id is required"),
  instruction: z.string().optional().default(""),
});
export type CreateAgentLinkRequestInput = z.infer<typeof CreateAgentLinkRequestSchema>;

export const UpdateAgentLinkRequestSchema = z.object({
  instruction: z.string(),
});
export type UpdateAgentLinkRequestInput = z.infer<typeof UpdateAgentLinkRequestSchema>;

export const UpsertAgentLinkRequestSchema = z.object({
  target_agent_id: z.string().min(1, "target_agent_id is required"),
  instruction: z.string(),
});
export type UpsertAgentLinkRequestInput = z.infer<typeof UpsertAgentLinkRequestSchema>;

// ---------------------------------------------------------------------------
// Whitelist request schema
// ---------------------------------------------------------------------------

export const AddWhitelistRequestSchema = z.object({
  email: z.string().email(),
});
export type AddWhitelistRequest = z.infer<typeof AddWhitelistRequestSchema>;

// ---------------------------------------------------------------------------
// Agent request schemas
// ---------------------------------------------------------------------------

const HeadroomRuntimeConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    mode: z.literal("proxy").optional(),
    requireOptimization: z.boolean().optional(),
    outputShaper: z.boolean().optional(),
    memory: z.boolean().optional(),
    ccr: z.boolean().optional(),
    port: z.number().int().min(1024).max(65535).optional(),
  })
  .passthrough();

const RuntimeConfigSchema = z
  .object({
    model: z.string().max(100).optional(),
    headroom: HeadroomRuntimeConfigSchema.optional(),
  })
  .passthrough()
  .optional();

export const CreateAgentRequestSchema = z.object({
  name: z.string().min(1, "name is required"),
  description: z.string().optional().default(""),
  instructions: z.string().optional().default(""),
  role_title: z.string().max(120).optional().default(""),
  responsibility: z.string().max(2000).optional().default(""),
  runtime_id: z.string().min(1, "runtime_id is required"),
  runtime_config: RuntimeConfigSchema,
  max_concurrent_tasks: z.number().int().optional(),
  email_handle: z.string().optional(),
  avatar_url: z.string().max(2000).nullable().optional(),
});
export type CreateAgentRequest = z.infer<typeof CreateAgentRequestSchema>;

export const UpdateAgentRequestSchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    instructions: z.string().optional(),
    role_title: z.string().max(120).optional(),
    responsibility: z.string().max(2000).optional(),
    runtime_id: z.string().min(1).optional(),
    runtime_config: RuntimeConfigSchema,
    visibility: z.enum(["public", "private"]).optional(),
    avatar_url: z.string().max(2000).nullable().optional(),
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.description !== undefined ||
      v.instructions !== undefined ||
      v.role_title !== undefined ||
      v.responsibility !== undefined ||
      v.runtime_id !== undefined ||
      v.runtime_config !== undefined ||
      v.visibility !== undefined ||
      v.avatar_url !== undefined,
    { message: "at least one field is required" },
  );
export type UpdateAgentRequest = z.infer<typeof UpdateAgentRequestSchema>;

// ---------------------------------------------------------------------------
// Automation / memory / approval / integration schemas (Helio parity)
// ---------------------------------------------------------------------------

export const AutomationDeliveryModeSchema = z.enum([
  "channel",
  "dm",
  "email_draft",
  "issue",
]);

export const CreateAutomationRequestSchema = z.object({
  agent_id: z.string().min(1, "agent_id is required"),
  title: z.string().min(1).max(200),
  sop_markdown: z.string().max(50_000).optional().default(""),
  schedule: z.string().min(1).max(200),
  next_run_at: z.string().min(1),
  delivery_mode: AutomationDeliveryModeSchema.optional().default("channel"),
  delivery_channel_id: z.string().min(1).nullable().optional(),
  skill_name: z.string().max(200).nullable().optional(),
  enabled: z.boolean().optional().default(true),
});
export type CreateAutomationRequestInput = z.infer<typeof CreateAutomationRequestSchema>;

export const UpdateAutomationRequestSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    sop_markdown: z.string().max(50_000).optional(),
    schedule: z.string().min(1).max(200).optional(),
    next_run_at: z.string().min(1).optional(),
    delivery_mode: AutomationDeliveryModeSchema.optional(),
    delivery_channel_id: z.string().min(1).nullable().optional(),
    skill_name: z.string().max(200).nullable().optional(),
    enabled: z.boolean().optional(),
  })
  .refine(
    (v) =>
      v.title !== undefined ||
      v.sop_markdown !== undefined ||
      v.schedule !== undefined ||
      v.next_run_at !== undefined ||
      v.delivery_mode !== undefined ||
      v.delivery_channel_id !== undefined ||
      v.skill_name !== undefined ||
      v.enabled !== undefined,
    { message: "at least one field is required" }
  );
export type UpdateAutomationRequestInput = z.infer<typeof UpdateAutomationRequestSchema>;

export const MemoryKindSchema = z.enum(["preference", "decision", "fact", "role"]);

export const CreateMemoryRequestSchema = z.object({
  agent_id: z.string().min(1).nullable().optional(),
  kind: MemoryKindSchema,
  content: z.string().min(1).max(10_000),
  source_task_id: z.string().min(1).nullable().optional(),
});
export type CreateMemoryRequestInput = z.infer<typeof CreateMemoryRequestSchema>;

export const UpdateMemoryRequestSchema = z
  .object({
    kind: MemoryKindSchema.optional(),
    content: z.string().min(1).max(10_000).optional(),
  })
  .refine((v) => v.kind !== undefined || v.content !== undefined, {
    message: "at least one field is required",
  });
export type UpdateMemoryRequestInput = z.infer<typeof UpdateMemoryRequestSchema>;

/** Stateless memory compaction job request (writes one summary note to D1). */
export const CompactMemoryRequestSchema = z.object({
  /**
   * Compact only this agent's notes.
   * Null/omitted = shared workspace notes only (`agent_id IS NULL`), not every agent.
   */
  agent_id: z.string().min(1).nullable().optional(),
  /** Skip compaction when fewer than this many non-summary notes exist (default 2). */
  min_notes: z.number().int().min(1).max(500).optional(),
  /** Cap distinct notes included in the summary after dedupe. */
  max_notes: z.number().int().min(1).max(500).optional(),
  /** Cap summary character length (default 10000). */
  max_length: z.number().int().min(0).max(50_000).optional(),
  /** When true, compute summary without writing or deleting rows. */
  dry_run: z.boolean().optional(),
});
export type CompactMemoryRequestInput = z.infer<typeof CompactMemoryRequestSchema>;

export const DecideApprovalRequestSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
});
export type DecideApprovalRequestInput = z.infer<typeof DecideApprovalRequestSchema>;

/** Propose a skill install from a successful (completed) task trace. */
export const ProposeSkillFromTaskRequestSchema = z.object({
  task_id: z.string().min(1),
  agent_id: z.string().min(1).optional(),
  runtime: z.enum(["claude", "codex", "opencode", "grok"]).optional(),
});
export type ProposeSkillFromTaskRequestInput = z.infer<
  typeof ProposeSkillFromTaskRequestSchema
>;

export const CreateIntegrationRequestSchema = z.object({
  provider: z.string().min(1).max(80),
  status: z.enum(["active", "disabled", "error"]).optional().default("active"),
  config: z.unknown().optional(),
  secret_ref: z.string().max(500).nullable().optional(),
});
export type CreateIntegrationRequestInput = z.infer<typeof CreateIntegrationRequestSchema>;

/** Chat gateway binding (provider team → workspace agent). Commercial control-plane. */
export const GatewayProviderSchema = z.enum([
  "slack",
  "discord",
  "telegram",
  "lark",
  "teams",
]);
export const CreateGatewayBindingRequestSchema = z.object({
  provider: GatewayProviderSchema,
  external_team_id: z.string().min(1).max(200),
  external_account_id: z.string().min(1).max(200).nullable().optional(),
  agent_id: z.string().min(1),
  user_id: z.string().min(1).optional(),
  status: z.enum(["active", "disabled"]).optional().default("active"),
  dm_policy: z.enum(["open", "allowlist", "pairing"]).optional().default("open"),
  outbound_mode: z.enum(["live", "preview"]).optional().default("preview"),
});
export type CreateGatewayBindingRequestInput = z.infer<
  typeof CreateGatewayBindingRequestSchema
>;

export const UpdateGatewayBindingRequestSchema = z
  .object({
    status: z.enum(["active", "disabled"]).optional(),
    dm_policy: z.enum(["open", "allowlist", "pairing"]).optional(),
    outbound_mode: z.enum(["live", "preview"]).optional(),
    agent_id: z.string().min(1).optional(),
    user_id: z.string().min(1).optional(),
  })
  .refine(
    (v) =>
      v.status !== undefined ||
      v.dm_policy !== undefined ||
      v.outbound_mode !== undefined ||
      v.agent_id !== undefined ||
      v.user_id !== undefined,
    { message: "at least one field is required" },
  );
export type UpdateGatewayBindingRequestInput = z.infer<
  typeof UpdateGatewayBindingRequestSchema
>;

export const GatewayPeerAllowlistRequestSchema = z.object({
  peer_id: z.string().min(1).max(200),
  status: z.enum(["allow", "deny", "paired"]).optional().default("allow"),
});
export type GatewayPeerAllowlistRequestInput = z.infer<
  typeof GatewayPeerAllowlistRequestSchema
>;

export const ChannelMemberRequestSchema = z.object({
  member_type: z.enum(["user", "agent"]),
  member_id: z.string().min(1),
});
export type ChannelMemberRequestInput = z.infer<typeof ChannelMemberRequestSchema>;

/** Same shape as channel members — conversation multi-party DM membership. */
export const ConversationMemberRequestSchema = ChannelMemberRequestSchema;
export type ConversationMemberRequestInput = ChannelMemberRequestInput;

// ---------------------------------------------------------------------------
// Conversation request schemas
// ---------------------------------------------------------------------------

export const CreateConversationRequestSchema = z.object({
  agent_id: z.string().min(1, "agent_id is required"),
  channel: z.string().optional(),
});
export type CreateConversationRequest = z.infer<
  typeof CreateConversationRequestSchema
>;

// ---------------------------------------------------------------------------
// Message request schema (JSON body only — FormData path is separate)
// ---------------------------------------------------------------------------

export const CreateMessageRequestSchema = z.object({
  content: z.string().min(1, "content is required"),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type CreateMessageRequest = z.infer<typeof CreateMessageRequestSchema>;

// Agent-authored DM: the agent's own `role:"assistant"` reply, posted via the
// machine-token chhlat route (`phneakngar sync send-dm`). Unlike CreateMessageRequest
// (a user send) this does NOT enqueue a task — it only delivers the message.
export const AgentDmRequestSchema = z.object({
  content: z.string().min(1, "content is required"),
  task_id: z.string().min(1).optional(),
});
export type AgentDmRequest = z.infer<typeof AgentDmRequestSchema>;

// ---------------------------------------------------------------------------
// Email request schemas
// ---------------------------------------------------------------------------

export const EmailAttachmentSchema = z.object({
  key: z.string().min(1),
  filename: z.string().min(1),
  size: z.number().int().nonnegative().optional(),
  contentType: z.string().min(1),
});

export const SendEmailRequestSchema = z.object({
  agentId: z.string().min(1, "agentId is required"),
  to: z.string().min(1, "to is required"),
  subject: z.string().min(1, "subject is required"),
  htmlBody: z.string().default(""),
  inReplyTo: z.string().optional(),
  references: z.string().optional(),
  attachments: z.array(EmailAttachmentSchema).optional(),
  customAccountId: z.string().optional(),
  from: z.string().email().optional(),
  conversationId: z.string().optional(),
  traceId: z.string().optional(),
  sourceTaskId: z.string().optional(),
  /** Client-stable key for at-most-once outbound delivery. Prefer also sending Idempotency-Key. */
  idempotencyKey: z.string().min(1).max(128).optional(),
  /**
   * When true, durable-claim as pending_approval and create an approval row instead of sending.
   * Existing happy-path sends (flag absent/false) are unchanged.
   */
  requiresApproval: z.boolean().optional().default(false),
});
export type SendEmailRequest = z.infer<typeof SendEmailRequestSchema>;

/** Mailbox UX only. Outbound delivery/approval transitions use dedicated paths. */
export const UpdateEmailStatusRequestSchema = z.object({
  status: z.enum([
    "unread",
    "read",
    "archived",
  ]),
});
export type UpdateEmailStatusRequest = z.infer<
  typeof UpdateEmailStatusRequestSchema
>;

export const MeetingInfoSchema = z.object({
  title: z.string(),
  meetingUrl: z.string(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  attendees: z.array(z.object({ name: z.string(), email: z.string() })),
});

export const EmailNotifyRequestSchema = z.object({
  agentId: z.string().min(1),
  workspaceId: z.string().min(1),
  r2Key: z.string().min(1),
  from: z.string().min(1),
  to: z.string().optional(),
  subject: z.string(),
  isWhitelisted: z.boolean(),
  forwarded: z.boolean().optional().default(false),
  messageId: z.string().optional().default(""),
  deliveryKey: z.string().min(1).max(255).optional(),
  inReplyTo: z.string().optional().default(""),
  references: z.string().optional().default(""),
  meetingInfo: MeetingInfoSchema.nullable().optional(),
  attachments: z.string().optional(),
  traceId: z.string().optional(),
  sourceTaskId: z.string().optional(),
  isInternal: z.boolean().optional().default(false),
  senderConversationId: z.string().optional(),
  senderAgentId: z.string().optional(),
});
export type EmailNotifyRequest = z.infer<typeof EmailNotifyRequestSchema>;

// ---------------------------------------------------------------------------
// Custom Email Account schemas
// ---------------------------------------------------------------------------

const EmailHostSchema = (label: string) => z.string()
  .trim()
  .min(1, `${label} host is required`)
  .refine(isPublicNetworkHost, `${label} host must be a public hostname`);

export const CreateEmailAccountSchema = z.object({
  emailAddress: z.string().email("valid email required"),
  displayName: z.string().default(""),
  imapHost: EmailHostSchema("IMAP"),
  imapPort: z.number().int().min(1).max(65535).default(993),
  imapUsername: z.string().min(1, "IMAP username is required"),
  imapPassword: z.string().min(1, "IMAP password is required"),
  imapTls: z.boolean().default(true),
  smtpHost: EmailHostSchema("SMTP"),
  smtpPort: z.number().int().min(1).max(65535).default(587),
  smtpUsername: z.string().min(1, "SMTP username is required"),
  smtpPassword: z.string().min(1, "SMTP password is required"),
  smtpTls: z.number().int().min(0).max(2).default(1),
  pollIntervalSeconds: z.number().int().min(30).max(3600).default(60),
});
export type CreateEmailAccountRequest = z.infer<typeof CreateEmailAccountSchema>;

export const UpdateEmailAccountSchema = z.object({
  emailAddress: z.string().email().optional(),
  displayName: z.string().optional(),
  imapHost: EmailHostSchema("IMAP").optional(),
  imapPort: z.number().int().min(1).max(65535).optional(),
  imapUsername: z.string().min(1).optional(),
  imapPassword: z.string().min(1).optional(),
  imapTls: z.boolean().optional(),
  smtpHost: EmailHostSchema("SMTP").optional(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  smtpUsername: z.string().min(1).optional(),
  smtpPassword: z.string().min(1).optional(),
  smtpTls: z.number().int().min(0).max(2).optional(),
  pollIntervalSeconds: z.number().int().min(30).max(3600).optional(),
});
export type UpdateEmailAccountRequest = z.infer<typeof UpdateEmailAccountSchema>;

export const TestEmailConnectionSchema = z.object({
  imapHost: EmailHostSchema("IMAP"),
  imapPort: z.number().int().min(1).max(65535).default(993),
  imapUsername: z.string().min(1),
  imapPassword: z.string().min(1),
  imapTls: z.boolean().default(true),
  smtpHost: EmailHostSchema("SMTP"),
  smtpPort: z.number().int().min(1).max(65535).default(587),
  smtpUsername: z.string().min(1),
  smtpPassword: z.string().min(1),
  smtpTls: z.number().int().min(0).max(2).default(1),
});
export type TestEmailConnectionRequest = z.infer<typeof TestEmailConnectionSchema>;

// ---------------------------------------------------------------------------
// Member request schemas
// ---------------------------------------------------------------------------

export const UpdateMemberRequestSchema = z.object({
  global_instruction: z.string().max(50000).trim().optional(),
  preferred_locale: PersistedLocaleSchema.optional(),
}).refine(
  (body) => body.global_instruction !== undefined || body.preferred_locale !== undefined,
  { message: "global_instruction or preferred_locale is required" },
);
export type UpdateMemberRequest = z.infer<typeof UpdateMemberRequestSchema>;

// ---------------------------------------------------------------------------
// Workspace request schemas
// ---------------------------------------------------------------------------

export const CreateWorkspaceRequestSchema = z.object({
  name: z.string().min(1, "name is required"),
  slug: z.string().optional().default(""),
});
export type CreateWorkspaceRequest = z.infer<
  typeof CreateWorkspaceRequestSchema
>;

export const UpdateWorkspaceRequestSchema = z.object({
  name: z.string().min(1, "name is required").max(100).trim().optional(),
  slug: z.string().min(1, "slug is required").max(100).trim().toLowerCase().optional(),
  default_locale: PersistedLocaleSchema.optional(),
});
export type UpdateWorkspaceRequest = z.infer<typeof UpdateWorkspaceRequestSchema>;

export const DeleteWorkspaceRequestSchema = z.object({
  confirm_name: z.string().min(1, "confirm_name is required"),
});
export type DeleteWorkspaceRequest = z.infer<typeof DeleteWorkspaceRequestSchema>;

export const GrantAgentAccessRequestSchema = z.object({
  user_id: z.string().min(1, "user_id is required"),
});
export type GrantAgentAccessRequest = z.infer<typeof GrantAgentAccessRequestSchema>;

// ---------------------------------------------------------------------------
// Workspace file browsing
// ---------------------------------------------------------------------------

export const WorkspaceFileBrowseRequestSchema = z.object({
  request_type: z.enum(["tree", "read"]),
  path: z.string().default("."),
});
export type WorkspaceFileBrowseRequest = z.infer<typeof WorkspaceFileBrowseRequestSchema>;

export const WorkspaceFileEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  isDirectory: z.boolean(),
  size: z.number(),
  modifiedAt: z.string(),
});
export type WorkspaceFileEntry = z.infer<typeof WorkspaceFileEntrySchema>;

export const WorkspaceFileReportSchema = z.object({
  request_id: z.string().min(1),
  entries: z.array(WorkspaceFileEntrySchema).optional(),
  content: z.string().nullable().optional(),
  isBinary: z.boolean().optional(),
  error: z.string().optional(),
  path: z.string(),
});
export type WorkspaceFileReport = z.infer<typeof WorkspaceFileReportSchema>;

// ---------------------------------------------------------------------------
// Workspace skill browsing (V2 — D1 cache)
// ---------------------------------------------------------------------------

export const SkillEntrySchema = z.object({
  name: z.string(),
  description: z.string(),
  isGlobal: z.boolean().optional(),
});
export type SkillEntry = z.infer<typeof SkillEntrySchema>;

const SkillItemSchema = z.object({
  name: z.string(),
  description: z.string(),
});

export const SkillSyncRequestSchema = z.object({
  scope: z.enum(["global", "agent"]),
  agent_id: z.string().min(1).optional(),
  chhlat_id: z.string().min(1).optional(),
  runtime: z.enum(["claude", "codex", "opencode", "grok"]),
  skills: z.array(SkillItemSchema),
});
export type SkillSyncRequest = z.infer<typeof SkillSyncRequestSchema>;

// ---------------------------------------------------------------------------
// Studio onboarding
// ---------------------------------------------------------------------------

export const StudioMemberSchema = z.object({
  name: z.string().optional(),
  role: z.enum(["leader", "researcher", "engineer", "assistant"]),
  runtime_id: z.string().min(1, "runtime_id is required"),
  runtime_config: z.object({ model: z.string().max(100).optional() }).passthrough().optional(),
  description: z.string().optional().default(""),
  instructions: z.string().optional().default(""),
  avatar_url: z.string().max(2000).nullable().optional(),
  email_handle: z.string().max(30).optional(),
  relationship: z.string().optional(),
});

export const CreateStudioRequestSchema = z.object({
  name: z.string().max(100).optional(),
  scenario: z.string().max(50).optional(),
  members: z.array(StudioMemberSchema).min(1).max(4),
}).refine(
  (v) => v.members.some((m) => m.role === "leader"),
  { message: "at least one member must have the leader role" },
);
export type CreateStudioRequest = z.infer<typeof CreateStudioRequestSchema>;

// ---------------------------------------------------------------------------
// Agent recruit schema
// ---------------------------------------------------------------------------

export const RecruitAgentRequestSchema = z.object({
  instructions: z.string().min(1, "instructions is required"),
  relationship: z.string().min(1, "relationship is required"),
  name: z.string().optional(),
  description: z.string().optional().default(""),
  model: z.string().max(100).optional(),
  context_key: z.string().optional(),
});
export type RecruitAgentRequest = z.infer<typeof RecruitAgentRequestSchema>;

export const CreateThreadRequestSchema = z.object({
  parent_message_id: z.string().min(1),
  content: z.string().optional().default(""),
  attachment_ids: z.array(z.string()).optional(),
});
export type CreateThreadRequest = z.infer<typeof CreateThreadRequestSchema>;
