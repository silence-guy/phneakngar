-- Add a durable idempotency key for inbound email delivery.
-- Existing rows remain nullable. SQLite permits multiple NULL values in a UNIQUE index.
ALTER TABLE emails ADD COLUMN delivery_key text;

CREATE UNIQUE INDEX emails_workspace_delivery_key
  ON emails (workspace_id, delivery_key);
