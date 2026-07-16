import {
  buildAgentPromptLanguagePolicy,
  buildJudgmentPolicyNotice,
  formatMemoryForPrompt,
  readJudgmentPolicy,
  resolveAmbiguousDmJudgment,
  type AgentPromptLanguagePolicy,
  type MemoryPromptItem,
} from "@phneakngar/shared";
import type { Task, Attachment } from "./types.js";
import { localISOString } from "./execenv/timeline.js";

const DM_RESPONSE_NOTICE =
  "Reply with `phneakngar sync send-dm` — that's the only thing the user sees; your task output and reasoning are not shown." +
  " Talk to them at milestones like a colleague would, and don't end your turn without sending what they need." +
  " If this task will take more than 30 seconds, send a quick ack first so the user knows you're on it." +
  " IMPORTANT: If you were working on a previous task before this message arrived, do NOT silently drop it. After handling this message, return to any prior unfinished work and report the result to the user.";

const EMAIL_NOTICE =
  "This task was triggered by an incoming email. Reply to the sender via email — use the email sending tool to respond." +
  " If you need more information or confirmation, email them and then exit." +
  " Do not wait — when they reply, a new task will be triggered automatically and you will be woken up with their response." +
  " IMPORTANT: Do not let this email interrupt any task you were previously working on. After handling this email, return to your original task and make sure it reaches completion.";

const CALENDAR_NOTICE =
  "This task was triggered by a scheduled calendar event." +
  " If you need to communicate with someone, send an email using the email sending tool." +
  " If you need more information or confirmation, email them and then exit." +
  " Do not wait — when they reply, a new task will be triggered automatically and you will be woken up with their response.";

const ISSUE_NOTICE =
  "This task was triggered by an assigned issue. The issue_id is provided in this message." +
  " Use `phneakngar issue show --issue_id <issue_id>` to read full context." +
  " Use `phneakngar issue update --issue_id <issue_id> --status <status>` to change status." +
  " Use `phneakngar issue comment --issue_id <issue_id> --body <text>` to leave a comment." +
  " CRITICAL — You MUST manage the issue status correctly. This is NOT optional:" +
  " 1. Set status to 'in_progress' when you start working." +
  " 2. If you complete the work yourself: leave a summary comment, then set status to 'review' as your last action. 'review' means there is actual completed work (code, artifact, result) ready for the owner to look at." +
  " 3. If you delegated work to colleagues and are waiting for their response: KEEP status as 'in_progress' and exit. This is expected — you will be woken up when they reply. Set 'review' only after all delegated work is confirmed complete." +
  " 4. NEVER set 'review' unless there is concrete completed work for the owner to review. Sending a plan to a colleague is NOT completed work." +
  " NEVER exit without doing at least one of: updating the status, or leaving a comment explaining what you did and what you're waiting for.";

function languagePolicyFor(task: Task): AgentPromptLanguagePolicy {
  return task.languagePolicy ?? buildAgentPromptLanguagePolicy({ taskLocaleOverride: task.localeOverride });
}

function mergedLanguagePolicyFor(tasks: Task[]): AgentPromptLanguagePolicy {
  const policies = tasks.map(languagePolicyFor);
  const [first] = policies;
  if (first && policies.every((policy) => JSON.stringify(policy) === JSON.stringify(first))) {
    return first;
  }
  return buildAgentPromptLanguagePolicy({ taskLocaleOverride: "auto" });
}

function buildEmailDmNotice(name: string, email: string): string {
  return (
    `This task was triggered by an incoming email on a conversation with ${name} (${email}).` +
    ` ${name} is present in this session — reply to them directly.` +
    ` If you need to communicate with anyone else, use the email sending tool.` +
    ` IMPORTANT: Do not let this email interrupt any task you were previously working on. After handling this email, return to your original task and make sure it reaches completion — report the result to the user.`
  );
}

