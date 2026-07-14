-- Outbound email send claims reuse emails.delivery_key uniqueness (0045) with
-- direction=outbound and statuses pending|sending|sent|failed|ambiguous.
-- This index speeds agent-scoped claim recovery by delivery key.
CREATE INDEX IF NOT EXISTS idx_emails_outbound_claim
  ON emails (workspace_id, agent_id, delivery_key);
