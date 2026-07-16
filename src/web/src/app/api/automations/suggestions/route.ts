import { NextRequest } from "next/server";
import {
  DEFAULT_PATTERN_MIN_COUNT,
  detectAutomationPatterns,
  queries,
  TASK_TYPES,
} from "@phneakngar/shared";
import { getDb } from "@/lib/db";
import { withAuth } from "@/lib/middleware/auth";
import { withWorkspaceMember } from "@/lib/middleware/workspace";
import { writeJSON } from "@/lib/middleware/helpers";

function suggestionToResponse(s: {
  patternKey: string;
  agentId: string;
  count: number;
  samplePrompt: string;
  suggestedTitle: string;
  suggestedSopMarkdown: string;
  suggestedSchedule: string;
  taskIds: string[];
  latestCompletedAt: string | null;
}) {
  return {
    pattern_key: s.patternKey,
    agent_id: s.agentId,
    count: s.count,
    sample_prompt: s.samplePrompt,
    suggested_title: s.suggestedTitle,
    suggested_sop_markdown: s.suggestedSopMarkdown,
    suggested_schedule: s.suggestedSchedule,
    task_ids: s.taskIds,
    latest_completed_at: s.latestCompletedAt,
  };
}

/**
 * GET /api/automations/suggestions
 * Workspace-scoped pattern → automation suggestions from completed task history.
 * Query: agent_id?, min_count?, limit?
 */
export const GET = withAuth(async (req: NextRequest, ctx) => {
  const ws = await withWorkspaceMember(req, ctx);
  if (ws instanceof Response) return ws;

  const db = getDb(ctx.env.DB);
  const agentId = req.nextUrl.searchParams.get("agent_id") ?? undefined;
  const minCountParam = req.nextUrl.searchParams.get("min_count");
  const limitParam = req.nextUrl.searchParams.get("limit");
  const taskLimitParam = req.nextUrl.searchParams.get("task_limit");

  const parsedMin = minCountParam ? parseInt(minCountParam, 10) : NaN;
  const minCount = Number.isNaN(parsedMin)
    ? DEFAULT_PATTERN_MIN_COUNT
    : Math.min(Math.max(parsedMin, 2), 50);

  const parsedLimit = limitParam ? parseInt(limitParam, 10) : NaN;
  const limit = Number.isNaN(parsedLimit) ? 20 : Math.min(Math.max(parsedLimit, 1), 50);

  const parsedTaskLimit = taskLimitParam ? parseInt(taskLimitParam, 10) : NaN;
  const taskLimit = Number.isNaN(parsedTaskLimit)
    ? 200
    : Math.min(Math.max(parsedTaskLimit, 1), 500);

  const [tasks, automations] = await Promise.all([
    queries.task.listCompletedTasksForPatternAnalysis(db, ws.workspaceId, {
      agentId,
      limit: taskLimit,
    }),
    queries.automation.listAutomations(db, ws.workspaceId, { agentId }),
  ]);

  const suggestions = detectAutomationPatterns(tasks, {
    minCount,
    limit,
    existingAutomationTitles: automations.map((a) => a.title),
    excludeTypes: [TASK_TYPES.AUTOMATION_EVENT, TASK_TYPES.KILL_TASK],
  });

  return writeJSON({
    items: suggestions.map(suggestionToResponse),
    min_count: minCount,
  });
});
