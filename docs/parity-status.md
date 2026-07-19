# Helio / OpenClaw parity status

**Last updated:** 2026-07-17  
**Canonical plan:** `plans/2026-07-16-full-commercial-helio-openclaw-parity.md` (local)  
**Residual plan:** `plans/2026-07-17-commercial-residual-egress-hitl.md`  
**Audit:** `docs/agent-work/full-commercial-helio-openclaw-verify/AUDIT.md`

## Claim (current)

> **Full commercial Helio/OpenClaw parity is not claimed.**

Residual control-plane MVPs, productized UI, monorepo-green tests, and in-progress commercial foundations do **not** equal live multi-channel / marketplace / OAuth commercial parity.

| Claim | Status |
| --- | --- |
| Helio residual control-plane MVPs | Shipped (`0050`–`0052`, productize) |
| Multi-party DM (schema + API + UI) | MVP shipped — `0052` applied on remote D1 (2026-07-16) |
| Approval inbox (outbound email) | Productized MVP |
| Scenario install ensure-path | Ensure + install **health** (`assess`/`report` + studios `scenario_path.health` gaps) |
| Approvals multi-kind UI | Icons + payload summaries for email / tool / skill / automation promote |
| Integrations settings UI | Agent settings → Integrations tab (GitHub/Linear vault pointer); `secret_ref` never returned |
| Skills lifecycle | Propose → skill_install approval → install; agent skills list read-only; marketplace not claimed |
| Automation reliability UX | Last run + overdue chip on automations list |
| CLI↔approval bridge (WP8) | High-stakes control_request creates durable `tool_action` via machine `POST /api/chhlat/approvals`; hold/resume via product default + poll (see Approval hold product) |
| Doctor / dry binding health (WP16) | Dry-config binding + webhook-secret assessors; workspace-health `checks.gateway`; `/api/health` gateway_webhook fail-closed; Gateway tab doctor row; Live risk/not-verified — **no live provider probes** |
| Timeline + inbox polish (WP17–18 partial) | Race-safe inbox_unread + conversation_map getOrCreate; thin email system events via timeline-chrome on send/approve; company Activity UI ships separately (see Activity feed MVP) |
| Gateway ingress (5 providers) | D1 `gateway_binding` first + env map bootstrap; shared secret; optional Telegram/Slack provider secrets; bot-loop + dedupe |
| Gateway outbound | Format stubs + **production live egress** for Telegram/Slack when binding `outbound_mode=live` + vaulted `secret_ref` (wired from task complete); other providers preview |
| Bot token install (vault) | Settings → Gateway: write-only bot token (`secret_ref`); `has_secret` only on list/get; probe button (getMe / auth.test) |
| CLI hold/resume after approval | Product default **on** via `runtime_config.approvalHold`; env `CHHLAT_APPROVAL_HOLD=0` forces off; polls until approve/deny/timeout |
| Activity feed MVP | `activity_event` table + `GET /api/activity` + **workspace Activity UI** (`/w/[slug]/activity`); events on approve / egress / probe / automation_due |
| Approval hold product | Agent `runtime_config.approvalHold` (default on) + env force; CLI session wires runtime config |
| Lean web-brain toolkit | `@phneakngar/web-brain` search/fetch/extract/crawl/diff + MCP wire + doctor — **not** full wigolo/ML |
| Gateway peer allowlist UI | Settings → Gateway peers list/add/remove; Live path intermediate only (see `docs/gateway-live-runbook.md`) |
| Bindings admin (D1) | MVP shipped (`0053`/`0054` + Settings → Gateway tab) — apply `0054` on remote when ready |
| Live Slack/Telegram send in production | **Intermediate only** — requires operator-set live + token; no OAuth marketplace / multi-region claim |
| Heartbeat ambient checks | Pure helpers + automation skill_name hook; delivery quiet path partial |
| Remote D1 `0050`–`0053` | **Applied** on `phneakngar-app` remote (2026-07-16); re-list shows no pending migrations |
| Remote D1 `0054` | **Applied** on `phneakngar-app` remote (2026-07-17) via `pnpm db:migrate:remote`; re-list shows no pending |
| Full commercial Helio/OpenClaw parity | **Not claimed** |

## Forbidden marketing phrases until plan exit

- “Full commercial Helio parity”
- “Full OpenClaw parity”
- “Works with Slack/Teams/…” without listing Live vs Preview and staging proof
- “OAuth marketplace” / “ClawHub equivalent” without skills verify lifecycle

## Deploy note

**Remote `phneakngar-app` (2026-07-16):** `0050`–`0053` applied via `pnpm db:migrate:remote`; list shows **no migrations to apply**.

Additive migrations for multi-party, approvals foundations, and gateway bindings:

- `0050_helio_parity_foundations.sql`
- `0051_artifact_delivery_task.sql`
- `0052_conversation_member.sql`
- `0053_gateway_commercial_foundations.sql` (bindings, peer allowlist, ingress dedupe)

```bash
pnpm --filter @phneakngar/web exec wrangler d1 migrations list phneakngar-app --remote
pnpm db:migrate:remote   # only when list shows pending
```

## Phase ladder (summary)

| Phase | Meaning | Claim when green |
| --- | --- | --- |
| 0 | Honesty + migrations | Still not full parity |
| A | Control-plane commercial | Control-plane ready; live send limited |
| B | Live multi-channel commercial | Parity for **listed Live** providers only |
| C | Enterprise shell | Optional enterprise commercial |

See the full plan for exit checklists.
