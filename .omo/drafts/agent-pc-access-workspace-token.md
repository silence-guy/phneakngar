# Draft: agent-pc-access-workspace-token

- intent: clear
- review_required: false
- status: approved
- pending_action: none — plan written; wait for start-work
- classify: architecture (cli + web auth + chhlat + UX)
- date: 2026-07-15
- approved_at: 2026-07-15
- plan_path: .omo/plans/agent-pc-access-workspace-token.md
- project_plan_path: plans/2026-07-15-agent-pc-access-and-workspace-token-deep-dive.md
- metis: NEEDS_CHANGES folded into plans (WP-1 recipe lock, re-register, security non-goals, WP-2 process.exit)

## Components ledger

| id | outcome | status | evidence |
| --- | --- | --- | --- |
| C1-register-pending | Pending `al_*` register activates without `/api/me` 401 | confirmed + WP-1 ready | register.ts, auth.ts, register.test mocks |
| C2-error-taxonomy | CLI maps activate/auth errors to actionable text | planned WP-2 | activate route + activate.ts exits |
| C3-pc-access-chain | Doc + doctor checklist | planned WP-3 | execenv, workspace-files, doctor partial |
| C4-ui-connect | Connect UX next steps | planned WP-4 | connect-machine-steps |
| C5-install-url | npm + default server classified | secondary | npm 0.0.1; DEFAULT_BASE_URL |

## Locked decisions

1. WP-1: activateAndSave first; non-fatal post-activate /api/me; no auth.ts change
2. RC-6: workdir only
3. No auto-attach without register
4. Keep npx @phneakngar/cli
5. TDD + filter tests
6. No release bump unless asked

## Next user action

start-work / implement WP-1 — or request high-accuracy review first
