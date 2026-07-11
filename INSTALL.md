# Install Agents on a client machine

This is the **single client install guide** for running ភ្នាក់ងារ Agents on a machine.
You do **not** need to clone this monorepo, install Cloudflare tools, or deploy Workers.

Agents run as a background **daemon** (`@phneakngar/cli` → command `phneakngar`). The daemon connects to your control plane, receives tasks, and executes them with a local AI runtime (`claude`, `codex`, `opencode`, or `grok`).

For operator Cloudflare deploys, see [DEPLOY.md](DEPLOY.md). For full local self-host of the web stack, see [src/app/README.md](src/app/README.md).

---

## Production control plane (this deployment)

| Item | Value |
| --- | --- |
| **Cloudflare Worker** | `phneakngar-web` |
| **Public origin** | `https://phneakngar-web.thatsilenceguy.workers.dev` |
| **Health** | `https://phneakngar-web.thatsilenceguy.workers.dev/api/health` |
| **Dashboard** | `https://phneakngar-web.thatsilenceguy.workers.dev` |
| **Email domain** | **`cieee.xyz`** (Cloudflare Email Routing + Sending) |
| **OTP / system From** | `no-reply@cieee.xyz` |
| **Agent addresses** | `{handle}@cieee.xyz` |

This origin is the CLI default (`DEFAULT_BASE_URL` in `@phneakngar/shared`). Override only if you run a different environment.

```bash
# optional override
phneakngar config set-server https://phneakngar-web.thatsilenceguy.workers.dev
# or
export PHNEAKNGAR_SERVER_URL=https://phneakngar-web.thatsilenceguy.workers.dev
```

---

## Quick start (clean machine)

### Requirements

