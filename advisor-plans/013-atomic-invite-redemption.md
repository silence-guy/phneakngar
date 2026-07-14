# Plan 013: Redeem workspace invites atomically

## Status
- **Status**: DONE
- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: 001
- **Category**: correctness
- **Planned at**: commit `9cb16ca8`, 2026-07-14

## features/show case
- A user cannot consume an invitation without becoming a workspace member.
- Retrying after an interrupted redemption converges to one membership and one redeemed invite.

## designs overview
D1 transaction support must be verified before choosing an implementation. Prefer one database transaction if supported consistently by the repository runtime; otherwise implement an idempotent redeem-for-user operation that records the redeemer and allows the same user to complete membership on retry. Different users must never reuse the invite.

## new deps
- None.

## Scope
**In scope**:
- `src/shared/src/db/queries/workspace-invite.ts`
- `src/shared/src/db/queries/member.ts` only if needed
- shared tests
- `src/web/src/app/api/invite/[token]/route.ts`
- its route tests

**Out of scope**: invitation UI redesign, multi-use invites, `skills-lock.json`.

## TODOS
- [x] Determine the repository-supported atomic/idempotent D1 pattern.
- [x] Combine or recover invite redemption and membership creation, including historical same-user `usedBy` partial state repair.
- [x] Make retries by the same user succeed without duplicate membership.
- [x] Keep expired, used-by-other-user, cross-workspace, and over-capacity cases fail closed.

### test cases
- [x] Normal redemption creates one membership.
- [x] Injected whole-batch failure is not acknowledged and a retry can succeed.
- [x] Historical same-user used-invite without membership is repaired by retry.
- [x] Concurrent same-user redemption converges to one membership.
- [x] Concurrent different-user redemption allows only one user.
- [x] Expired invite remains unusable and over-capacity retry remains rejected.
- [x] Focused tests and required global gates pass.

## STOP conditions
- Stop if no safe atomic or resumable D1 primitive exists; report the minimal schema/workflow addition needed.
