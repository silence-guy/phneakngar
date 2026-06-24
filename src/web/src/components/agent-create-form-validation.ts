import { agentFormLabel } from "@/lib/locale";

export interface AgentCreateRequiredFields {
  name: string;
  runtimeId: string;
}

export interface AgentCreateFieldErrors {
  name?: string;
  runtimeId?: string;
}

export function validateAgentCreateRequiredFields(
  {
    name,
    runtimeId,
  }: AgentCreateRequiredFields,
  locale?: string | null,
): AgentCreateFieldErrors {
  const errors: AgentCreateFieldErrors = {};

  if (!name.trim()) {
    errors.name = agentFormLabel("nameRequired", locale);
  }

  if (!runtimeId) {
    errors.runtimeId = agentFormLabel("runtimeRequired", locale);
  }

  return errors;
}

export function hasAgentCreateFieldErrors(
  errors: AgentCreateFieldErrors,
): boolean {
  return Boolean(errors.name || errors.runtimeId);
}
