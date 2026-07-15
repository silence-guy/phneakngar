Execute approved monorepo plan for invalid machine-token register and PC access diagnostics.

Goal G1 WP1 Fix CLI register pending token order:
Implement activateAndSave before any Bearer /api/me in src/cli/commands/register.ts with tests in register.test.ts. Pending al_ tokens from UI must activate and save watched_workspaces. Optional non-fatal post-activate /api/me for email only. Do not change auth middleware. Prove with pnpm --filter @phneakngar/cli test and stateful mock where /api/me is 401 until after activate.

Goal G2 WP2 CLI activate error taxonomy:
Improve human-readable CLI errors in src/cli/lib/activate.ts for activate HTTP 404 409 422 503 with tests. Prove with pnpm --filter @phneakngar/cli test.

Goal G3 WP3 Doctor PC reachability:
Extend src/cli/commands/doctor.ts so missing watched workspace token fails closed with register hint; add tests in doctor.test.ts. Prove with pnpm --filter @phneakngar/cli test.

Goal G4 WP4 Connect machine UI steps:
Update connect-machine-steps.tsx and locale strings so after copy user sees ordered next steps and no whole-PC filesystem claim. Prove with focused web tests if present and typecheck.

Goal G5 Final verification gate:
Run pnpm --filter @phneakngar/cli test, pnpm typecheck, and update plan checkboxes. No release version bump.
