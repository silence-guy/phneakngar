# Plan 008: Make task-message ingestion idempotent

## Status
- **Status**: DONE
- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: 001
- **Category**: correctness / migration
- **Planned at**: commit `9cb16ca8`, 2026-07-14

## features/show case
- Replaying the same `(task_id, seq)` batch creates no duplicates.
- Partial D1 failures return a retryable response instead of acknowledging lost rows.

## designs overview
Add a unique durable identity for task messages, reconcile any historical duplicates in a forward migration, and use conflict-safe inserts. If a duplicate carries different content/type/tool metadata, fail closed and log the inconsistency rather than overwriting history. Broadcast only messages confirmed durable.

## new deps
- None.

## Scope
**In scope**:
- `src/shared/src/db/schema.ts`
- `src/shared/src/db/queries/task-message.ts`
- shared task-message tests
- new forward migration under `src/web/migrations/`
- `src/web/src/app/api/chhlat/tasks/[taskId]/messages/route.ts`
- its route test
- `docs/migrations.md` only if procedure needs clarification

**Out of scope**: removing analysis rows, UI rendering filters, `skills-lock.json`.

## TODOS
- [x] Inspect existing migration numbering and add a new immutable forward migration.
- [x] Deduplicate historical rows deterministically before adding unique `(task_id, seq)` storage enforcement.
- [x] Implement conflict-safe insertion and payload-consistency checks, including pre-write intra-batch duplicate identity validation.
- [x] Return retryable failure if any required message was not durably stored, including mixed conflict/transient outcomes.
- [x] Broadcast only after the whole accepted batch is durably resolved; do not duplicate live events on retries.

### test cases
- [x] First batch inserts all rows.
- [x] Exact replay is successful and creates no duplicates.
- [x] Same identity with conflicting payload fails, including same-seq/different-payload conflicts inside a single submitted batch.
- [x] Partial storage failure returns non-2xx, preserves retryability for transient D1 failures, and broadcasts nothing until the accepted batch is durably resolved.
- [x] Cross-workspace/task authorization remains enforced.
- [x] Full migration chain validated in fresh disposable Wrangler state; focused tests and required global gates pass.

## STOP conditions
- Stop if historical duplicate cleanup cannot be deterministic; report duplicate shapes and propose a reviewed rule.
