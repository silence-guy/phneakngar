-- Identity column is chhlat_id in the baseline schema chain.
-- This migration is a no-op marker for environments already on the rename path.
-- If a long-lived database still has the pre-rename column name, run
-- scripts/ops-rename-identity-column-if-needed.sql once before app deploy.
SELECT 1;
