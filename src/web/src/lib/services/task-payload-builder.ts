import type { Database, ClaimedTaskRow } from "@phneakngar/shared";
import {
  buildAgentPromptLanguagePolicy,
  queries,
  resolveAgentLanguageMode,
  TASK_TYPES,
  toPhneakngarAddress,
} from "@phneakngar/shared";
import { taskToResponse } from "@/lib/api/responses";
import { cached, cacheKeys } from "@/lib/cache";

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export class TaskPayloadBuilder {
  constructor(private db: Database, private emailDomain: string) {}

  async buildFullPayloads(tasks: ClaimedTaskRow[], workspaceId: string) {
    const nonKillTasks = tasks.filter((t) => t.type !== TASK_TYPES.KILL_TASK);
    const agentIds = [...new Set(nonKillTasks.map((t) => t.agentId))];

    const [allAgents, allEmailAccounts, allColleagues] = agentIds.length > 0
        ? await Promise.all([
          queries.agent.getAgentsByIds(this.db, agentIds, workspaceId),
          queries.emailAccount.getEmailAccountsByAgents(this.db, agentIds, workspaceId),
          queries.agentLink.getColleaguesForAgents(this.db, agentIds, workspaceId).catch(() => [] as Awaited<ReturnType<typeof queries.agentLink.getColleaguesForAgents>>),
        ])
      : [[], [], [] as Awaited<ReturnType<typeof queries.agentLink.getAllColleaguesForWorkspace>>];

    const agentMap = new Map(allAgents.map((a) => [a.id, a]));
    const emailAccountsByAgent = new Map<string, string[]>();
    for (const acc of allEmailAccounts) {
      const list = emailAccountsByAgent.get(acc.agentId) ?? [];
      list.push(acc.emailAddress);
      emailAccountsByAgent.set(acc.agentId, list);
    }
    const colleaguesByAgent = new Map<string, typeof allColleagues>();
    for (const c of allColleagues) {
      const list = colleaguesByAgent.get(c.agentId) ?? [];
      list.push(c);
      colleaguesByAgent.set(c.agentId, list);
    }

    const convoIds = [...new Set(nonKillTasks.map((t) => t.conversationId).filter(Boolean))];
    const convos = convoIds.length > 0
      ? await queries.conversation.getConversationsByIds(this.db, convoIds, workspaceId)
      : [];
    const convoMap = new Map(convos.map((c) => [c.id, c]));

    // Workspace default locale applies to agent output when no task/agent/owner
    // locale is set. Fetched once per build (cached) and threaded into every
    // task's language policy below. The workspace agent language mode
    // (auto | bilingual | en | km) sits above the UI default locale in the
    // precedence chain, so a configured agent response language actually wins
    // over the interface-language fallback.
    const [workspaceDefaultLocale, workspaceAgentLanguageMode] = await Promise.all([
      cached(
        cacheKeys.workspaceDefaultLocale(workspaceId),
        600,
        () => queries.workspace.getWorkspaceDefaultLocale(this.db, workspaceId),
      ),
      cached(
        cacheKeys.workspaceAgentLanguageMode(workspaceId),
        600,
        () => queries.workspace.getWorkspaceAgentLanguageMode(this.db, workspaceId),
      ),
    ]);

    const memberCache = new Map<string, { globalInstruction: string; preferredLocale: string | null } | null>();
    const userCache = new Map<string, { name: string; email: string } | null>();

    const results = [];
    for (const task of tasks) {
      if (task.type === TASK_TYPES.KILL_TASK) {
        results.push({ ...taskToResponse(task), agent: null, sender: null });
        continue;
      }

      const agent = agentMap.get(task.agentId) ?? null;
      const taskContext = task.context as Record<string, unknown> | null | undefined;
      const emailAddresses: string[] = [];
      if (agent) {
        if (agent.emailHandle) emailAddresses.push(toPhneakngarAddress(agent.emailHandle, this.emailDomain));
        const customAccounts = emailAccountsByAgent.get(agent.id) ?? [];
        emailAddresses.push(...customAccounts);
      }

      let instructions = agent?.instructions ?? "";
      if (agent?.ownerId) {
        if (!memberCache.has(agent.ownerId)) {
          const m = await cached(
            cacheKeys.member(workspaceId, agent.ownerId),
            600,
            () => queries.member.getMemberByUserAndWorkspace(this.db, agent.ownerId!, workspaceId),
          );
          memberCache.set(agent.ownerId, m ? {
            globalInstruction: m.globalInstruction,
            preferredLocale: m.preferredLocale ?? null,
          } : null);
        }
        const cachedMember = memberCache.get(agent.ownerId);
        if (cachedMember?.globalInstruction) {
          instructions = [cachedMember.globalInstruction, instructions].filter(Boolean).join("\n\n");
        }
      }

      let ownerName: string | null = null;
      if (agent?.ownerId) {
        if (!userCache.has(agent.ownerId)) {
          const u = await cached(
            cacheKeys.user(agent.ownerId),
            1800,
            () => queries.user.getUser(this.db, agent.ownerId!),
          );
          userCache.set(agent.ownerId, u ? { name: u.name, email: u.email } : null);
        }
        ownerName = userCache.get(agent.ownerId)?.name ?? null;
      }

      const convo = convoMap.get(task.conversationId) ?? null;
      const taskChannel = convo?.channel ?? "default";

      let sender: { name: string; email: string; is_owner: boolean } | null = null;
      if (task.type === TASK_TYPES.USER_DM_MESSAGE && convo?.userId) {
        if (!userCache.has(convo.userId)) {
          const u = await cached(
            cacheKeys.user(convo.userId),
            1800,
            () => queries.user.getUser(this.db, convo!.userId!),
          );
          userCache.set(convo.userId, u ? { name: u.name, email: u.email } : null);
        }
        const cachedUser = userCache.get(convo.userId);
        if (cachedUser) {
          sender = {
            name: cachedUser.name,
            email: cachedUser.email,
            is_owner: convo.userId === agent?.ownerId,
          };
        }
      }

      const ownerPreferredLocale = agent?.ownerId
        ? memberCache.get(agent.ownerId)?.preferredLocale ?? null
        : null;
      // Precedence: task override > agent locale > owner locale > workspace agent
      // language mode > workspace default locale. Owner locale is folded into
      // agentPreferredLocale (as before); the workspace agent language mode is the
      // preferred agent-output fallback, and the UI default locale is the final
      // fallback so a configured default actually applies instead of dropping to
      // the hardcoded km default.
      const agentPreferredLocale = stringOrNull(agent?.preferredLocale) ?? stringOrNull(ownerPreferredLocale);
      const languagePolicy = buildAgentPromptLanguagePolicy({
        taskLocaleOverride: stringOrNull(task.localeOverride) ?? stringOrNull(taskContext?.taskLocaleOverride),
        agentPreferredLocale,
        workspaceAgentOutputLocale: stringOrNull(workspaceAgentLanguageMode),
        workspaceDefaultLocale: stringOrNull(workspaceDefaultLocale),
        agentLanguagePolicy: stringOrNull(agent?.languagePolicy),
      });
      // Resolved locale advertised to the runtime: agent/owner > workspace agent
      // language mode > workspace default.
      const resolvedPreferredLocale =
        agentPreferredLocale ??
        stringOrNull(workspaceAgentLanguageMode) ??
        stringOrNull(workspaceDefaultLocale);

      const rawColleagues = colleaguesByAgent.get(task.agentId) ?? [];
      const colleagues = rawColleagues.map((c) => ({
        name: c.name,
        email: c.emailHandle ? toPhneakngarAddress(c.emailHandle, this.emailDomain) : "",
        description: c.description,
        instruction: c.instruction,
      }));

      results.push({
        ...taskToResponse(task),
        channel: taskChannel,
        sender,
        language_policy: languagePolicy,
        agent: agent
          ? {
              instructions,
              name: agent.name,
              runtime_config: (agent.runtimeConfig || {}) as Record<string, unknown>,
              email_handle: agent.emailHandle || null,
              email_address: agent.emailHandle ? toPhneakngarAddress(agent.emailHandle, this.emailDomain) : null,
              email_addresses: emailAddresses,
              user_email: null as string | null,
              user_name: ownerName,
              preferred_locale: resolvedPreferredLocale ? resolveAgentLanguageMode(resolvedPreferredLocale) : null,
              language_policy: agent.languagePolicy || null,
              colleagues,
            }
          : null,
      });
    }

    return results;
  }
}
