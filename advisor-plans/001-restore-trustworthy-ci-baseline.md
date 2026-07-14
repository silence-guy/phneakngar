# Plan 001: Restore a trustworthy CI baseline

## Status
- **Status**: DONE
- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: tests / dx
- **Planned at**: commit `9cb16ca8`, 2026-07-14

## features/show case
- `pnpm test` passes with the configured email domain rather than stale `@phneakngar.ai` fixtures.
- CI generates the OpenNext bundle before Wrangler validates the web Worker.
- The repository guardrail runs as a blocking CI check.

## designs overview
The shared email helper defaults to the live-test domain today, while tests hard-code the former product domain. Tests must explicitly configure their domain and test local-versus-external behavior semantically. The CI build job currently runs `next build` and then asks Wrangler to bundle files under `.open-next`; make the deployable OpenNext build explicit without breaking local `next dev` workflows.

## new deps
- None.

## Scope
**In scope**:
- `.github/workflows/ci.yml`
- `turbo.json`
- `src/web/package.json`
- `src/web/src/app/api/email/send/route.test.ts`
- `src/web/src/app/api/agents/recruit/route.test.ts`
- `src/web/src/app/api/meeting/callback/route.test.ts`
- other existing web tests that fail solely because they hard-code an environment domain

**Out of scope**:
- Production domain policy; Plan 012 owns it.
- Email delivery behavior.
- `skills-lock.json`.

## TODOS
- [x] Reproduce the default-domain failures with `pnpm --filter @phneakngar/web test`.
- [x] Give affected suites explicit domain setup/reset and keep alternate-domain cases explicit.
- [x] Add a deployable web build script that runs `opennextjs-cloudflare build`; make CI use it before the Wrangler dry-run.
- [x] Declare `.next/**` and `.open-next/**` outputs accurately or split Turbo tasks so cache behavior is truthful.
- [x] Add `pnpm check:project` to blocking CI validation.

### test cases
- [x] Same configured-domain recipient uses local delivery.
- [x] Different-domain recipient uses the Email Worker.
- [x] Test environment cleanup prevents domain leakage between suites.
- [x] `pnpm check:project`, `pnpm typecheck`, `pnpm lint`, and `pnpm test` all exit 0.
- [x] Clean OpenNext build followed by all three Worker dry-runs exits 0.

## STOP conditions
- Stop if making the OpenNext build canonical breaks the app bundling workflow in `src/app`; report the exact command conflict.
- Stop if a failing domain assertion expresses intentional cross-domain behavior; do not globally replace strings.
