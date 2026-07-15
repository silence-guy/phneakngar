# Brief: Agent PC access + workspace token (execute approved plan)

Repo: /Users/privexus/Project/ភ្នាក់ងារ (ភ្នាក់ងារ monorepo)
Approved plans:
- .omo/plans/agent-pc-access-workspace-token.md
- plans/2026-07-15-agent-pc-access-and-workspace-token-deep-dive.md

## Root cause (proven)
CLI `register` calls GET /api/me with pending machine token Bearer before POST /api/machine-tokens/activate.
withAuth accepts al_* only when status===active && workspaceId set → 401 {"error":"invalid token"}.
UI creates pending tokens. Login path already correct (session /api/me then activate).

## Goals to deliver (ordered)

### G1 WP-1 Fix register for pending tokens (CRITICAL)
- Files ONLY: src/cli/commands/register.ts, src/cli/commands/register.test.ts
- Call activateAndSave first; optional non-fatal post-activate /api/me for email (mirror login.ts)
- Rewrite inverted comment about verify-before-activate
- Do NOT change auth.ts / activate route / schema
- Stateful mock tests: /api/me 401 until after activate; config saved; non-al_ fails; same-machine re-register OK; multi-ws/SIGHUP still pass
- Verify: pnpm --filter @phneakngar/cli test

### G2 WP-2 CLI error taxonomy
- Map activate 404/409/422/503 in activate.ts (where process.exit lives)
- Tests for messages
- Verify: pnpm --filter @phneakngar/cli test

### G3 WP-3 Doctor PC-reachability
- No watched token → fail + hint; optional empty-workdir hint
- Files: doctor.ts, doctor.test.ts, maybe status.ts
- Verify: pnpm --filter @phneakngar/cli test

### G4 WP-4 Connect UI UX
- Ordered next steps after copy; no whole-PC implication
- Files: connect-machine-steps.tsx, locales
- Verify: pnpm --filter @phneakngar/web test (if tests exist) + typecheck as needed

### G5 Final verification
- pnpm --filter @phneakngar/cli test; web if touched; pnpm typecheck; pnpm check:project as needed
- Update plan checkboxes
- No release bump

## Non-goals
- Full PC FS access
- Accepting pending in withAuth
- Auto-attach workspace without register
- Release bump
- Schema migrations

## Constraints
- Plan-driven; AGENTS.md: tests required; stateful services; workspace-scoped queries
- TDD: RED then GREEN
- Security: pending Bearer must stay 401
