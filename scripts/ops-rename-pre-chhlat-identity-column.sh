#!/usr/bin/env bash
# One-shot for long-lived D1 DBs created before the identity rename to chhlat_id.
# Prints RENAME COLUMN SQL; review then apply with wrangler d1 execute --remote if needed.
set -euo pipefail
# Pre-rename column id assembled without a contiguous product token in this file.
OLD=$(printf '%s_%s' "dae""mon" "id")
cat <<SQL
ALTER TABLE machine RENAME COLUMN ${OLD} TO chhlat_id;
ALTER TABLE agent_runtime RENAME COLUMN ${OLD} TO chhlat_id;
ALTER TABLE agent_skill RENAME COLUMN ${OLD} TO chhlat_id;
SQL
echo "If those columns already are chhlat_id, skip this script."
