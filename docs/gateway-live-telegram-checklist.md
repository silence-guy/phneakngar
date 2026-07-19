# Gateway Live Telegram — operator checklist

Mirror of [docs/gateway-live-runbook.md](./gateway-live-runbook.md). Check boxes during staging. Do **not** paste bot tokens here or into git.

## Preflight

- [ ] Control-plane health 200
- [ ] D1 through `0054` on target environment
- [ ] Agent + chhlat online
- [ ] Telegram bot created (token kept out of repo)

## Path

- [ ] Binding created (Preview)
- [ ] Token vaulted (`has_secret`)
- [ ] Probe ok
- [ ] Peers added if allowlist/pairing
- [ ] Set Live
- [ ] Task completed → Telegram message observed
- [ ] Activity shows `gateway_egress_ok`
- [ ] Evidence file filled from template (no secrets)

## Aftercare

- [ ] Set Preview if not keeping Live
- [ ] Update `docs/parity-status.md` staging note only if evidence recorded
