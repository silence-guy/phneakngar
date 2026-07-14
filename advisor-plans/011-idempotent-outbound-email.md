# Plan 011: Make outbound email submission idempotent

## Status
- **Priority**: P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: 004, 012
- **Category**: correctness / migration
- **Planned at**: commit `9cb16ca8`, 2026-07-14

## features/show case
- Retrying an ambiguous outbound send does not deliver a duplicate message.
- Local delivery, Cloudflare Email, and custom SMTP reuse deterministic identities and durable state.

## designs overview
Require or generate a stable request idempotency key at the web boundary and durably claim it before external side effects. Reuse deterministic message ID and R2 key across retries. Store explicit pending/sent/failed/ambiguous state in D1; never claim success when external outcome is unknown. Scope every row by workspace and sender agent.

## new deps
- None.

## Scope
**In scope**:
- `src/shared/src/db/schema.ts`
- shared email query/types/schemas and tests
- a new forward migration under `src/web/migrations/`
- `src/web/src/app/api/email/send/route.ts`
- its tests
- `src/email-worker/src/index.ts`
- email-worker types/tests
- API client/composer only if an idempotency key must originate client-side

**Out of scope**: inbound email idempotency, changing SMTP providers, `skills-lock.json`.

## TODOS
- [ ] Define an idempotency key contract and durable outbound-delivery states.
- [ ] Add a forward-safe schema/migration with workspace-scoped uniqueness.
- [ ] Claim/recover delivery state before sending.
- [ ] Derive stable message/R2 identities from the claim, using Plan 012’s configured domain.
- [ ] Make retries return the existing result or resumable status without resending.
- [ ] Preserve authorized conversation mapping from Plan 004.

### test cases
- [ ] First send delivers once and records sent state.
- [ ] Exact retry returns same message/R2 identity without second send.
- [ ] Failure before send is retryable.
- [ ] Failure after send but before response does not blindly resend.
- [ ] Local, CF, and custom SMTP paths enforce the same identity contract.
- [ ] Concurrent duplicate requests deliver at most once.
- [ ] `pnpm db:reset`, focused tests, and global gates pass.

## STOP conditions
- Stop if the provider cannot expose enough outcome information to guarantee at-most-once semantics; model and report the ambiguous state rather than pretending certainty.
