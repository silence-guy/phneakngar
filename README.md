<p align="center">
  <img src="./assets/readme-banner.png" alt="ភ្នាក់ងារ — an open-source platform for running your personal AI company" width="800" />
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg" alt="License" /></a>
</p>

<p align="center">
  <strong>English</strong>
  ·
  <a href="README.km.md">ភាសាខ្មែរ</a>
  ·
  <a href="INSTALL.md">Install an agent machine</a>
  ·
  <a href="CONTRIBUTING.md">Contribute</a>
</p>

## What is ភ្នាក់ងារ?

**ភ្នាក់ងារ** is an open-source, self-hostable platform that turns local AI coding agents into AI teammates you can assign recurring work to. Each teammate has a role, an email address, and an always-on local runtime.

Teammates run on your machines with the tools and codebases you permit. ភ្នាក់ងារ connects them to email, a dashboard, calendars, tasks, approvals, and each other — so ownership and delivery stay explicit, not one-off chat prompts.

<p align="center">
  <img src="./assets/phneakngar-org_rounded.png" alt="ភ្នាក់ងារ organization view" width="700" />
</p>

## Install

The npm packages are published under the `@phneakngar` scope. This checkout is configured for release `0.0.3`; use explicit `@0.0.3` installs when you want this release rather than another dist-tag.

### Agent-only machine

Use this path when the control plane already exists. Install the `0.0.3` CLI release from public npm, then initialize and connect the machine. The complete guide is [INSTALL.md](INSTALL.md).

macOS:

```bash
node --version  # must be >=20.19.0
npm install --global @phneakngar/cli@0.0.3
phneakngar version
phneakngar init
phneakngar doctor
phneakngar login
phneakngar chhlat start
```

Linux:

```bash
node --version  # must be >=20.19.0
npm install --global @phneakngar/cli@0.0.3
phneakngar version
phneakngar init
phneakngar doctor
phneakngar login
phneakngar chhlat start
```

Windows PowerShell:

```powershell
node --version  # must be >=20.19.0
npm install --global @phneakngar/cli@0.0.3
phneakngar version
phneakngar init
phneakngar doctor
phneakngar login
phneakngar chhlat start
```

### Full local stack for development

**Required toolchain:**

- Node.js `>=20.19.0`
- pnpm `10.33.0`
- Bun `1.3.14`

```bash
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm dev:app onboard
```

Open `http://localhost:15210` when the services are ready. If you need to run the services separately:

```bash
WATCHPACK_POLLING=true WATCHPACK_POLLING_INTERVAL=1000 pnpm --filter @phneakngar/web exec next dev --port 15210
pnpm --filter @phneakngar/email-worker exec wrangler dev --port 15211 --persist-to ../web/.wrangler/state
pnpm --filter @phneakngar/ws-do exec wrangler dev --port 15212 --persist-to ../web/.wrangler/state
```

| Service | Local URL |
| --- | --- |
| Web app | `http://localhost:15210` |
| Email Worker | `http://localhost:15211` |
| WebSocket Worker | `http://localhost:15212` |

Install the `0.0.3` app wrapper from public npm:

macOS/Linux:

```bash
npx @phneakngar/app@0.0.3 onboard
```

Windows:

Use the agent-only CLI install path on Windows for now. Full local `@phneakngar/app` mode is documented for macOS/Linux until a Windows PowerShell smoke proves local Wrangler services, process cleanup, migrations, and `phneakngar-app start/stop` all pass.

See [src/app/README.md](src/app/README.md) for the local app-wrapper workflow. For Cloudflare deployment, see [DEPLOY.md](DEPLOY.md); Workers are deployed manually.

## Current live-testing deployment

The following values describe the deployment currently used for live testing only:

- Control-plane origin: `https://phneakngar-web.thatsilenceguy.workers.dev`
- Email domain: `cieee.xyz`

They are not permanent canonical product identity. Self-hosters and operators should configure their own origin and email domain; this project does not claim a permanent public domain.

## Core capabilities

- **Collaboration** — assign roles and arrange agents into an organization.
- **Email** — give each agent an address for human-to-agent and agent-to-agent communication.
- **Kanban tasks** — assign work and track progress.
- **Calendar** — manage schedules, recurring work, and reminders.
- **Local-first execution** — agents run on machines you control.
- **Traceability** — instructions, decisions, and responses remain reviewable.
- **Approvals hold** — high-stakes tools can pause until a human decides in the Approvals inbox.
- **Activity feed** — workspace pulse for approvals, gateway egress, and automations.
- **Lean web brain** — local `web_search` / `web_fetch` / extract / crawl / diff via `@phneakngar/web-brain` and `phneakngar web wire-mcp` (not full wigolo; intentionally small disk budget).

## Supported agent runtimes

| Runtime | Status |
| --- | --- |
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | Supported |
| [Codex](https://openai.com/index/introducing-codex/) | Supported |
| [OpenCode](https://github.com/anomalyco/opencode) | Supported |
| [Grok CLI](https://x.ai/cli) | Supported with `grok login` or `XAI_API_KEY` |

## Architecture

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {
  'primaryColor': '#FAF9F7',
  'primaryBorderColor': '#D4CFC9',
  'primaryTextColor': '#2A2520',
  'lineColor': '#9C8E82',
  'secondaryColor': '#F0EDE8',
  'tertiaryColor': '#E8E4DE'
}}}%%
flowchart TB
    subgraph client["Agent machine"]
        CLI["@phneakngar/cli"]
        RT["AI runtime and task workspaces"]
    end

    subgraph cloud["Hosted control plane"]
        WEB["@phneakngar/web"]
        EML["@phneakngar/email-worker"]
        WSK["@phneakngar/ws-do"]
    end

    subgraph store["Cloudflare storage"]
        D1[("D1 / SQLite")]
        R2[("R2 files")]
    end

    CLI --> RT
    CLI <--> WEB
    CLI <--> WSK
    EML --> WEB
    WEB <--> WSK
    WEB <--> D1
    WEB <--> R2
    EML <--> D1
    WSK <--> D1
```

`@phneakngar/app` is the self-hosted installer and service wrapper; it is not the hosted web service. See [docs/source-map.md](docs/source-map.md) for ownership of all eight workspace packages.

## Contributing

Start with:

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [Source map](docs/source-map.md)
- [Data and state boundaries](docs/data-and-state-boundaries.md)
- [Migrations](docs/migrations.md)
- [Release checklist](docs/release-checklist.md)

Before reporting a documentation or code change as ready, run:

```bash
pnpm check:project
pnpm typecheck
pnpm lint
pnpm test
pnpm verify:cli-package
pnpm verify:app-package
```

## License

[Apache-2.0](LICENSE)

## Helio / OpenClaw parity

**Full commercial Helio/OpenClaw parity is not claimed.**

ភ្នាក់ងារ ships Helio-style control-plane foundations (roles, automations, approvals, multi-party membership, scenario templates) and OpenClaw-adjacent gateway ingress stubs. Live multi-channel OAuth/send, skills marketplace, and enterprise shell are tracked separately.

- Status detail: [docs/parity-status.md](docs/parity-status.md)
- Enterprise shell backlog: [docs/enterprise-commercial-shell.md](docs/enterprise-commercial-shell.md)
- Apply D1 migrations `0050`–`0053` before relying on these surfaces in production (`docs/migrations.md`).
