-- Additive: SOP playbooks — versioned definitions, runs, and per-step records.
-- Engine state lives entirely in these tables (stateless-service rule).
CREATE TABLE IF NOT EXISTS `playbook` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `agent_id` text,
  `title` text NOT NULL,
  `description` text NOT NULL DEFAULT '',
  `definition` text NOT NULL,
  `version` integer NOT NULL DEFAULT 1,
  `status` text NOT NULL DEFAULT 'draft',
  `created_by_user_id` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON DELETE cascade,
  FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE set null,
  FOREIGN KEY (`agent_id`, `workspace_id`) REFERENCES `agent`(`id`, `workspace_id`) ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS `idx_playbook_ws_agent_status`
  ON `playbook` (`workspace_id`, `agent_id`, `status`);
CREATE INDEX IF NOT EXISTS `idx_playbook_ws_updated`
  ON `playbook` (`workspace_id`, `updated_at`);

CREATE TABLE IF NOT EXISTS `playbook_run` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `playbook_id` text NOT NULL,
  `playbook_version` integer NOT NULL,
  `agent_id` text NOT NULL,
  `runtime_id` text,
  `conversation_id` text,
  `status` text NOT NULL DEFAULT 'running',
  `current_step_id` text,
  `snapshot` text NOT NULL,
  `input` text,
  `output` text,
  `started_by_user_id` text,
  `current_task_id` text,
  `current_approval_id` text,
  `created_at` text NOT NULL,
  `started_at` text,
  `finished_at` text,
  `error` text,
  FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON DELETE cascade,
  FOREIGN KEY (`playbook_id`) REFERENCES `playbook`(`id`) ON DELETE cascade,
  FOREIGN KEY (`agent_id`) REFERENCES `agent`(`id`) ON DELETE cascade,
  FOREIGN KEY (`runtime_id`) REFERENCES `agent_runtime`(`id`) ON DELETE set null,
  FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON DELETE set null,
  FOREIGN KEY (`started_by_user_id`) REFERENCES `user`(`id`) ON DELETE set null
);

CREATE INDEX IF NOT EXISTS `idx_playbook_run_ws_status`
  ON `playbook_run` (`workspace_id`, `status`);
CREATE INDEX IF NOT EXISTS `idx_playbook_run_ws_playbook`
  ON `playbook_run` (`workspace_id`, `playbook_id`, `created_at`);
CREATE INDEX IF NOT EXISTS `idx_playbook_run_ws_agent`
  ON `playbook_run` (`workspace_id`, `agent_id`, `status`);

CREATE TABLE IF NOT EXISTS `playbook_step_run` (
  `id` text PRIMARY KEY NOT NULL,
  `run_id` text NOT NULL,
  `workspace_id` text NOT NULL,
  `step_id` text NOT NULL,
  `step_kind` text NOT NULL,
  `status` text NOT NULL DEFAULT 'pending',
  `output` text,
  `task_id` text,
  `approval_id` text,
  `started_at` text,
  `finished_at` text,
  `error` text,
  FOREIGN KEY (`run_id`) REFERENCES `playbook_run`(`id`) ON DELETE cascade,
  FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS `playbook_step_run_run_step`
  ON `playbook_step_run` (`run_id`, `step_id`);
CREATE INDEX IF NOT EXISTS `idx_playbook_step_run_ws_run`
  ON `playbook_step_run` (`workspace_id`, `run_id`);
