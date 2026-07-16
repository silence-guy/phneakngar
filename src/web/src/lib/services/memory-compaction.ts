import {
  compactMemoryNotes,
  MEMORY_SUMMARY_KIND,
  queries,
  type Database,
  type CompactMemoryRequestInput,
} from "@phneakngar/shared";

const DEFAULT_MIN_NOTES = 2;
const DEFAULT_MAX_LENGTH = 10_000;
/** Read enough rows for one compaction pass without unbounded scans. */
const LIST_LIMIT = 500;

export type CompactAgentMemoryResult = {
  compacted: boolean;
  reason: "ok" | "below_min_notes" | "empty_summary";
  source_count: number;
  deleted_count: number;
  summary: string | null;
  memory: Awaited<ReturnType<typeof queries.agentMemory.createMemory>> | null;
};

export type CompactAgentMemoryOptions = CompactMemoryRequestInput & {
  workspaceId: string;
};

/**
 * Stateless memory compaction job:
 * load workspace-scoped notes → compactMemoryNotes → write one summary row → delete sources.
 * Idempotent for re-runs: prior `summary` rows are replaced, not re-compacted as sources.
 *
 * Write order is create-then-delete so a failed create cannot drop source notes.
 * A failed delete after create is recoverable: sources remain and re-run replaces summaries.
 */
export async function compactAgentMemory(
  db: Database,
  opts: CompactAgentMemoryOptions
): Promise<CompactAgentMemoryResult> {
  // Omitted agent_id means shared workspace notes (agent_id IS NULL), not every agent.
  const agentId = opts.agent_id === undefined ? null : opts.agent_id;
  const minNotes = opts.min_notes ?? DEFAULT_MIN_NOTES;
  const maxLength = opts.max_length ?? DEFAULT_MAX_LENGTH;
  const dryRun = opts.dry_run === true;

  const rows = await queries.agentMemory.listMemory(db, opts.workspaceId, {
    agentId,
    limit: LIST_LIMIT,
  });

  const sources = rows.filter((r) => r.kind !== MEMORY_SUMMARY_KIND);
  const priorSummaries = rows.filter((r) => r.kind === MEMORY_SUMMARY_KIND);

  if (sources.length < minNotes) {
    return {
      compacted: false,
      reason: "below_min_notes",
      source_count: sources.length,
      deleted_count: 0,
      summary: null,
      memory: null,
    };
  }

  const summary = compactMemoryNotes(
    sources.map((r) => ({
      content: r.content,
      kind: r.kind,
      updatedAt: r.updatedAt,
    })),
    {
      maxNotes: opts.max_notes,
      maxLength,
    }
  );

  if (!summary) {
    return {
      compacted: false,
      reason: "empty_summary",
      source_count: sources.length,
      deleted_count: 0,
      summary: null,
      memory: null,
    };
  }

  if (dryRun) {
    return {
      compacted: true,
      reason: "ok",
      source_count: sources.length,
      deleted_count: 0,
      summary,
      memory: null,
    };
  }

  // Persist the summary first so source deletion cannot orphan the workspace.
  const memory = await queries.agentMemory.createMemory(db, {
    workspaceId: opts.workspaceId,
    agentId,
    kind: MEMORY_SUMMARY_KIND,
    content: summary,
    sourceTaskId: null,
  });

  const idsToDelete = [...sources, ...priorSummaries].map((r) => r.id);
  const deleted = await queries.agentMemory.deleteMemoriesByIds(
    db,
    opts.workspaceId,
    idsToDelete
  );

  return {
    compacted: true,
    reason: "ok",
    source_count: sources.length,
    deleted_count: deleted.length,
    summary,
    memory,
  };
}
