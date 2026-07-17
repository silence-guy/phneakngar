# D1 Migrations

Application D1 migrations live in `src/web/migrations`. The authoritative Drizzle schema lives in `src/shared/src/db/schema.ts`.

## When a Migration Is Required

Add a migration whenever a change modifies durable D1 shape or a query's durable assumptions:

- New table, column, index, unique constraint, or foreign key.
- Changed default or nullability.
- Backfill or normalization of existing data.
- Query performance that depends on a new index.
- Idempotency or ownership behavior enforced by storage.
- Cleanup required before new code can safely read or write the data.

A TypeScript-only validator, UI-only state, local IndexedDB cache, or R2 key-format change does not require a D1 migration unless stored D1 rows also change.

## Naming and Immutability

Use a new, never-before-used filename:

```text
0047_short_behavior_description.sql
```

Wrangler records the complete filename as the deployment identifier. Historical migrations contain some duplicate numeric prefixes, but every complete filename is unique and the clean local migration chain succeeds. Do not rename an applied file, reuse an existing filename, or attempt to repair the prefixes retroactively.

Choose the next available numeric prefix for new work and keep the description concise and behavior focused.

## Safety Rules

- Prefer additive, forward-safe migrations.
- State whether a migration is additive, backfill-only, destructive, or compatibility sensitive.
- Add indexes and uniqueness constraints required by authorization or idempotency.
- Make foreign-key deletion behavior explicit and verify that it matches product ownership.
- Store timestamps in the repository's established ISO string format unless a reviewed migration changes the convention.
- Never reset, delete, or rewrite a remote production D1 database during deployment.
- Never edit an already-applied production migration.
- Repair a failed or incomplete production change with a reviewed forward migration.
- Export or back up production data before destructive or large backfill operations.

## Change Checklist

- Update `src/shared/src/db/schema.ts`.
- Add the matching SQL migration in `src/web/migrations`.
- Ensure shared queries use Drizzle predicates and include workspace ownership in the database query.
- Add or update query tests under `src/shared/test`.
- Add a route, Worker, or integration test at the owning runtime when behavior changes.
- Verify unique constraints under duplicate delivery or concurrent execution.
- Verify the full chain against an empty local database.
- Review the remote pending migration list before production apply.
- Document rollback as a forward repair, not destructive reversal.

## Local Validation

Reset only local Wrangler state and apply the full chain:

```bash
pnpm db:reset
```

Apply pending local migrations without deleting local state:

```bash
pnpm db:migrate
```

Inspect the local migration state when troubleshooting:

```bash
pnpm --filter @phneakngar/web exec wrangler d1 migrations list phneakngar-app --local
```

The production-readiness audit validated the complete chain from an empty local D1 database, including:

- `0045_email_delivery_idempotency.sql`, which adds a nullable workspace-scoped unique delivery key for retry-safe inbound email.
- `0046_machine_token_hash.sql`, which adds the token digest index used for lazy migration away from active plaintext machine tokens.
- `0048_task_message_idempotency.sql`, which removes only byte-identical duplicate task-message deliveries and then installs unique `(task_id, seq)` enforcement.
- `0049_outbound_email_claim_index.sql`, which indexes `(workspace_id, agent_id, delivery_key)` for outbound send claim recovery. Outbound claims reuse the 0045 unique delivery key with statuses `pending|sending|sent|failed|ambiguous`.
- `0050_helio_parity_foundations.sql`, which is additive Helio-parity foundation work:
  - agent profile columns `role_title`, `responsibility`
  - issue claim columns `claimed_by_agent_id`, `claimed_at` (blocked status is app-level; no enum migration)
  - new tables `automation`, `agent_memory`, `approval`, `agent_integration`, `channel_member`
  - composite foreign keys `(agent_id, workspace_id) → agent(id, workspace_id)` on tables that store agent ownership, matching `src/shared/src/db/schema.ts`
  - outbound email delivery status vocabulary expanded in app code to include `pending_approval` and `rejected` (mailbox PATCH remains limited to `unread|read|archived`; pipeline transitions go through claim/release/decide helpers)
