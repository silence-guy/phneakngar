-- Additive: multi-party DM membership (mirrors channel_member for conversations).
-- conversation.agentId remains the primary owner for task routing.
CREATE TABLE IF NOT EXISTS `conversation_member` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `conversation_id` text NOT NULL,
  `member_type` text NOT NULL,
  `member_id` text NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON DELETE cascade,
  FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS `conversation_member_unique`
  ON `conversation_member` (`conversation_id`, `member_type`, `member_id`);
CREATE INDEX IF NOT EXISTS `idx_conversation_member_ws`
  ON `conversation_member` (`workspace_id`, `conversation_id`);
CREATE INDEX IF NOT EXISTS `idx_conversation_member_member`
  ON `conversation_member` (`workspace_id`, `member_type`, `member_id`);
