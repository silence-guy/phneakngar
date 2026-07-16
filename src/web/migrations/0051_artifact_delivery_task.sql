-- Additive: link delivery artifacts (drafts/digests/reports) to producing tasks.
-- Safe forward-only; nullable task_id so existing upload/attachment rows remain valid.

ALTER TABLE `artifact` ADD COLUMN `task_id` text REFERENCES `agent_task_queue`(`id`) ON DELETE set null;

CREATE INDEX IF NOT EXISTS `idx_artifact_task`
  ON `artifact` (`workspace_id`, `task_id`);

CREATE INDEX IF NOT EXISTS `idx_artifact_ws_source`
  ON `artifact` (`workspace_id`, `source`, `created_at`);