| Requirement | Supported |
| --- | --- |
| **Node.js** | `>= 20.19.0` (LTS recommended) |
| **OS** | macOS, Linux, Windows (Node.js) |
| **npm** | Comes with Node.js |
| **AI runtime** | At least one of: [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [Codex](https://openai.com/index/introducing-codex/), [OpenCode](https://github.com/opencode-ai/opencode), [Grok CLI](https://x.ai/cli) |
| **Network** | Outbound HTTPS to `https://phneakngar-web.thatsilenceguy.workers.dev` |

You do **not** need pnpm, Bun, Wrangler, Docker, or a Cloudflare account on the agent machine.

### Install the CLI

> **Status (2026-07-11):** `@phneakngar/cli` is **not on the public npm registry yet**  
> (`npm install -g @phneakngar/cli` → **404**). Use the monorepo pack path below until a
> `release: vX.Y.Z` publish completes (see [src/cli/RELEASING.md](src/cli/RELEASING.md)).

**Working install today (from this monorepo):**

```bash
cd /path/to/phneakngar   # this repository
cd src/cli
pnpm run build
npm pack
npm install --global "$(pwd)/phneakngar-cli-0.0.149.tgz"

# ensure npm's global bin is on PATH (Homebrew Node example):
#   export PATH="$(npm prefix -g)/bin:$PATH"
# or install into Homebrew prefix:
#   npm install --global --prefix /opt/homebrew ./phneakngar-cli-0.0.149.tgz

phneakngar version
```

**From a copied tarball (client machine without monorepo):**

```bash
# Operator sends you phneakngar-cli-0.0.149.tgz, then:
npm install --global ./phneakngar-cli-0.0.149.tgz
phneakngar version
```

**After the package is published to npmjs.org:**

```bash
# Prefer the official registry (mirrors may lag or 404):
npm install --global @phneakngar/cli --registry=https://registry.npmjs.org
phneakngar version
```

**One-shot from local package folder (no global bin):**

```bash
node /path/to/node_modules/@phneakngar/cli/dist/index.js doctor
```

### Initialize, diagnose, register, start

```bash
phneakngar init
phneakngar doctor

# Browser login (recommended)
phneakngar login

# Or machine token from the dashboard (starts with al_):
# phneakngar register --token al_xxxxxxxxxxxxxxxxxxxxxxxx

phneakngar daemon start
phneakngar status
phneakngar doctor
```

Expected healthy doctor result after login + daemon start: no `FAIL` lines; **Server** and **Daemon health** should be `PASS`.

---

## Day-to-day commands

| Goal | Command |
| --- | --- |
| Start agents | `phneakngar daemon start` |
| Check daemon | `phneakngar daemon status` |
| Full status | `phneakngar status` |
| Diagnostics | `phneakngar doctor` |
| View logs | `phneakngar logs` |
| Log path only | `phneakngar logs --path-only` |
| Stop agents | `phneakngar daemon stop` |
| CLI version | `phneakngar version` |
| Show config | `phneakngar config show` |
| Config path | `phneakngar config path` |
| Set server URL | `phneakngar config set-server <url>` |

Foreground debug:

```bash
phneakngar daemon start --foreground
```

---

## Configuration

### Files

| Path | Purpose |
| --- | --- |
| `~/.phneakngar/config.json` | Server URL, profiles, workspace tokens |
| `~/.phneakngar/daemon.pid` | Daemon process id |
| `~/.phneakngar/daemon/logs/YYYY-MM-DD.log` | Daemon logs |
| `~/.phneakngar/workspaces/` | Per-task workspace directories |

Config directory mode is `0700`; `config.json` is written as `0600`.

Override the config root (tests / multi-instance):

```bash
export PHNEAKNGAR_PROJECT_ROOT=/var/lib/phneakngar
```

### Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `PHNEAKNGAR_SERVER_URL` | No | Control plane base URL (default: Cloudflare workers.dev origin above) |
| `PHNEAKNGAR_PROJECT_ROOT` | No | Config/state directory (default `~/.phneakngar`) |
| `PHNEAKNGAR_AGENT_ID` | Sometimes | Default agent id for some commands |
| `PHNEAKNGAR_HEALTH_PORT` | No | Local daemon health port (default `19514`) |
| `PHNEAKNGAR_CLAUDE_PATH` | No | Path to `claude` binary |
| `PHNEAKNGAR_CODEX_PATH` | No | Path to `codex` binary |
| `PHNEAKNGAR_OPENCODE_PATH` | No | Path to `opencode` binary |
| `PHNEAKNGAR_GROK_PATH` | No | Path to `grok` binary |
| `PHNEAKNGAR_*_MODEL` | No | Model overrides per provider |
| `XAI_API_KEY` | For Grok API mode | Alternative to `grok login` |
| `PHNEAKNGAR_DAEMON_MAX_CONCURRENT_TASKS` | No | Default `20` |
| `PHNEAKNGAR_SHUTDOWN_TIMEOUT_MS` | No | Graceful stop wait (default `5000`) |

### Secrets

- Machine tokens (`al_…`) live in `~/.phneakngar/config.json` with mode `0600`.
- Do **not** commit tokens or paste them into tickets/chat.
- Rotate tokens from the dashboard if a machine is lost.
- AI provider credentials stay with provider CLIs (`claude`, `codex`, `grok login`, etc.).

---

## Update

```bash
phneakngar daemon stop
npm install --global @phneakngar/cli@latest
phneakngar version
phneakngar doctor
phneakngar daemon start
```

Or:

```bash
phneakngar update
```

From a new tarball:

```bash
phneakngar daemon stop
npm install --global ./phneakngar-cli-<version>.tgz
phneakngar daemon start
```

---

## Uninstall

```bash
phneakngar daemon stop
npm uninstall --global @phneakngar/cli
# Optional: remove local state (destructive)
rm -rf ~/.phneakngar
```

---

## Troubleshooting

| Symptom | What to try |
| --- | --- |
| `command not found: phneakngar` | Put npm global bin on `PATH`, or use `npx @phneakngar/cli`. |
| `doctor` FAIL: AI runtimes | Install/authenticate `claude`, `codex`, `opencode`, or `grok` on `PATH`. |
| `doctor` FAIL: Registration | Run `phneakngar login` or `register --token`. |
| Server WARN / unreachable | Confirm origin: `curl -sS https://phneakngar-web.thatsilenceguy.workers.dev/api/health`. Set `phneakngar config set-server …` if needed. |
| `login` → `invalid_client` | Operator must set Worker secret `DEVICE_CLIENT_IDS=phneakngar-cli` on `phneakngar-web` (see [DEPLOY.md](DEPLOY.md)). |
| Daemon exits immediately | `phneakngar logs` + `phneakngar doctor`. |
| Stale pidfile | `phneakngar daemon stop` then `phneakngar daemon start`. |
| Tasks not arriving | Control plane up, CLI ≥ server `MIN_CLI_VERSION`, daemon running, agent online in dashboard. |
| Grok not detected | Install [Grok CLI](https://x.ai/cli); `grok login` or `XAI_API_KEY`. |

Local daemon health:

```bash
curl -sS "http://127.0.0.1:${PHNEAKNGAR_HEALTH_PORT:-19514}/health"
```

Control plane health:

```bash
curl -sS https://phneakngar-web.thatsilenceguy.workers.dev/api/health
```

---

## Email notes

Outbound (OTP, agent mail) and inbound both require a **Cloudflare-onboarded zone**. This deployment uses **`cieee.xyz`**:

- Outbound: Worker `SEND_EMAIL` binding, From `*@cieee.xyz`
- Inbound: Email Routing rule `to:*@cieee.xyz` → `phneakngar-email-worker`
- Env: `PHNEAKNGAR_DOMAIN=cieee.xyz` on web + email Workers

If you stop receiving mail:

1. `pnpm exec wrangler email sending settings cieee.xyz` — must be enabled  
2. `pnpm exec wrangler email routing rules list cieee.xyz` — worker rule enabled  
3. Confirm agent handles and OTP From use `@cieee.xyz`, not `@phneakngar.ai`  
4. Check spam for `no-reply@cieee.xyz`

## Security

- Treat machine tokens as credentials.
- Restrict who can log into the agent machine — the daemon can run coding agents with local filesystem access.
- Keep the control plane on HTTPS (Cloudflare workers.dev is HTTPS by default).
- Review provider CLI permissions and workspace roots under `~/.phneakngar/workspaces`.
- Do not run the daemon as a shared multi-user root service without isolation.

---

## Development setup (contributors)

```bash
pnpm install --frozen-lockfile
pnpm --filter @phneakngar/cli test
pnpm --filter @phneakngar/cli build
PHNEAKNGAR_SERVER_URL=http://localhost:15210 pnpm dev:cli
```

See [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/source-map.md](docs/source-map.md).

---

## Release and publishing (operators)

Packages publish only on a validated `release: vX.Y.Z` commit via GitHub Actions (npm Trusted Publishers). See [docs/release-checklist.md](docs/release-checklist.md) and [src/cli/RELEASING.md](src/cli/RELEASING.md).

```bash
# from monorepo root — does not publish
pnpm verify:cli-package
```

Manual pack:

```bash
cd src/cli
pnpm run build
npm pack
npm install --global ./phneakngar-cli-*.tgz
phneakngar doctor
```

---

## Optional: full local stack (`@phneakngar/app`)

Only if you need web + workers on the same machine (not required for agent-only clients):

```bash
npx @phneakngar/app onboard
```

See [src/app/README.md](src/app/README.md).

---

## Concise command checklist

```bash
npm install --global @phneakngar/cli   # or install the .tgz
phneakngar init
phneakngar doctor
phneakngar login                      # or: register --token al_...
phneakngar daemon start
phneakngar status
phneakngar logs
phneakngar daemon stop
```
