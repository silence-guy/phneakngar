# Plan 012: Centralize environment-specific email identity

## Status
- **Status**: DONE
- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: 001
- **Category**: correctness / configuration
- **Planned at**: commit `9cb16ca8`, 2026-07-14

## features/show case
- Each deployment explicitly configures its agent-email domain.
- Browser UI, server routes, workers, tests, message IDs, metadata, and docs render the same selected environment identity.
- `cieee.xyz` remains clearly labeled as the current live-testing domain only, not a permanent canonical product domain.

## designs overview
Do not replace one global hard-coded domain with another. Keep shared helpers pure by accepting an explicit domain. Server/Worker callers obtain the value from Cloudflare environment; browser callers use a validated `NEXT_PUBLIC_PHNEAKNGAR_DOMAIN` or server-provided runtime configuration. Decide a safe development fallback that is visibly non-production, and fail deployment readiness when production identity is missing.

## new deps
- None.

## Scope
**In scope**:
- `src/shared/src/utils/email.ts` and tests
- shared email-address call sites
- web environment typings/config helpers
- client components displaying/copying agent addresses
- web routes constructing addresses/message IDs
- email-worker address/message-ID code
- `.env.example` and Worker `.dev.vars.example` files without secret values
- health/config checks and focused tests

**Out of scope**: acquiring DNS, onboarding a permanent domain, changing Cloudflare account resources, `skills-lock.json`.

## TODOS
- [x] Define explicit environment-domain resolution for server, Worker, browser, and tests.
- [x] Remove assumptions that either `cieee.xyz` or `phneakngar.ai` is universally canonical.
- [x] Pass the configured domain to shared helpers at all runtime boundaries.
- [x] Make production readiness fail clearly when no valid domain is configured.
- [x] Label `cieee.xyz` as live testing in examples and current deployment docs.

### test cases
- [x] Test domain renders consistently in browser/server/worker helpers.
- [x] A second custom domain works without code changes.
- [x] Local-versus-external address parsing follows the selected domain.
- [x] Missing production configuration fails readiness without leaking secret/config details.
- [x] Domain environment changes do not leak across test suites.
- [x] Focused tests and global gates pass.

## STOP conditions
- Stop if a permanent canonical domain choice is required; the user explicitly stated that `cieee.xyz` is testing-only, so request that product decision rather than inventing one.
