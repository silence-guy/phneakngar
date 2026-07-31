-- Additive: workspace agent response language mode (auto | bilingual | en | km).
-- The task payload builder reads this as the workspace-level fallback for the
-- runtime language policy (task/agent/owner locale still take precedence).
ALTER TABLE workspace ADD COLUMN agent_language_mode TEXT NOT NULL DEFAULT 'auto';
