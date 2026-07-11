# Source Map

This repository is a pnpm/Turbo monorepo for `ភ្នាក់ងារ`. Use this map before changing code so the work lands in the package that owns the behavior.

## Packages

| Path | Package | Owns |
| --- | --- | --- |
| `src/shared` | `@phneakngar/shared` | Shared types, Zod schemas, constants, D1 schema, Drizzle query modules, email helpers, mode/runtime helpers. |
| `src/web` | `@phneakngar/web` | Next.js app on Cloudflare Workers, public site, app UI, API routes, D1 migrations, e2e tests. |
| `src/cli` | `@phneakngar/cli` | CLI commands, chhlat, local execution environment, provider/runtime orchestration. |
| `src/email-worker` | `@phneakngar/email-worker` | Inbound email Worker, IMAP poller Durable Object, email notification forwarding. |
| `src/ws-do` | `@phneakngar/ws-do` | WebSocket Durable Object for chhlat/user runtime channels. |
| `src/app` | `@phneakngar/app` | Self-hosted app installer/wrapper, service management, local migrations. |
| `src/desktop` | `@phneakngar/desktop` | Tauri desktop wrapper and generated native project files. |
| `tests/utils` | `@phneakngar/test-utils` | Shared test helpers. |

## Critical Entry Points

- Web app routes: `src/web/src/app/**`
- Web API routes: `src/web/src/app/api/**/route.ts`
- Web Cloudflare config: `src/web/wrangler.toml`
- Web migrations: `src/web/migrations/*.sql`
- Shared D1 schema: `src/shared/src/db/schema.ts`
- Shared query modules: `src/shared/src/db/queries/*.ts`
- Shared query exports: `src/shared/src/db/queries-index.ts`
- CLI binary entry: `src/cli/src/index.ts`
- CLI chhlat runtime: `src/cli/chhlat/**` (internal module path)
- Email Worker entry: `src/email-worker/src/index.ts`
- IMAP poller Durable Object: `src/email-worker/src/imap-poller-do.ts`
- WebSocket Worker entry: `src/ws-do/src/index.ts`
- WebSocket Durable Object: `src/ws-do/src/ws-durable.ts`
- App wrapper entry: `src/app/src/index.ts`
- Desktop native commands: `src/desktop/src-tauri/src/commands.rs`

## Common Workflows

- Web-only UI/API change: update `src/web`, add or update route/component tests, then run `pnpm --filter @phneakngar/web test`.
- Shared schema/query change: update `src/shared/src/db/schema.ts`, a migration in `src/web/migrations`, query tests under `src/shared/test`, then run shared tests.
- CLI/chhlat change: update `src/cli`, add focused chhlat/command tests, then run `pnpm --filter @phneakngar/cli test`.
- Email behavior change: update `src/email-worker` and any notifying web route, then run email-worker tests plus affected web route tests.
- Runtime/WebSocket change: update `src/ws-do`, chhlat client code in `src/cli`, and status UI or API routes as needed.

## Naming

- Human-facing product name: `ភ្នាក់ងារ`
- Package-safe slug/scope: `phneakngar`, `@phneakngar/*`
- Environment prefix: `PHNEAKNGAR_*`
- Protocol identifiers such as HTTP headers, package names, domains, and binary names must stay ASCII.