- `0051_artifact_delivery_task.sql`, which adds nullable `artifact.task_id` and indexes for linking delivery artifacts to producing tasks.
- `0052_conversation_member.sql`, which is additive multi-party conversation membership (`conversation_member` table + unique/indexes), mirroring `channel_member` for DMs.
- `0053_gateway_commercial_foundations.sql`, which is additive commercial gateway control-plane work:
  - `gateway_binding` — durable provider/team → workspace/agent/user mapping (DB source of truth; env `GATEWAY_TEAM_MAP` remains bootstrap override)
  - `gateway_peer_allowlist` — DM pairing / allowlist peers per binding
  - `gateway_ingress_dedupe` — external message idempotency keys for signed ingress
  - App-level heartbeat automation kind + live outbound clients remain feature-flagged; full commercial Helio/OpenClaw parity is still not claimed
- `0054_gateway_egress_secret_and_activity.sql`, which is additive residual commercial path work:
  - `gateway_binding.secret_ref` — write-only bot/token vault pointer for live egress
  - `activity_event` — workspace-scoped activity feed (approve / egress / probe)
  - Live Telegram/Slack egress is production-wired when binding is `live` + secret vaulted; full commercial Helio/OpenClaw parity is still not claimed


Before applying `0048_task_message_idempotency.sql` to production, run this read-only preflight against the target D1 database and review any rows it returns:

```sql
SELECT DISTINCT
  candidate.task_id,
  candidate.seq
FROM task_message AS candidate
WHERE EXISTS (
  SELECT 1
  FROM task_message AS conflicting
  WHERE conflicting.task_id = candidate.task_id
    AND conflicting.seq = candidate.seq
    AND conflicting.id <> candidate.id
    AND (
      conflicting.type IS NOT candidate.type
      OR conflicting.tool IS NOT candidate.tool
      OR conflicting.call_id IS NOT candidate.call_id
      OR conflicting.content IS NOT candidate.content
      OR conflicting.input IS NOT candidate.input
      OR conflicting.output IS NOT candidate.output
    )
)
ORDER BY candidate.task_id, candidate.seq;
```

An empty result means the migration can deterministically clean identical duplicates. Any returned row is a conflicting historical duplicate; stop and inspect a production-safe export before applying the migration because the unique index is designed to fail closed rather than choose a winner.


## Identity column (`chhlat_id`)

Machine/runtime identity is stored as `chhlat_id`.

- Fresh local databases (`pnpm db:reset`) create `chhlat_id` from the baseline schema chain.
- Long-lived remotes that still use the pre-rename column name must run `scripts/ops-rename-pre-chhlat-identity-column.sh` once **before** deploying app code that expects `chhlat_id`.
- Migration `0047_rename_machine_identity_to_chhlat_id.sql` is a no-op marker for the rename path.

## Production Procedure

## Remote apply record (phneakngar-app)

- **2026-07-16:** Applied `0050_helio_parity_foundations.sql` … `0053_gateway_commercial_foundations.sql` via `pnpm db:migrate:remote`.
- Verify: `pnpm --filter @phneakngar/web exec wrangler d1 migrations list phneakngar-app --remote` → **No migrations to apply**.
- Full commercial Helio/OpenClaw parity is **not** claimed by this apply.
- **2026-07-17 (later):** Applied `0054_gateway_egress_secret_and_activity.sql` via `pnpm db:migrate:remote` on remote `phneakngar-app` after CF D1 recovered. Re-list: no migrations to apply. Full commercial Helio/OpenClaw parity is still **not** claimed.
- **2026-07-17 (earlier):** First remote attempt blocked by Cloudflare D1 API `code: 7500` (transient).

List pending remote migrations first:

```bash
pnpm --filter @phneakngar/web exec wrangler d1 migrations list phneakngar-app --remote
```

Apply them deliberately from one operator session:

```bash
pnpm db:migrate:remote
```

`pnpm deploy:web` also invokes `pnpm db:migrate:remote` before the OpenNext deployment. Do not run both concurrently. Record the applied migration list and verify `https://<production-origin>/api/health` after deployment.

## Failure Recovery

If a remote migration fails:

1. Stop deployments and retain the exact Wrangler output.
2. Determine whether D1 applied any statement before the failure.
3. Do not rename or rerun a modified migration file.
4. Create a new forward migration that tolerates the observed partial state.
5. Test the repair against a copy or representative local state.
6. Apply the repair once, then validate affected queries and health checks.
