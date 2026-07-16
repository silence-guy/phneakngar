-- Additive commercial gateway control-plane foundations (Phase A/B path).
-- Full commercial Helio/OpenClaw parity is still not claimed.
-- Safe to apply forward-only; no destructive changes.

CREATE TABLE IF NOT EXISTS `gateway_binding` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `provider` text NOT NULL,
  `external_team_id` text NOT NULL,
  `external_account_id` text,
  `agent_id` text NOT NULL,
  `user_id` text NOT NULL,
  `status` text NOT NULL DEFAULT 'active',
  `dm_policy` text NOT NULL DEFAULT 'open',
  `outbound_mode` text NOT NULL DEFAULT 'preview',
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON DELETE cascade,
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade,
  FOREIGN KEY (`agent_id`, `workspace_id`) REFERENCES `agent`(`id`, `workspace_id`) ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS `gateway_binding_provider_team_account`
  ON `gateway_binding` (`provider`, `external_team_id`, `external_account_id`);
CREATE INDEX IF NOT EXISTS `idx_gateway_binding_ws`
  ON `gateway_binding` (`workspace_id`, `provider`, `status`);
CREATE INDEX IF NOT EXISTS `idx_gateway_binding_lookup`
  ON `gateway_binding` (`provider`, `external_team_id`, `status`);

CREATE TABLE IF NOT EXISTS `gateway_peer_allowlist` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `binding_id` text NOT NULL,
  `peer_id` text NOT NULL,
  `status` text NOT NULL DEFAULT 'allow',
  `created_at` text NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON DELETE cascade,
  FOREIGN KEY (`binding_id`) REFERENCES `gateway_binding`(`id`) ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS `gateway_peer_allowlist_unique`
  ON `gateway_peer_allowlist` (`binding_id`, `peer_id`);
CREATE INDEX IF NOT EXISTS `idx_gateway_peer_ws`
  ON `gateway_peer_allowlist` (`workspace_id`, `binding_id`);

CREATE TABLE IF NOT EXISTS `gateway_ingress_dedupe` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `provider` text NOT NULL,
  `external_message_id` text NOT NULL,
  `conversation_id` text,
  `message_id` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS `gateway_ingress_dedupe_unique`
  ON `gateway_ingress_dedupe` (`provider`, `external_message_id`);
CREATE INDEX IF NOT EXISTS `idx_gateway_ingress_dedupe_ws`
  ON `gateway_ingress_dedupe` (`workspace_id`, `provider`);
