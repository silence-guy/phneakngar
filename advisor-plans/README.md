# Implementation Plans

Generated 2026-07-14 from the `/improve` audit at commit `9cb16ca8`. The existing `plans/` directory serves unrelated project work, so this execution set lives in `advisor-plans/`.

User clarification: **`cieee.xyz` is a live-testing identity only. It must not become the permanent canonical product domain.** Domain-related work must keep environment-specific configuration explicit and avoid hard-coding either `cieee.xyz` or `phneakngar.ai` as universally canonical.

## Execution order and status

| Plan | Title | Priority | Effort | Depends on | Status |
|---|---|---:|---:|---|---|
| 001 | Restore trustworthy CI baseline | P1 | M | — | DONE |
| 002 | Revoke machine-token caches immediately | P1 | S | 001 | DONE |
| 003 | Contain workspace-file reads after symlink resolution | P1 | S | 001 | DONE |
| 004 | Authorize outbound-email conversation linkage | P1 | S | 001 | DONE |
| 005 | Preserve task completion markers on real client errors | P1 | S | 001 | DONE |
| 006 | Propagate meeting notification failures | P1 | S | 001 | DONE |
| 007 | Scope artifact reads to conversation owners | P1 | M | 001 | DONE |
| 008 | Make task-message ingestion idempotent | P1 | M | 001 | DONE |
| 009 | Replace WebSocket session tokens with connection tickets | P1 | L | 001 | TODO |
| 010 | Bound and scope chhlat polling | P2 | M | 001 | TODO |
| 011 | Make outbound email submission idempotent | P2 | L | 004, 012 | TODO |
| 012 | Centralize environment-specific email identity | P1 | M | 001 | DONE |
| 013 | Redeem workspace invites atomically | P2 | M | 001 | DONE |
| 014 | Claim machine-token activation atomically | P2 | M | 002 | DONE |
| 015 | Publish accurate installation and contributor docs | P2 | S | 001, 012 | DONE |

Status values: TODO | IN PROGRESS | DONE | BLOCKED.

## Dependency notes

- Plan 001 is the verification prerequisite for every implementation slice.
- Plan 011 depends on Plan 004 so idempotent delivery cannot preserve an unauthorized conversation mapping.
- Plan 011 depends on Plan 012 so deterministic message identities use the configured environment domain rather than a testing-domain constant.
- Plan 014 follows Plan 002 because both change machine-token lifecycle/cache semantics.
- Plan 015 follows Plan 012 so documentation describes the finalized environment-selection contract.

## Global verification gate

After all plans are integrated in the isolated execution worktree, run:

```bash
pnpm check:project
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

All commands must exit 0. Also run `git status --short` and confirm no source changes exist outside the union of plan scopes. Never modify the user's pre-existing `skills-lock.json` change.

## Considered and rejected

- Repository `CLAUDE.md`/`AGENTS.md` instructions are intentional project tooling, not a product vulnerability.
- Node type-definition major drift was not planned because no concrete unsupported runtime API was demonstrated.
- Private `@phneakngar/test-utils` version drift is low-value release metadata and is not part of this execution set.
