# Plan 024: Gateway Live Telegram staging proof (ops + checklist automation)

> **Drift check**: `git diff --stat 4b268440..HEAD -- docs/gateway-live-runbook.md docs/parity-status.md src/web/src/lib/services/gateway-egress.ts`

## Status

- **Status**: DONE (see README for 024 operator pending)
- **Priority**: P2
- **Effort**: M (mostly ops; S code if only checklist)
- **Risk**: MED (touches live tokens — never commit secrets)
- **Depends on**: none for docs; Live proof depends on deployed control plane + bot token
- **Category**: direction / ops / docs
- **Planned at**: commit `4b268440`, 2026-07-19

## Why this matters

Code paths for vaulted token, Live mode, probe, peer allowlist, and egress exist, but **no signed staging receipt** proves Telegram Live on a real deploy. Residual “ops not code” — this plan makes the proof **repeatable and recordable** without claiming full Helio parity.

## Current state

- Runbook: `docs/gateway-live-runbook.md` (Preview default, probe, peers, Live, Activity)
- Parity: intermediate Live only; full commercial parity not claimed
- UI: Settings → Gateway + peers panel
- Egress: `gateway-egress.ts` on task complete when Live + secret

## Decision (locked)

| Question | Answer |
| --- | --- |
| Automate full Live send in CI? | **No** (needs secrets + external Telegram) |
| What to ship in repo | Checklist + evidence template + optional dry script |
| Marketing after green proof | Intermediate only: “Live Telegram when operator-configured” |

## Scope

**In scope**
- `docs/gateway-live-runbook.md` — expand to a **signed checklist** with checkbox steps + “Evidence to capture”
- `docs/parity-status.md` — optional “Staging proof” column/note: pending | recorded YYYY-MM-DD (operator fills after run)
- `docs/gateway-live-telegram-*.md (top-level; docs/ subdirs gitignored) — ` (create) — `CHECKLIST.md` + `EVIDENCE.template.md` (no secrets)
- Optional S code: `scripts/gateway-live-preflight.mjs` **read-only** checks (health URL, docs present) — **no** bot token, **no** send

**Out of scope**
- Committing bot tokens, chat ids that are private, or `.dev.vars`  
- Enabling Live by default  
- OAuth marketplace  
- Claiming full OpenClaw/Helio parity  

## Commands (operator staging — not CI)

Run against **your** control plane (example live-testing origin is not permanent identity):

```bash
# 0. Preconditions
pnpm --filter @phneakngar/web exec wrangler d1 migrations list phneakngar-app --remote
# expect 0054 applied

curl -sS "$CONTROL_PLANE/api/health" | head -c 200

# 1. Dashboard: Settings → Gateway
#    - binding provider=telegram, Preview
#    - paste bot token → Save (confirm has_secret)
#    - Probe → ok
#    - add peer allowlist ids if dm_policy=allowlist
#    - Set Live

# 2. Machine online: phneakngar chhlat start

# 3. Trigger egress path (task complete with channel/gateway delivery as implemented)

# 4. Verify Telegram message + Activity feed row gateway_egress_ok
```

**Never** paste tokens into git, issues, or plan evidence files. Evidence stores only: date, binding id prefix, probe ok boolean, message received yes/no, activity kind observed, operator initials.

## Steps

### Step 1: Evidence template

Create `docs/gateway-live-telegram-*.md (top-level; docs/ subdirs gitignored) — EVIDENCE.template.md`:

```markdown
# Gateway Live Telegram proof

- Date (UTC):
- Control-plane origin (no secrets):
- Binding id (prefix ok):
- Provider: telegram
- Probe ok: yes/no
- outbound_mode after test: live/preview
- has_secret: yes/no
- Peer allowlist used: yes/no
- Task id that triggered egress (prefix):
- Telegram message observed: yes/no
- Activity kind observed: gateway_egress_ok | gateway_egress_fail | none
- Notes / failures:
- Operator:
```

### Step 2: Runbook checklist sync

Update `docs/gateway-live-runbook.md` with ordered checkboxes matching the template + link to evidence dir. Add rollback (set Preview) already present — keep.

### Step 3: Operator executes proof (human)

Executor agent **cannot** complete this without secrets. After Step 1–2 land:

- STOP and hand checklist to operator, **or**
- If operator provides a **non-secret** confirmation (“probe ok, message received”), fill a **copy** of evidence file (not template) under `docs/gateway-live-telegram-*.md (top-level; docs/ subdirs gitignored) — EVIDENCE-YYYY-MM-DD.md` with only allowed fields.

### Step 4: Parity note

When evidence file exists with message observed = yes:

- Update `docs/parity-status.md` Live Slack/Telegram row with “staging proof recorded YYYY-MM-DD”  
- Still **not** full commercial parity  

## Test plan

- No unit tests required for docs-only  
- If preflight script added: node script exits 0 when `docs/gateway-live-runbook.md` exists and optional `CONTROL_PLANE` health returns 200  

## Done criteria

- [ ] Evidence template + runbook checklist in repo  
- [ ] No secrets in git (`rg -n "bot[0-9]:|[0-9]{8,}:[A-Za-z0-9_-]{20,}" docs/` clean of telegram tokens)  
- [ ] Operator proof either **recorded** or **explicitly left pending** in parity-status  
- [ ] Honesty: full Helio/OpenClaw parity still not claimed  

## STOP conditions

- Asked to commit a real bot token → refuse  
- Egress path for Telegram requires a task shape that no longer exists → STOP and report current trigger path from `gateway-egress.ts` / task complete hooks before rewriting runbook  

## Maintenance notes

Re-run proof after any change to `gateway-egress.ts`, binding secret storage, or webhook ingress. Keep evidence files free of PII beyond what the operator accepts.
