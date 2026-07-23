/** Convert a validated TaskApi (snake_case wire format) to the internal Task type. */
export function fromApiTask(api) {
    return {
        id: api.id,
        agentId: api.agent_id,
        runtimeId: api.runtime_id,
        conversationId: api.conversation_id,
        workspaceId: api.workspace_id,
        prompt: api.prompt,
        status: api.status,
        priority: api.priority,
        type: api.type,
        contextKey: api.context_key ?? null,
        context: api.context ?? undefined,
        localeOverride: api.locale_override ?? null,
        languagePolicy: api.language_policy ?? undefined,
        agent: api.agent
            ? {
                name: api.agent.name,
                instructions: api.agent.instructions,
                emailHandle: api.agent.email_handle ?? undefined,
                emailAddress: api.agent.email_address ?? undefined,
                emailAddresses: api.agent.email_addresses ?? [],
                userEmail: api.agent.user_email ?? undefined,
                userName: api.agent.user_name ?? undefined,
                runtimeConfig: api.agent.runtime_config ?? undefined,
                preferredLocale: api.agent.preferred_locale ?? undefined,
                languagePolicy: api.agent.language_policy ?? undefined,
                colleagues: api.agent.colleagues?.map((c) => ({
                    name: c.name,
                    email: c.email,
                    description: c.description,
                    instruction: c.instruction,
                })) ?? [],
            }
            : undefined,
        sender: api.sender
            ? { name: api.sender.name, email: api.sender.email, isOwner: api.sender.is_owner }
            : undefined,
        repos: undefined,
        createdAt: api.created_at,
        traceId: api.trace_id ?? null,
        parentTaskId: api.parent_task_id ?? null,
        channel: api.channel ?? null,
    };
}
