-- Add missing indexes for agent_runtime and agent_task_queue tables
-- Fixes D1 query timeouts on high-frequency chhlat poll and runtime sweep paths

-- agent_runtime: fast lookup by (workspace_id, chhlat_id) for chhlat task polling
-- The existing unique constraint on (workspace_id, chhlat_id, provider) doesn't
-- efficiently cover queries filtering only by workspace_id + chhlat_id.
CREATE INDEX IF NOT EXISTS idx_agent_runtime_workspace_chhlat
  ON agent_runtime(workspace_id, chhlat_id);

-- agent_task_queue: covers failStaleKillTasks() sweep query filtering by
-- (workspace_id, type, status) during GET /api/runtimes
CREATE INDEX IF NOT EXISTS idx_task_queue_workspace_type_status
  ON agent_task_queue(workspace_id, type, status);
