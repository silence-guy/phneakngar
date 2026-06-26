export interface ContextEnvVars {
  conversationId?: string;
  traceId?: string;
  sourceTaskId?: string;
}

export function gatherContextEnvVars(): ContextEnvVars {
  const conversationId = process.env.PHNEAKNGAR_CONVERSATION_ID || undefined;
  const traceId = process.env.PHNEAKNGAR_TRACE_ID || undefined;
  const sourceTaskId = process.env.PHNEAKNGAR_TASK_ID || undefined;
  return { conversationId, traceId, sourceTaskId };
}
