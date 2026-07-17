-- Additive: vaulted bot token on gateway_binding + workspace activity_event feed.
-- Full commercial Helio/OpenClaw parity is still not claimed.
-- Safe forward-only; no destructive changes.

ALTER TABLE `gateway_binding` ADD COLUMN `secret_ref` text;

CREATE TABLE IF NOT EXISTS `activity_event` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `kind` text NOT NULL,
  `actor_type` text,
  `actor_id` text,
  `subject_type` text,
  `subject_id` text,
  `summary` text NOT NULL,
  `payload_json` text,
  `dedupe_key` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS `idx_activity_event_ws_created`
  ON `activity_event` (`workspace_id`, `created_at`);
CREATE UNIQUE INDEX IF NOT EXISTS `activity_event_ws_dedupe`
  ON `activity_event` (`workspace_id`, `dedupe_key`);
