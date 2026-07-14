# Plan 002: Revoke machine-token caches immediately

## Status
- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 001
- **Category**: security
- **Planned at**: commit `9cb16ca8`, 2026-07-14

## features/show case
- Deleting an active machine token invalidates cached authentication immediately.
- Cache keys never require recovering or logging the plaintext token.

## designs overview
Authentication caches by a digest derived from the presented raw token. Activated rows redact the plaintext, so deletion cannot reconstruct the current key from `target.token`. Index cache entries by durable token identity or stored `tokenHash`, and make lookup, last-used throttling, activation, and deletion use one documented key contract.

## new deps
- None.

## Scope
**In scope**:
- `src/web/src/lib/cache.ts`
- `src/web/src/lib/middleware/auth.ts`
- `src/web/src/lib/middleware/auth.test.ts`
- `src/web/src/app/api/machine-tokens/[id]/route.ts`
- its route test
- `src/shared/src/db/queries/machine-token.ts`

**Out of scope**: activation concurrency (Plan 014), token format changes, secrets, `skills-lock.json`.

## TODOS
- [x] Define a cache key from durable token identity/digest that both auth and deletion know.
- [x] Ensure legacy plaintext rows still authenticate and migrate safely.
- [x] Invalidate auth and last-used cache entries after deletion.
- [x] Avoid exposing raw tokens in API responses, logs, KV keys, or errors.

### test cases
- [x] Warm cache, delete token, next authenticated request returns 401.
- [x] Wrong-workspace deletion cannot invalidate or delete another token.
- [x] Legacy token-hash migration still authenticates once and then uses the new cache contract.
- [x] Focused shared/web tests pass, then global gates pass.

## STOP conditions
- Stop if the fix requires retaining plaintext active tokens.
- Stop if KV cannot invalidate the chosen durable key without a schema migration; report the minimum migration instead of improvising.
