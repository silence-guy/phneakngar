import { z } from "zod";

export const PlaybookStepKind = {
  AGENT: "agent",
  APPROVAL: "approval",
  HUMAN_INPUT: "human_input",
} as const;

export type PlaybookStepKindType = (typeof PlaybookStepKind)[keyof typeof PlaybookStepKind];

export const PlaybookStatus = {
  DRAFT: "draft",
  PUBLISHED: "published",
} as const;

export type PlaybookStatusType = (typeof PlaybookStatus)[keyof typeof PlaybookStatus];

export const PlaybookRunStatus = {
  RUNNING: "running",
  AWAITING_APPROVAL: "awaiting_approval",
  AWAITING_INPUT: "awaiting_input",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export type PlaybookRunStatusType = (typeof PlaybookRunStatus)[keyof typeof PlaybookRunStatus];

export const TERMINAL_PLAYBOOK_RUN_STATUSES: readonly PlaybookRunStatusType[] = [
  PlaybookRunStatus.COMPLETED,
  PlaybookRunStatus.FAILED,
  PlaybookRunStatus.CANCELLED,
];

export function isTerminalPlaybookRunStatus(status: string): boolean {
  return (TERMINAL_PLAYBOOK_RUN_STATUSES as readonly string[]).includes(status);
}

export const PlaybookStepRunStatus = {
  PENDING: "pending",
  RUNNING: "running",
  AWAITING_APPROVAL: "awaiting_approval",
  AWAITING_INPUT: "awaiting_input",
  COMPLETED: "completed",
  FAILED: "failed",
  SKIPPED: "skipped",
} as const;

export type PlaybookStepRunStatusType =
  (typeof PlaybookStepRunStatus)[keyof typeof PlaybookStepRunStatus];

export const playbookStepSchema = z
  .object({
    id: z.string().min(1).max(64),
    kind: z.enum([PlaybookStepKind.AGENT, PlaybookStepKind.APPROVAL, PlaybookStepKind.HUMAN_INPUT]),
    title: z.string().min(1).max(200),
    prompt: z.string().max(20_000).optional(),
    approvalTitle: z.string().max(200).optional(),
    approvalSummary: z.string().max(2_000).optional(),
    question: z.string().max(2_000).optional(),
  })
  .strict();

export type PlaybookStepDef = z.infer<typeof playbookStepSchema>;

export const playbookDefinitionSchema = z
  .array(playbookStepSchema)
  .min(1, "A playbook needs at least one step")
  .max(50, "A playbook supports at most 50 steps")
  .superRefine((steps, ctx) => {
    const seen = new Set<string>();
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (seen.has(step.id)) {
        ctx.addIssue({
          code: "custom",
          path: [i, "id"],
          message: `Duplicate step id "${step.id}"`,
        });
      }
      seen.add(step.id);
      if (step.kind === PlaybookStepKind.AGENT && !step.prompt?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: [i, "prompt"],
          message: "Agent steps require a prompt",
        });
      }
    }
  });

export type PlaybookDefinition = z.infer<typeof playbookDefinitionSchema>;

export interface RenderContext {
  input?: Record<string, unknown> | null;
  steps?: Record<string, string> | null;
}

/**
 * Deterministic template substitution for agent-step prompts.
 * Supports {{input.<key>}} and {{steps.<stepId>.output}}. Unknown keys render
 * as empty strings; rendering never throws.
 */
export function renderPlaybookPrompt(template: string, ctx: RenderContext): string {
  return template.replace(/\{\{\s*(input|steps)\.([\w.-]+?)(?:\.output)?\s*\}\}/g, (raw, scope: string, key: string) => {
    if (scope === "input") {
      const value = ctx.input?.[key];
      return value == null ? "" : String(value);
    }
    const value = ctx.steps?.[key];
    return value == null ? "" : String(value);
  });
}
