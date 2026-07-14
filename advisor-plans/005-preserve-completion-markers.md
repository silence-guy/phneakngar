# Plan 005: Preserve task completion markers on real client errors

## Status
- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 001
- **Category**: correctness
- **Planned at**: commit `9cb16ca8`, 2026-07-14

## features/show case
- Authentication, authorization, validation, and unexpected not-found responses keep a durable completion marker for retry.
- Only an explicit already-terminal response is treated as idempotent success.

## designs overview
The CLI currently classifies almost every 4xx as proof that a result was already recorded. Introduce typed HTTP errors or a narrow terminal-conflict predicate based on status plus server error code/message. Preserve markers for all other client failures and log actionable diagnostics without token values.

## new deps
- None.

## Scope
**In scope**:
- `src/cli/chhlat/client.ts`
- `src/cli/chhlat/session-runner.ts`
- `src/cli/chhlat/session-runner.test.ts`
- `src/cli/chhlat/chhlat.ts`
- `src/cli/chhlat/chhlat.test.ts`
- `src/web/src/lib/services/task.ts` and focused tests for a typed terminal-transition result
- task complete/fail routes and tests for the required machine-readable terminal response

**Out of scope**: task-message ingestion, retry interval redesign, `skills-lock.json`.

## TODOS
- [x] Represent HTTP status and server error separately from display text.
- [x] Define the one explicit already-terminal outcome accepted as success.
- [x] Keep/write markers for 400, 401, 403, unexpected 404, and other non-terminal failures.
- [x] Delete markers only after confirmed acceptance or explicit terminal duplicate.

### test cases
- [x] 401/403 preserves marker.
- [x] Validation 400 preserves marker.
- [x] Explicit terminal duplicate removes/no longer writes marker.
- [x] 5xx and network errors retry then persist marker.
- [x] Focused CLI tests and global gates pass.

## STOP conditions
- Stop if server routes cannot distinguish terminal conflict from malformed input; add a small explicit error contract rather than parsing prose.
