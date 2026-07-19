# Install agents on a client machine

This is the client install guide for running ភ្នាក់ងារ agents against an existing control plane. You do not need to deploy the web stack, Cloudflare Workers, or D1 on an agent-only machine.

Agents run through the `phneakngar` command from `@phneakngar/cli`. Its background **chhlat** connects to the configured control plane, receives tasks, and executes them with a local AI runtime.

For the full local control plane, see [src/app/README.md](src/app/README.md). For operator Cloudflare deployment, see [DEPLOY.md](DEPLOY.md).

## Current live-testing deployment

These values describe the deployment currently used for live testing. They are operational defaults for that environment, not permanent canonical product identity.

| Item | Current live-testing value |
| --- | --- |
| Control-plane origin | `https://phneakngar-web.thatsilenceguy.workers.dev` |
| Health endpoint | `https://phneakngar-web.thatsilenceguy.workers.dev/api/health` |
| Email domain | `cieee.xyz` |
| OTP/system sender | `no-reply@cieee.xyz` |
| Agent addresses | `{handle}@cieee.xyz` |

Operators and self-hosters should provide their own origin and email domain. This project does not define a permanent public domain. To use another control plane:

```bash
phneakngar config set-server https://your-control-plane.example
# macOS/Linux alternative for the current shell
export PHNEAKNGAR_SERVER_URL=https://your-control-plane.example
```

```powershell
# Windows PowerShell alternative for the current shell
$env:PHNEAKNGAR_SERVER_URL = "https://your-control-plane.example"
```

## Requirements

| Requirement | Supported |
| --- | --- |
| Node.js | `>=20.19.0` |
| OS | macOS, Linux, or Windows with Node.js |
| AI runtime | At least one of Claude Code, Codex, OpenCode, or Grok CLI |
| Network | Outbound HTTPS to the operator-provided control-plane origin |

### Optional: lean web brain (search / fetch / extract / crawl / diff)

The CLI includes a small first-party **web brain** (`@phneakngar/web-brain`) for live web tools with a local disk cache. It does **not** install wigolo, ONNX models, or a browser engine (disk delta is intentionally small). Package license for adapted upstream code is AGPL-3.0 under `@phneakngar/web-brain`; the CLI remains Apache-2.0.

**Showcase (offline then live):**

```bash
phneakngar web status
phneakngar web search "postgres logical replication" --mock   # offline demo
phneakngar web search "postgres logical replication"          # live (ddg-lite)
phneakngar web fetch https://example.com
phneakngar web extract https://example.com --mode metadata
phneakngar web crawl https://example.com --max-depth 1 --max-pages 5
phneakngar web diff https://example.com   # cache vs fresh fetch
phneakngar web wire-mcp    # Codex + Claude + Grok MCP tools
phneakngar doctor          # includes "Web brain" readiness + MCP wire hint
```

Cache files live under `~/.phneakngar/web-cache/` (or `$PHNEAKNGAR_PROJECT_ROOT/web-cache`).

MCP tools (when wired): `web_search`, `web_fetch`, `web_cache`, `web_extract`, `web_crawl`, `web_diff`.

### Approval hold (human desk)

High-stakes tool calls create a durable approval and **hold** until you decide in the dashboard Approvals inbox (default **on** via agent `runtime_config.approvalHold`). Force off on a machine:

```bash
export CHHLAT_APPROVAL_HOLD=0   # or PHNEAKNGAR_APPROVAL_HOLD=0
```

### 10-minute path (personal company)

1. Open the control-plane dashboard and create/join a workspace.
2. Connect a machine: `phneakngar login` → copy register token from Home → `phneakngar register --token …` → `phneakngar chhlat start`.
3. Create a first agent (Studio or Agents) and confirm runtime online.
4. Optional: `phneakngar web wire-mcp` so agents can search/fetch the live web.
5. Send a test DM or email; open **Approvals** if a tool pauses; open **Activity** for the company pulse.
6. Optional Live Telegram: Settings → Gateway (see [docs/gateway-live-runbook.md](docs/gateway-live-runbook.md)).

An agent-only machine does not need pnpm, Bun, Wrangler, Docker, or a Cloudflare account.

Shell snippets use POSIX syntax unless a PowerShell alternative is shown. The `phneakngar config set-server` command is portable and preferred over environment-variable syntax on Windows.

## Install the CLI

### Published npm package

`@phneakngar/cli` is published under the public `@phneakngar` npm scope. This checkout is configured for release `0.0.1`; install `@phneakngar/cli@0.0.1` explicitly when you need this release.

Use the explicit version for reproducible installs:

macOS:

```bash
node --version  # must be >=20.19.0
npm install --global @phneakngar/cli@0.0.1
phneakngar version
```

Linux:

```bash
node --version  # must be >=20.19.0
npm install --global @phneakngar/cli@0.0.1
phneakngar version
```

Windows PowerShell:

