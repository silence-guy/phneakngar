# Plan 006: Propagate meeting notification failures

## Status
- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 001
- **Category**: correctness
- **Planned at**: commit `9cb16ca8`, 2026-07-14

## features/show case
- Meeting callbacks return a retryable error when internal email notification is not accepted.
- Deterministic meeting delivery keys keep retries duplicate-safe.

## designs overview
The callback checks only thrown fetch errors, not non-2xx responses. Use the service binding first, preserve the documented local fallback only for transport failure, and validate the final response. Do not expose internal response bodies or secrets to clients.

## new deps
- None.

## Scope
**In scope**:
- `src/web/src/app/api/meeting/callback/route.ts`
- `src/web/src/app/api/meeting/callback/route.test.ts`
- `src/cli/chhlat/meeting-runner.ts`
- focused CLI meeting-runner tests for bounded retry of transport and retryable non-2xx failures

**Out of scope**: notification endpoint internals, meeting UI, `skills-lock.json`.

## TODOS
- [x] Check `Response.ok` for service-binding and fallback responses.
- [x] Return a retryable 5xx when notification is not durably accepted.
- [x] Keep deterministic `deliveryKey` unchanged.
- [x] Add structured logs with status but no secret/body leakage.

### test cases
- [x] Internal 200 returns success.
- [x] Internal 401/400/500 returns callback failure.
- [x] Transport failure uses local fallback; fallback success passes.
- [x] Both transports failing returns 5xx.
- [x] Focused web tests and global gates pass.

## STOP conditions
- Stop if callers explicitly cannot retry 5xx callbacks; report the caller protocol before changing semantics.
