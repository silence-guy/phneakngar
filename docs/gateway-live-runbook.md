# Gateway Live runbook (intermediate)

**Honesty:** Full commercial Helio/OpenClaw parity is **not** claimed. This runbook covers operator-configured **Telegram** (and similarly Slack) Live egress with vaulted bot tokens and peer allowlist.

**Staging proof artifacts:** [docs/gateway-live-telegram-proof/](./) — fill `EVIDENCE.template.md` after a real run (never commit bot tokens).

## Prerequisites

- [ ] Workspace with at least one agent and an online chhlat machine
- [ ] Bot token from Telegram BotFather (or Slack bot token) — treat as secret
- [ ] Control-plane Settings → **Gateway** tab
- [ ] Remote D1 migrations through `0054` applied when using production

```bash
pnpm --filter @phneakngar/web exec wrangler d1 migrations list phneakngar-app --remote
curl -sS "$CONTROL_PLANE/api/health" | head -c 200
```

## Safe defaults

| Setting | Safe value | Notes |
| --- | --- | --- |
| `outbound_mode` | **Preview** | Formats payloads only; no live send |
| Bot token | empty until ready | Write-only; UI shows `has_secret` only |
| `dm_policy` | `open` or `allowlist` | Use **allowlist** before Live DMs |

## Telegram Live path (checklist)

1. [ ] **Create binding** — Provider `telegram`, external team/chat id as required, select agent, leave **Preview**.
2. [ ] **Save bot token** — paste once; confirm “Token vaulted”. Token is never returned by list/get APIs.
3. [ ] **Probe** — Probe button runs provider ping (`getMe` / equivalent). Fix token before Live.
4. [ ] **Peer allowlist** — Add trusted Telegram user ids under the binding’s peer list when using allowlist/pairing DM policy.
5. [ ] **Set Live** — Only after probe ok + token vaulted. Live without token is flagged as risk in doctor.
6. [ ] **Machine online** — `phneakngar chhlat start` (or desktop equivalent).
7. [ ] **Trigger egress** — Complete a task that triggers channel/gateway egress — message should post when Live + token present.
8. [ ] **Activity** — Open workspace **Activity**; expect `gateway_egress_ok` (or diagnose `gateway_egress_fail`).
9. [ ] **Record evidence** — Copy [gateway-live-telegram-evidence.template.md](./gateway-live-telegram-evidence.template.md) → `EVIDENCE-YYYY-MM-DD.md` with **no secrets**.

## Slack

Same flow with provider `slack`. Live send only when binding is Live and token vaulted. Other providers may remain Preview-only.

## Rollback

- [ ] Set binding back to **Preview** immediately.
- [ ] Remove peer entries or disable binding status if needed.
- [ ] Rotate bot token at the provider if leaked; re-save vaulted secret.

## Non-claims

- No OAuth marketplace install
- No multi-region multi-gateway mesh
- No “works with all chat apps” marketing without Live vs Preview matrix
- Full commercial Helio/OpenClaw parity is **not** claimed after a single Telegram proof
