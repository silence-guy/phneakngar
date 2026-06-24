ALTER TABLE workspace ADD COLUMN default_locale TEXT NOT NULL DEFAULT 'km';
ALTER TABLE member ADD COLUMN preferred_locale TEXT NOT NULL DEFAULT 'km';
ALTER TABLE agent ADD COLUMN preferred_locale TEXT;
ALTER TABLE agent ADD COLUMN language_policy TEXT;
ALTER TABLE agent_task_queue ADD COLUMN locale_override TEXT;
ALTER TABLE agent_task_queue ADD COLUMN visible_outcome_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE agent_task_queue ADD COLUMN retry_of_task_id TEXT;

CREATE INDEX idx_task_queue_visible_outcome
  ON agent_task_queue(workspace_id, visible_outcome_status, completed_at);
