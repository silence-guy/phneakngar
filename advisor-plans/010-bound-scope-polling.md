# Plan 010: Bound and scope chhlat polling

## Status
- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: 001
- **Category**: performance
- **Planned at**: commit `9cb16ca8`, 2026-07-14
- **Phase D remediation**: complete and verified locally; no external dependencies added.

## features/show case
- Poll work is proportional to server-owned batch limits, not the total workspace backlog.
- Payload construction reads only agents, accounts, and relations needed for claimed tasks.
- File-request and meeting delivery use deterministic finite batches.

## designs overview
Preserve priority, per-agent concurrency, blocked-conversation, steering, and kill-task semantics. Add server-owned ceilings independent of client input. Prefer scoped Drizzle queries and bounded over-fetch over loading full workspace collections. Follow-up polls provide eventual delivery.

Phase D remediation status: pending task selection is tenant-scoped and claimability-aware in the database before the response limit. Higher-ranked dispatched-only, exhausted-capacity, steering-blocked, and conversation-blocked agents are filtered before one claimable task per agent/workspace is grouped, so those rows cannot indefinitely hide a lower-ranked eligible agent behind an over-fetch window. Workspace file requests are claimed with pending-status predicates and `RETURNING`, concurrent claims return only rows actually claimed, and meeting/file-request responses are ordered by the selected candidate order including later batches.

## new deps
- None.

## Scope
**In scope**:
- `src/shared/src/schemas.ts`
- `src/shared/src/db/queries/task.ts`
- `src/shared/src/db/queries/email-account.ts`
- `src/shared/src/db/queries/agent-link.ts`
- `src/shared/src/db/queries/workspace-file-request.ts`
- `src/shared/src/db/queries/meeting-session.ts`
- related shared tests
- `src/web/src/lib/services/task.ts`
- `src/web/src/lib/services/task-payload-builder.ts`
- `src/web/src/app/api/chhlat/tasks/poll/route.ts`
- related web tests

**Out of scope**: UI polling hook, task protocol redesign, `skills-lock.json`.

## TODOS
- [x] Add a maximum to `max_tasks` and clamp again server-side.
- [x] Bound pending task candidate selection while preserving distinct-agent priority fairness.
- [x] Use ID-scoped agent/account/colleague queries in payload building.
- [x] Limit file-request and meeting claims with deterministic ordering.
- [x] Claim file requests atomically with pending-status predicates and return only claimed rows.
- [x] Keep workspace scoping in every database predicate.

### test cases
- [x] Over-maximum client request is rejected or clamped per documented contract.
- [x] Large backlog returns only bounded distinct-agent candidates in priority order.
- [x] Blocked/steerable conversations retain existing semantics.
- [x] Payload queries receive only claimed agent IDs.
- [x] Remaining meetings/file requests arrive on later polls without duplication.
- [x] Higher-ranked ineligible task candidates cannot starve a later eligible agent.
- [x] Concurrent file-request claim attempts do not duplicate delivery and a later poll receives the remaining row.
- [x] Focused performance/behavior tests and global gates pass.

## STOP conditions
- Stop if a bounded query changes task fairness without a clear compatibility decision; report candidate algorithms and evidence.