```powershell
node --version  # must be >=20.19.0
npm install --global @phneakngar/cli@0.0.1
phneakngar version
```

### Alternative: install an operator-provided tarball

This path still requires Node.js `>=20.19.0`. Unless the runtime dependencies are already cached, npm also needs access to the configured npm registry; the CLI tarball is not a fully offline bundle.

```bash
npm install --global ./phneakngar-cli-X.Y.Z.tgz
phneakngar version
```

Replace `X.Y.Z` with the tarball version supplied by the operator.

### Alternative: build the tarball from this repository

This build path requires the repository toolchain: Node.js `>=20.19.0`, pnpm `10.33.0`, and Bun `1.3.14`.

macOS/Linux:

```bash
cd /path/to/phneakngar
pnpm install --frozen-lockfile
pnpm pack:cli
npm install --global "./src/cli/phneakngar-cli-$(node -p "require('./src/cli/package.json').version").tgz"
phneakngar version
```

Windows PowerShell:

```powershell
Set-Location C:\path\to\phneakngar
pnpm install --frozen-lockfile
pnpm pack:cli
$version = node -p "require('./src/cli/package.json').version"
npm install --global "./src/cli/phneakngar-cli-$version.tgz"
phneakngar version
```

If `phneakngar` is not found after install, check npm's global binary path:

```bash
export PATH="$(npm prefix --global)/bin:$PATH"
```

The `export` updates only the current shell. Add the same line to the appropriate shell profile if the change must persist.

```powershell
npm prefix --global
```

On Windows, add the returned directory to the user `PATH` if Node.js installation did not configure it automatically.

## Initialize, diagnose, register, and start

Run one command at a time:

```bash
phneakngar init
phneakngar doctor
```

Sign in to the dashboard supplied by your operator, then link the machine with one of these methods:

```bash
# Browser device login
phneakngar login

# Or use a machine token from the dashboard
phneakngar register --token al_xxxxxxxxxxxxxxxxxxxxxxxx
```

Start chhlat only after registration succeeds:

```bash
phneakngar status
phneakngar chhlat start
phneakngar doctor
```

For the current live-testing deployment, the sign-in page is:

```text
https://phneakngar-web.thatsilenceguy.workers.dev/sign-in
```

OTP mail for that live-testing deployment currently comes from `no-reply@cieee.xyz`. Those values can change and are not permanent identity.

If device login reports an expired code, sign in first, run `phneakngar login` again, and approve within the displayed time limit.

## Day-to-day commands

| Goal | Command |
| --- | --- |
| Start agents | `phneakngar chhlat start` |
| Check chhlat | `phneakngar chhlat status` |
| Full status | `phneakngar status` |
| Diagnostics | `phneakngar doctor` |
| View logs | `phneakngar logs` |
| Show log path | `phneakngar logs --path-only` |
| Stop agents | `phneakngar chhlat stop` |
| CLI version | `phneakngar version` |
| Show configuration | `phneakngar config show` |
| Show config path | `phneakngar config path` |
| Set server URL | `phneakngar config set-server <url>` |

Foreground debugging:

```bash
phneakngar chhlat start --foreground
```

## Configuration

### Files

| Path | Purpose |
| --- | --- |
| `~/.phneakngar/config.json` | Server URL, profiles, and workspace tokens |
| `~/.phneakngar/chhlat.pid` | Chhlat process ID |
| `~/.phneakngar/chhlat/logs/YYYY-MM-DD.log` | Chhlat logs |
| `~/.phneakngar/workspaces/` | Per-task workspaces |

The config directory uses mode `0700`; `config.json` is written with mode `0600`.

Override the local config/state root for tests or multiple instances:

```bash
# macOS/Linux
export PHNEAKNGAR_PROJECT_ROOT=/var/lib/phneakngar
```

```powershell
# Windows PowerShell
$env:PHNEAKNGAR_PROJECT_ROOT = "C:\phneakngar-state"
```

### Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `PHNEAKNGAR_SERVER_URL` | No | Control-plane base URL; set this for a non-default environment |
| `PHNEAKNGAR_PROJECT_ROOT` | No | Config/state root; defaults to `~/.phneakngar` |
| `PHNEAKNGAR_AGENT_ID` | Sometimes | Default agent ID for commands that require one |
| `PHNEAKNGAR_HEALTH_PORT` | No | Local chhlat health port; defaults to `19514` |
| `PHNEAKNGAR_CLAUDE_PATH` | No | Path to the `claude` binary |
| `PHNEAKNGAR_CODEX_PATH` | No | Path to the `codex` binary |
| `PHNEAKNGAR_OPENCODE_PATH` | No | Path to the `opencode` binary |
| `PHNEAKNGAR_GROK_PATH` | No | Path to the `grok` binary |
| `PHNEAKNGAR_*_MODEL` | No | Per-provider model override |
| `XAI_API_KEY` | Grok API mode | Alternative to `grok login` |
| `PHNEAKNGAR_CHHLAT_MAX_CONCURRENT_TASKS` | No | Maximum concurrent tasks; defaults to `20` |
| `PHNEAKNGAR_SHUTDOWN_TIMEOUT_MS` | No | Graceful stop timeout; defaults to `5000` ms |

