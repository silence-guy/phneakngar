# Plan 014: Claim machine-token activation atomically

## Status
- **Status**: DONE
- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: 002
- **Category**: correctness
- **Planned at**: commit `9cb16ca8`, 2026-07-14

## features/show case
- Only one concurrent request can claim a pending machine token.
- Activation retries resume or return the already-created machine/runtime identity without creating inconsistent extras.

## designs overview
Replace read-then-act with a guarded state transition. Add an `activating` state or equivalent claim metadata only if required; otherwise use a conditional update returning the claimed row. Provision machine/runtime rows deterministically from workspace/token/chhlat identity and make every write idempotent. Integrate Plan 002’s cache invalidation contract.

## new deps
- None.

## Scope
**In scope**:
- `src/shared/src/db/schema.ts` only if activation state/claim metadata is needed
- `src/shared/src/db/queries/machine-token.ts`
- machine/runtime queries only as needed for deterministic idempotency
- shared tests
- optional new forward migration
- `src/web/src/app/api/machine-tokens/activate/route.ts`
- its tests

**Out of scope**: token issuance UX, WebSocket auth, `skills-lock.json`.

## TODOS
- [x] Add a conditional atomic claim requiring current status `pending`.
- [x] Make machine/runtime provisioning deterministic and resumable, including pre-existing extra runtime recovery.
- [x] Finalize activation only after validating/claiming the exact runtime set for the claimant and invalidate Plan 002 cache keys.
- [x] Return existing activation identity on safe same-request retry without permanent 503s.

### test cases
- [x] Two concurrent claims produce one activation owner.
- [x] Retry after partial provisioning converges without duplicate runtime rows.
- [x] Exact retries with pre-existing extra runtime rows recover or fail before token finalization rather than leaving an active token in permanent 503.
- [x] Already-active token cannot be reassigned to another hostname.
- [x] Wrong/missing workspace remains rejected.
- [x] Focused tests and required global gates pass; no additional migration was required.

## STOP conditions
- Stop if current uniqueness constraints cannot identify a deterministic activation; report the required migration rather than using process memory.
