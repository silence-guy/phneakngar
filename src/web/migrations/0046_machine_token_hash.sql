-- Store a one-way digest for machine-token lookup.
-- Existing rows are migrated lazily on their next successful authentication.
ALTER TABLE machine_token ADD COLUMN token_hash text;

CREATE UNIQUE INDEX machine_token_token_hash_unique
  ON machine_token (token_hash);