### Secrets

- Machine tokens (`al_…`) are credentials. Do not commit them or paste them into tickets or chat.
- Rotate tokens from the dashboard if a machine is lost.
- AI-provider credentials stay with their provider CLIs.

## Update

```bash
phneakngar chhlat stop
npm install --global @phneakngar/cli@0.0.1
phneakngar version
phneakngar doctor
phneakngar chhlat start
```

`phneakngar update` uses the configured public package channel. For pinned production rollouts, prefer an explicit `npm install --global @phneakngar/cli@0.0.1` step.

## Uninstall

macOS/Linux:

```bash
phneakngar chhlat stop
npm uninstall --global @phneakngar/cli
# Optional and destructive: remove local state
rm -rf ~/.phneakngar
```

Windows PowerShell:

```powershell
phneakngar chhlat stop
npm uninstall --global @phneakngar/cli
# Optional and destructive: remove local state
Remove-Item -Recurse -Force "$HOME\.phneakngar"
```

## Troubleshooting

| Symptom | What to try |
| --- | --- |
| `command not found: phneakngar` | Add `$(npm prefix --global)/bin` to `PATH`, then reinstall `@phneakngar/cli` if needed. |
| `doctor` reports no AI runtime | Install and authenticate Claude Code, Codex, OpenCode, or Grok CLI. |
| `doctor` reports no registration | Run `phneakngar login` or `phneakngar register --token …`. |
| Server unreachable | Confirm the operator-provided origin and run `phneakngar config set-server <url>`. |
| Chhlat exits immediately | Run `phneakngar logs` and `phneakngar doctor`. |
| Stale PID file | Run `phneakngar chhlat stop`, then `phneakngar chhlat start`. |
| Tasks do not arrive | Check control-plane health, registration, minimum CLI version, chhlat status, and agent status in the dashboard. |

Local chhlat health:

```bash
# macOS/Linux
curl -sS "http://127.0.0.1:${PHNEAKNGAR_HEALTH_PORT:-19514}/health"
```

```powershell
# Windows PowerShell
Invoke-RestMethod "http://127.0.0.1:19514/health"
```

Current live-testing control-plane health:

```bash
curl -sS https://phneakngar-web.thatsilenceguy.workers.dev/api/health
```

## Email notes for the current live-testing deployment

The current test environment uses `cieee.xyz` with Cloudflare Email Routing and Sending:

- Outbound sender: `*@cieee.xyz`
- Inbound route: `*@cieee.xyz` to `phneakngar-email-worker`
- Worker configuration: `PHNEAKNGAR_DOMAIN=cieee.xyz`

This is deployment-specific, not a permanent canonical domain. Other environments must configure and validate their own Cloudflare-onboarded email zone.

## Development setup for contributors

```bash
pnpm install --frozen-lockfile
pnpm --filter @phneakngar/cli test
pnpm --filter @phneakngar/cli build
# macOS/Linux
PHNEAKNGAR_SERVER_URL=http://localhost:15210 pnpm dev:cli
```

```powershell
# Windows PowerShell (the root dev:cli script uses POSIX inline assignments)
$env:PHNEAKNGAR_SERVER_URL = "http://localhost:15210"
$env:PHNEAKNGAR_WS_DO_PORT = "15212"
$env:PHNEAKNGAR_PROJECT_ROOT = Join-Path (Get-Location) ".phneakngar"
$env:PHNEAKNGAR_HEALTH_PORT = "19515"
pnpm --filter @phneakngar/cli dev
```

See [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/source-map.md](docs/source-map.md).

## Release and packaging for operators

Package publishing is handled by validated `release: vX.Y.Z` commits. See [docs/release-checklist.md](docs/release-checklist.md) and [src/cli/RELEASING.md](src/cli/RELEASING.md).

```bash
# Validate, build, pack, install, and smoke-test the CLI package locally
pnpm verify:cli-package
```

## Optional full local stack

For local development from this repository:

```bash
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm dev:app onboard
```

For the public npm app wrapper on macOS/Linux:

```bash
npx @phneakngar/app@0.0.1 onboard
```

Full local `@phneakngar/app` mode is currently documented for macOS/Linux. Windows remains supported for the agent-only CLI path above, but do not advertise Windows app support until a Windows PowerShell smoke proves local Wrangler services, process cleanup, migrations, and `phneakngar-app start/stop` all pass.

Operators should validate the app package before release:

```bash
pnpm verify:app-package
```

Use the agent-only CLI install path on Windows for now. Full local `@phneakngar/app` mode is not advertised for Windows until a Windows PowerShell smoke proves local Wrangler services, process cleanup, migrations, and `phneakngar-app start/stop` all pass.

See [src/app/README.md](src/app/README.md) for details.
