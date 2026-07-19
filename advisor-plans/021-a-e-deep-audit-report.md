# Deep audit report — A–E direction tranche

**Date:** 2026-07-19  
**HEAD base:** `6a6c7699` + uncommitted A–E work  
**Method:** Five parallel local deep passes (no Amp runners available; orbs cannot see uncommitted tree). Categories: correctness, security, UI/layout, product consistency, tests/gates.

## Verdict

**Blocker bugs found and fixed in this audit.** Remaining items are residual risk / pre-existing, not introduced as ship-stoppers for the tranche.

## Passes

| # | Focus | Result |
|---|---|---|
| 1 | Approval hold (shared + CLI + agent forms) | **Fixed** incomplete agent-edit wiring |
| 2 | Activity feed UI + kind mapping | **Fixed** missing `gateway_probe_ok/fail` labels |
| 3 | Gateway peers UI + API client | OK (schema status `allow` matches) |
| 4 | First-mission + home layout | **Fixed** z-index/position + flex parent |
| 5 | Docs honesty + gates | OK; web tsc only fails pre-existing `better-sqlite3` |

## Bugs fixed this audit

### P0 — Agent edit form hold half-wired (would TS-fail / runtime crash)

- **Symptom:** Props `approvalHoldSettings` / `setApprovalHoldSettings` passed to `RuntimeTab` without component state; panel not rendered; save path still used judgment-only merge.
- **Evidence:** `tsc` → `Cannot find name 'approvalHoldSettings'`.
- **Fix:** State + `ApprovalHoldSettingsPanel` + `buildRuntimeConfigWithApprovalHold` on submit.

### P1 — Activity kind labels missed real emitters

- Emitters use `gateway_probe_ok` / `gateway_probe_fail` and `gateway_egress_ok` / `gateway_egress_fail` / `approval_decided` / `automation_due`.
- Labels lacked probe ok/fail keys (fell through to unknown).
- **Fix:** Add keys + tests.

### P1 — First mission card under canvas chrome / layout

- Card used `z-20` while canvas controls use `z-40`; sat under create button.
- Extra wrapper inside `ReactFlowProvider` risked flex height.
- **Fix:** `z-50`, `top-14`, card outside provider with `flex flex-1 min-h-0 flex-col` parent.

## Accepted residual risks (not fixed)

| Risk | Why deferred |
|---|---|
| Hold default **on** for agents with no `approvalHold` key | Product intent; force off via `CHHLAT_APPROVAL_HOLD=0` or toggle |
| Module-level hold config in `claude.ts` | Session-runner is one process per task; OK |
| Activity silent empty on API error | Matches approvals page pattern |
| Peers UI no pagination | Small allowlists expected |
| Web `tsc` `better-sqlite3` in `tests/utils` | Pre-existing; unrelated |
| No Amp runner for true 5-subagent orb isolation | Local deep audit substituted |

## Verification after fixes

```text
pnpm check:project                          → pass
@phneakngar/shared approval-hold tests      → pass
@phneakngar/web activity/first-mission/…    → 33 pass
@phneakngar/cli tool-gate + claude + session-runner → 76 pass
@phneakngar/cli typecheck                   → pass
@phneakngar/web tsc                         → only better-sqlite3 (pre-existing)
```

## Files touched in audit fix round

- `src/web/src/components/agent-edit-form.tsx`
- `src/web/src/app/(app)/w/[slug]/activity/activity-labels.ts`
- `src/web/src/app/(app)/w/[slug]/activity/activity-labels.test.ts`
- `src/web/src/app/(app)/w/[slug]/home/first-mission-card.tsx`
- `src/web/src/app/(app)/w/[slug]/home/page.tsx`
