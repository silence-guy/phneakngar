-- Additive Helio-parity foundations:
-- agent profile fields, issue claim + blocked support columns,
-- automation / memory / approval / integration / channel_member tables.
-- Safe to apply forward-only; no destructive changes.

ALTER TABLE `agent` ADD COLUMN `role_title` text NOT NULL DEFAULT '';
ALTER TABLE `agent` ADD COLUMN `responsibility` text NOT NULL DEFAULT '';

ALTER TABLE `issue` ADD COLUMN `claimed_by_agent_id` text;
ALTER TABLE `issue` ADD COLUMN `claimed_at` text;

CREATE INDEX IF NOT EXISTS `idx_issue_workspace_claimed`
  ON `issue` (`workspace_id`, `claimed_by_agent_id`);

CREATE TABLE IF NOT EXISTS `automation` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `agent_id` text NOT NULL,
  `title` text NOT NULL,
  `sop_markdown` text NOT NULL DEFAULT '',
  `schedule` text NOT NULL,
  `next_run_at` text NOT NULL,
  `delivery_mode` text NOT NULL DEFAULT 'channel',
  `delivery_channel_id` text,
  `skill_name` text,
  `enabled` integer NOT NULL DEFAULT 1,
  `last_run_at` text,
  `last_task_id` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON DELETE cascade,
  FOREIGN KEY (`agent_id`, `workspace_id`) REFERENCES `agent`(`id`, `workspace_id`) ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS `idx_automation_ws_next`
  ON `automation` (`workspace_id`, `enabled`, `next_run_at`);
CREATE INDEX IF NOT EXISTS `idx_automation_ws_agent`
  ON `automation` (`workspace_id`, `agent_id`);

CREATE TABLE IF NOT EXISTS `agent_memory` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `agent_id` text,
  `kind` text NOT NULL DEFAULT 'fact',
  `content` text NOT NULL,
  `source_task_id` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON DELETE cascade,
  FOREIGN KEY (`agent_id`, `workspace_id`) REFERENCES `agent`(`id`, `workspace_id`) ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS `idx_agent_memory_ws_agent`
  ON `agent_memory` (`workspace_id`, `agent_id`, `kind`);

CREATE TABLE IF NOT EXISTS `approval` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `agent_id` text,
  `kind` text NOT NULL,
  `status` text NOT NULL DEFAULT 'pending',
  `title` text NOT NULL DEFAULT '',
  `summary` text NOT NULL DEFAULT '',
  `payload` text,
  `decided_by_user_id` text,
  `decided_at` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON DELETE cascade,
  FOREIGN KEY (`decided_by_user_id`) REFERENCES `user`(`id`) ON DELETE set null,
  FOREIGN KEY (`agent_id`, `workspace_id`) REFERENCES `agent`(`id`, `workspace_id`) ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS `idx_approval_ws_status`
  ON `approval` (`workspace_id`, `status`, `created_at`);
CREATE INDEX IF NOT EXISTS `idx_approval_ws_agent`
  ON `approval` (`workspace_id`, `agent_id`);

CREATE TABLE IF NOT EXISTS `agent_integration` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `agent_id` text NOT NULL,
  `provider` text NOT NULL,
  `status` text NOT NULL DEFAULT 'active',
  `config` text,
  `secret_ref` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON DELETE cascade,
  FOREIGN KEY (`agent_id`, `workspace_id`) REFERENCES `agent`(`id`, `workspace_id`) ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS `agent_integration_ws_agent_provider`
  ON `agent_integration` (`workspace_id`, `agent_id`, `provider`);
CREATE INDEX IF NOT EXISTS `idx_agent_integration_ws_agent`
  ON `agent_integration` (`workspace_id`, `agent_id`);

CREATE TABLE IF NOT EXISTS `channel_member` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `channel_id` text NOT NULL,
  `member_type` text NOT NULL,
  `member_id` text NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON DELETE cascade,
  FOREIGN KEY (`channel_id`) REFERENCES `channel`(`id`) ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS `channel_member_unique`
  ON `channel_member` (`channel_id`, `member_type`, `member_id`);
CREATE INDEX IF NOT EXISTS `idx_channel_member_ws`
  ON `channel_member` (`workspace_id`, `channel_id`);
CREATE INDEX IF NOT EXISTS `idx_channel_member_member`
  ON `channel_member` (`workspace_id`, `member_type`, `member_id`);