export function buildTaskObject(task: Task, attachments?: Attachment[]): Record<string, unknown> {
  const createdAt = new Date(task.createdAt);
  const receivedAt = Number.isNaN(createdAt.getTime())
    ? localISOString()
    : localISOString(createdAt);
  const obj: Record<string, unknown> = {
    type: task.type,
    received_at: receivedAt,
    instruction: task.prompt,
    language_policy: languagePolicyFor(task),
  };
  if (task.type === "user_dm_message") {
    obj.notice = DM_RESPONSE_NOTICE;
    const ctx = task.context as Record<string, unknown> | undefined;
    if (ctx?.message_id) {
      obj.message_id = ctx.message_id;
    }
    if (ctx?.quoted_message) {
      obj.quoted_message = ctx.quoted_message;
    }
    if (ctx?.conversation_history || ctx?.root_message) {
      obj.thread_context = {
        note: "The user started this thread by replying to the root_message below. The history is the conversation leading up to it.",
        ...(ctx.root_message ? { root_message: ctx.root_message } : {}),
        ...(ctx.conversation_history ? { history: ctx.conversation_history } : {}),
      };
    }

    // D6: judgment policy (ambiguous → create issue) from agent runtime_config.
    const judgment = readJudgmentPolicy(task.agent?.runtimeConfig);
    const judgmentNotice = buildJudgmentPolicyNotice(judgment);
    if (judgmentNotice) {
      const decision = resolveAmbiguousDmJudgment({
        policy: judgment,
        prompt: task.prompt,
        agentId: task.agentId,
        senderName: task.sender?.name ?? null,
        conversationId: task.conversationId,
      });
      obj.judgment_policy = {
        ambiguous_to_issue: true,
        guidance: judgmentNotice,
        recommended_action: decision.action,
        reason: decision.reason,
        ...(decision.action === "create_issue"
          ? {
              issue_draft: decision.issue,
            }
          : {}),
      };
      // Append guidance so the model sees it even if it only reads notice.
      obj.notice = `${DM_RESPONSE_NOTICE} ${judgmentNotice}`;
    }
  }
  if (task.type === "email_notification") {
    const ctx = task.context as Record<string, unknown> | undefined;
    const dmUser = ctx?.dmUser as { name: string; email: string } | undefined;
    if (ctx?.conversationType === "user_dm_message" && dmUser) {
      obj.notice = buildEmailDmNotice(dmUser.name, dmUser.email);
    } else {
      obj.notice = EMAIL_NOTICE;
    }
    if (ctx?.emailId != null) {
      obj.email_id = ctx.emailId;
    }
  }
  if (task.type === "calendar_event") {
    obj.notice = CALENDAR_NOTICE;
    const ctx = task.context as Record<string, unknown> | undefined;
    if (ctx?.event_id != null) {
      obj.event_id = ctx.event_id;
    }
    if (ctx?.datetime != null) {
      obj.datetime = ctx.datetime;
    }
    if (ctx?.is_recurring !== undefined) {
      obj.is_recurring = ctx.is_recurring;
    }
    if (ctx?.repeat_interval !== undefined) {
      obj.repeat_interval = ctx.repeat_interval;
    }
    if (ctx?.description) {
      obj.description = ctx.description;
    }
    if (ctx?.scheduled_by) {
      obj.scheduled_by = ctx.scheduled_by;
    }
  }
  if (task.type === "issue_event") {
    obj.notice = ISSUE_NOTICE;
    const ctx = task.context as Record<string, unknown> | undefined;
    if (ctx?.issue_id) {
      obj.issue_id = ctx.issue_id;
    }
  }
  if (task.type === "automation_event") {
    const ctx = task.context as Record<string, unknown> | undefined;
    if (ctx?.automation_id != null) {
      obj.automation_id = ctx.automation_id;
    }
    if (ctx?.delivery_mode != null) {
      obj.delivery_mode = ctx.delivery_mode;
    }
    if (ctx?.skill_name != null) {
      obj.skill_name = ctx.skill_name;
    }
  }
  // Memory snippets attached at web enqueue (issue_event / automation_event).
  const memoryCtx = task.context as Record<string, unknown> | undefined;
  if (memoryCtx) {
    if (typeof memoryCtx.memory_prompt === "string" && memoryCtx.memory_prompt.trim()) {
      obj.memory = memoryCtx.memory_prompt;
    } else if (Array.isArray(memoryCtx.memories) && memoryCtx.memories.length > 0) {
      const items = memoryCtx.memories as MemoryPromptItem[];
      const formatted = formatMemoryForPrompt(items);
      if (formatted) obj.memory = formatted;
    }
  }
  if (task.sender) {
    obj.sender = {
      name: task.sender.name,
      email: task.sender.email,
      is_owner: task.sender.isOwner,
    };
  }
  if (attachments && attachments.length > 0) {
    obj.attachments = attachments.map((a) => ({
      path: a.path,
      content_type: a.content_type,
      filename: a.filename,
    }));
  }
  return obj;
}

export function buildPrompt(task: Task, attachments?: Attachment[]): string {
  return JSON.stringify(buildTaskObject(task, attachments));
}

export function buildMergedPrompt(tasks: Task[], attachmentsMap: Map<string, Attachment[]>): string {
  const subTasks = tasks
    .map((t) => buildTaskObject(t, attachmentsMap.get(t.id)))
    .sort((a, b) => String(a.received_at).localeCompare(String(b.received_at)));
  return JSON.stringify({
    type: "merge_tasks",
    notice: "These messages arrived simultaneously. Process each one completely.",
    language_policy: mergedLanguagePolicyFor(tasks),
    tasks: subTasks,
  });
}
