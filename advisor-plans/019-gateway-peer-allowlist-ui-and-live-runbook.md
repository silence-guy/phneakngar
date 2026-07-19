# Plan 019: Gateway peer allowlist UI + Live Telegram runbook

> **Drift check**: `git diff --stat 6a6c7699..HEAD -- src/web/src/app/(app)/w/[slug]/settings/gateway-tab.tsx src/web/src/lib/api/gateway.ts docs/`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `6a6c7699`, 2026-07-19

## Why this matters

Live Telegram/Slack egress and allowlist enforcement exist server-side, but operators cannot manage peers in UI and have no staging runbook. Safe Live demo needs both.

## Current state

- API: `GET/POST/DELETE /api/gateway/bindings/[id]/peers` (workspace-scoped)
- Queries: `listPeerAllowlist`, `addPeerAllowlist`, `removePeerAllowlist`
- Client `gateway.ts` has no peer helpers
- Gateway tab: token, Live/Preview, probe — no peers section
- Ingress rejects non-allowlisted peers when `dm_policy` is allowlist/pairing

## Scope

**In scope**
- `src/web/src/lib/api/gateway.ts` — list/add/remove peer client helpers
- `src/web/src/app/(app)/w/[slug]/settings/gateway-tab.tsx` — peers UI per binding
- Settings labels (gateway peers EN/KM)
- Tests: pure helpers or gateway-tab label tests; client API types if tested
- `docs/gateway-live-runbook.md` (create) — Telegram Live path, Preview default, allowlist, probe, honesty
- `docs/parity-status.md` — note allowlist UI shipped; still intermediate Live claim

**Out of scope**
- OAuth marketplace, new providers
- Changing egress/ingress logic
- Returning secret_ref in any response

## Steps

1. Client API peers  
2. Gateway tab expandable peers list + add peer_id + remove  
3. Labels  
4. Runbook + parity honesty  

## Done criteria

- [ ] Operator can add/remove peer without curl
- [ ] secret never shown
- [ ] Runbook documents Live vs Preview and not full parity
- [ ] Tests for labels or client path

## STOP conditions

- Peers route missing or auth broken — fix route first or STOP

## Maintenance notes

When pairing flow auto-adds peers, UI should refresh list. Keep dm_policy select if missing for allowlist mode.
