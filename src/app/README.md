<p align="center">
  <img src="../../assets/readme-banner.png" alt="ភ្នាក់ងារ — self-hosted app installer" width="800" />
</p>

# @phneakngar/app

`@phneakngar/app` is the self-hosted installer and service wrapper for running the ភ្នាក់ងារ web app, Email Worker, WebSocket Worker, local D1 state, and embedded CLI on one machine.

- Main project guide: [../../README.md](../../README.md)
- Khmer guide: [../../README.km.md](../../README.km.md)
- Agent-only client install: [../../INSTALL.md](../../INSTALL.md)

## Publication status

`@phneakngar/app` is published under the public `@phneakngar` npm scope. This checkout is configured for release `0.0.1`; use explicit `@0.0.1` commands when you want this release rather than another dist-tag.

## Quick start from this repository

Use Node.js `>=20.19.0`, pnpm `10.33.0`, and Bun `1.3.14`:

```bash
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm dev:app onboard
```

The root `dev:app` script sets `PHNEAKNGAR_PROJECT_ROOT` and runs the app wrapper from source. After onboarding, open `http://localhost:15210`.

Other development commands:

```bash
pnpm dev:app start
pnpm dev:app stop
pnpm dev:app update
```

## Install an operator-provided tarball

```bash
npm install --global ./phneakngar-app-*.tgz
phneakngar-app onboard
```

Full local app mode is currently documented for macOS/Linux. Use the agent-only CLI install path on Windows until a Windows PowerShell smoke proves local Wrangler services, process cleanup, migrations, and `phneakngar-app start/stop` all pass.

Commands after global tarball installation:

| Command | Description |
| --- | --- |
| `phneakngar-app onboard` | Install, migrate, start services, and guide registration |
| `phneakngar-app start` | Start an existing local installation |
| `phneakngar-app stop` | Stop local services |
| `phneakngar-app update` | Replace the bundle, apply migrations, and restore the services/chhlat that were running before the update |
| `phneakngar-app register` | Register the embedded CLI with the local server |
| `phneakngar-app chhlat start` | Start the embedded CLI chhlat |
| `phneakngar-app chhlat stop` | Stop the embedded CLI chhlat |
| `phneakngar-app chhlat status` | Show embedded CLI chhlat status |
| `phneakngar-app cli <command>` | Pass a command through to the embedded CLI |

## Build the app tarball

From the monorepo root, follow the same build and bundle order used by the publish workflow:

```bash
pnpm install --frozen-lockfile
PHNEAKNGAR_DOMAIN=phneakngar.invalid NEXT_PUBLIC_PHNEAKNGAR_DOMAIN=phneakngar.invalid NEXT_PUBLIC_PHNEAKNGAR_ENVIRONMENT=development pnpm build --filter=@phneakngar/shared --filter=@phneakngar/web --filter=@phneakngar/cli --filter=@phneakngar/email-worker --filter=@phneakngar/ws-do --filter=@phneakngar/app
pnpm -C src/app run bundle
pnpm -C src/app run build
cd src/app
npm pack
```

Or run the full clean-install package smoke from the monorepo root:

```bash
pnpm verify:app-package
```

The explicit `development` marker allows the optimized local app bundle to use the visibly non-production `phneakngar.invalid` identity. Hosted OpenNext builds must use their onboarded domain and `NEXT_PUBLIC_PHNEAKNGAR_ENVIRONMENT=production` instead.

The generated `phneakngar-app-*.tgz` can be copied to another machine and installed with npm as shown above.

## Public npm/`npx` usage

Use the explicit version for reproducible installs:

macOS/Linux:

```bash
npx @phneakngar/app@0.0.1 onboard
npx @phneakngar/app@0.0.1 start
npx @phneakngar/app@0.0.1 stop
npx @phneakngar/app@0.0.1 update
```

Windows:

Use the agent-only CLI install path on Windows for now. Full local `@phneakngar/app` mode is documented for macOS/Linux until a Windows PowerShell smoke proves local Wrangler services, process cleanup, migrations, and `phneakngar-app start/stop` all pass.

## What onboarding does

1. Checks Node.js and detects an installed AI runtime.
2. Installs the self-hosted bundle under `~/.phneakngar/self-hosted/`.
3. Generates local secrets.
4. Applies local Cloudflare D1 migrations.
5. Starts the web, Email Worker, and WebSocket Worker services.
6. Guides account/workspace creation and runtime registration.
7. Starts chhlat and opens the dashboard.

## Options

```text
--port-web <port>    Web server port (default: 15210)
--port-email <port>  Email Worker port (default: 15211)
--port-ws <port>     WebSocket Worker port (default: 15212)
--skip-register      Skip account creation during onboarding
```

## Architecture

`@phneakngar/app` is a local installer/wrapper. The hosted Cloudflare web package is `@phneakngar/web`; the two labels are not interchangeable.

| Local service | Package | Default port | Responsibility |
| --- | --- | --- | --- |
| Web | `@phneakngar/web` | `15210` | Next.js dashboard, API, and authentication |
| Email Worker | `@phneakngar/email-worker` | `15211` | Local email processing path |
| WebSocket Worker | `@phneakngar/ws-do` | `15212` | Durable Object real-time channels |

In an installed bundle, all three services use separate local Wrangler processes and share D1 state persisted under `~/.phneakngar/self-hosted/web/.wrangler/state/`. In monorepo development, the web service runs with `next dev`, while the Email and WebSocket Workers run with Wrangler.

```text
~/.phneakngar/self-hosted/
├── web/
│   ├── .wrangler/state/
│   └── migrations/
├── email-worker/
├── ws-do/
├── logs/
└── .pids.json
```

## Migrations and secrets

- `onboard` applies all migrations for a fresh installation.
- `update` applies pending migrations after replacing the bundle.
- Wrangler records applied migrations.
- On first onboarding, the wrapper generates missing web and Email Worker `.dev.vars` files.
- Existing secret files are not overwritten.

## Current live-testing values

Agent-only clients currently default to the live-testing control plane at `https://phneakngar-web.thatsilenceguy.workers.dev`, whose current email domain is `cieee.xyz`. Those are live-testing values only, not permanent canonical product identity. A local `@phneakngar/app` installation uses its own local service origin and does not require that hosted deployment.

## Requirements

### Running an operator-built tarball

- Node.js `>=20.19.0`
- One supported AI runtime: Claude Code, Codex, OpenCode, or Grok CLI

### Building from the repository

- Node.js `>=20.19.0`
- pnpm `10.33.0`
- Bun `1.3.14`

## Limitations

- External email send/receive is unavailable in local mode unless an operator configures a supported email environment.
- Social OAuth is disabled in the default local setup; use the local account flow.

## License

Apache-2.0 — see [../../LICENSE](../../LICENSE).
