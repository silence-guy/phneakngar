# Contributing to ភ្នាក់ងារ

Thanks for contributing to ភ្នាក់ងារ. This guide covers the supported toolchain, workspace ownership, common commands, and validation requirements.

## Language

- **English:** this document and [README.md](README.md)
- **ភាសាខ្មែរ:** [README.km.md](README.km.md)

## Prerequisites

Use the versions declared by the repository and release workflows:

- **Node.js** `>=20.19.0`
- **pnpm** `10.33.0`
- **Bun** `1.3.14`
- **Wrangler** from the workspace lockfile; use it through pnpm rather than installing an unrelated global version

## Setup

```bash
git clone https://github.com/silence-guy/phneakngar.git
cd phneakngar
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm dev
```

`pnpm dev` starts the web app, Email Worker, WebSocket Worker, and shared development tasks. Run the CLI separately when needed:

```bash
pnpm dev:cli
```

For the app-wrapper development flow:

```bash
pnpm dev:app onboard
```

## Workspace ownership

This pnpm monorepo contains **eight workspace packages**. [docs/source-map.md](docs/source-map.md) is the authoritative ownership map.

| Package | Location | Owns |
| --- | --- | --- |
| `@phneakngar/shared` | `src/shared` | Shared types, schemas, constants, D1 schema, Drizzle queries, email helpers, and runtime helpers |
| `@phneakngar/web` | `src/web` | Next.js web app on Cloudflare Workers, public site, app UI, API routes, migrations, and web e2e tests |
| `@phneakngar/cli` | `src/cli` | CLI commands, chhlat, local execution, and provider/runtime orchestration |
| `@phneakngar/email-worker` | `src/email-worker` | Inbound email Worker, IMAP poller Durable Object, and email notification forwarding |
| `@phneakngar/ws-do` | `src/ws-do` | WebSocket Durable Object for chhlat and user runtime channels |
| `@phneakngar/app` | `src/app` | Self-hosted installer/wrapper, service management, local bundling, and migrations |
| `@phneakngar/desktop` | `src/desktop` | Tauri desktop wrapper and generated native projects |
| `@phneakngar/test-utils` | `tests/utils` | Shared test helpers |

The hosted Cloudflare web service is `@phneakngar/web`. `@phneakngar/app` is the self-hosted installer and service wrapper; do not label it as the hosted web service.

Before changing D1 queries, ownership checks, task state, runtime status, caches, or email state, read [docs/data-and-state-boundaries.md](docs/data-and-state-boundaries.md).

## Making changes

### 1. Branch from main

```bash
git checkout -b feat/your-feature
```

### 2. Follow repository boundaries

- **Scope database queries by workspace ID before querying.** Do not load a row first and check ownership afterward.
- **Keep services stateless.** Important state belongs in D1 or approved local storage, not process memory.
- **Use Drizzle ORM operators.** Use raw SQL only when no ORM equivalent exists.
- **Write or update tests.** Skip new tests only when existing tests already exercise the change.
- **Keep environment identity configurable.** `cieee.xyz` and `https://phneakngar-web.thatsilenceguy.workers.dev` are current live-testing values only, not permanent canonical identity.

### 3. Validate before reporting the change ready

```bash
pnpm check:project
pnpm typecheck
pnpm lint
pnpm test
```

All four commands must pass. The pre-commit hook runs typecheck, lint, and tests; run `pnpm check:project` explicitly as well.

For schema changes, follow [docs/migrations.md](docs/migrations.md). For releases, follow [docs/release-checklist.md](docs/release-checklist.md).

### 4. Open a pull request

- Target `main`.
- Link the issue and describe behavior, validation, and affected packages.
- Include migrations when the D1 schema changes.
- Do not include secrets, generated local state, or release changes unrelated to the work.

## Testing

- **Framework:** Vitest
- **All package tests:** `pnpm test`
- **Shared tests:** `pnpm test:shared`
- **CLI tests:** `pnpm test:cli`
- **Web tests:** `pnpm test:web`
- **Web e2e:** start the complete local stack, then run `APP_URL=http://localhost:15210 pnpm test:e2e`

Run a focused package test while iterating, then run all required repository gates before completion.

## Scripts reference

| Command | What it does |
| --- | --- |
| `pnpm dev` | Start web, Email Worker, WebSocket Worker, and shared development tasks |
| `pnpm dev:web` | Start the Next.js development server |
| `pnpm dev:cli` | Start CLI/chhlat development against `http://localhost:15210` |
| `pnpm dev:app` | Start the self-hosted app-wrapper development flow |
| `pnpm dev:desktop` | Start the Tauri desktop wrapper |
| `pnpm dev:email` | Start the Email Worker |
| `pnpm dev:ws` | Start the WebSocket Worker |
| `pnpm db:migrate` | Apply local D1 migrations |
| `pnpm db:reset` | Remove local web D1 state and reapply migrations |
| `pnpm check:project` | Run repository guardrails |
| `pnpm typecheck` | Typecheck workspace packages |
| `pnpm lint` | Lint workspace packages |
| `pnpm test` | Run workspace tests |
| `pnpm build` | Build the shared, web, CLI, Email Worker, and WebSocket Worker packages selected by the root script |
| `pnpm clean:builds` | Remove generated build artifacts |
| `pnpm clean` | Remove dependencies, build artifacts, local Wrangler state, and `.phneakngar` |

## Package publication status

Public npm checks on **2026-07-14** returned `E404` for `@phneakngar/cli` and `@phneakngar/app`. Documentation and testing should use local builds or tarballs until public registry publication is confirmed. Do not present npm or `npx` installation as currently available without first verifying it.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```text
TYPE(SCOPE): description
```

Common types include `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `build`, and `revert`.

Examples:

```text
feat(web): add agent creation page
fix(cli): resolve auth token refresh race condition
docs(app): document tarball installation
```

Use the body to explain what changed and why. Reference issues with `Closes #123` when appropriate.

## Reporting issues

Include reproduction steps, expected behavior, actual behavior, environment details, and relevant logs with credentials removed.

## License

By contributing, you agree that your contributions are licensed under the [Apache-2.0 License](LICENSE).
