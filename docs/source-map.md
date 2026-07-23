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
- Playbook engine: `src/web/src/lib/services/playbook-engine.ts` (start/advance/cancel; hooked from task complete/fail and approval decide routes)
- Playbook API: `src/web/src/app/api/playbooks/**`
- Playbook UI: `src/web/src/app/(app)/w/[slug]/playbooks/**`
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
- Desktop native entry: `src/desktop/src-tauri/src/lib.rs`
- Desktop native commands: `src/desktop/src-tauri/src/commands.rs`
- Desktop shell helpers (pure): `src/desktop/src-tauri/src/shell.rs`
- Desktop web bridge (F4 poll): `src/web/src/components/tauri-approval-notify.tsx` + `tauri-approval-notify-lib.ts` (mounted from `workspace-shell.tsx`)

## Desktop IPC surface (F4 / F5)

Tauri commands registered for the packaged shell (desktop only). Web invokes them via `tauriInvoke` when `isTauri() && isDesktop()`.

| Command | Direction | Purpose |
| --- | --- | --- |
| `notify_pending_approval` | web → desktop | One-shot OS notification (manual/test). |
| `report_pending_approvals` | web → desktop | Pending snapshot: seeds/diffs per workspace slug, notifies only new IDs, updates F5 approval badge. Args: `{ items: { id, title?, summary?, kind? }[], workspace_slug? }`. |
| `set_shell_state` | web → desktop | Push optional `pending_approvals`, `workspace_slug`, `runtime_online`; refreshes tray/window chrome. |
| `get_shell_state` | web → desktop | Read current `{ runtime_online, pending_approvals, workspace_slug }`. |
| `open_shell_path` | web → desktop | Navigate main webview via deep-link / absolute app path (`/w/{slug}/…`). |

Deep links (`phneakngar://…` and https paths under `/w/{slug}/…`) are handled in Rust (`setup_deep_links` / `parse_deep_link`). Pure helpers and seed/diff planners are unit-tested under `shell.rs` / `commands.rs` (`cargo test --lib` in `src/desktop/src-tauri`; requires local Rust toolchain — not run in CF Worker CI).

## Common Workflows

- Web-only UI/API change: update `src/web`, add or update route/component tests, then run `pnpm --filter @phneakngar/web test`.
- Shared schema/query change: update `src/shared/src/db/schema.ts`, a migration in `src/web/migrations`, query tests under `src/shared/test`, then run shared tests.
- CLI/chhlat change: update `src/cli`, add focused chhlat/command tests, then run `pnpm --filter @phneakngar/cli test`.
- Email behavior change: update `src/email-worker` and any notifying web route, then run email-worker tests plus affected web route tests.
- Runtime/WebSocket change: update `src/ws-do`, chhlat client code in `src/cli`, and status UI or API routes as needed.
- Desktop shell/notify change: update `src/desktop/src-tauri/src/{commands,shell,lib}.rs` and the web bridge under `src/web/src/components/tauri-approval-notify*`, run web vitest for the bridge plus `cargo test --lib` when Rust is available.

## Naming

- Human-facing product name: `ភ្នាក់ងារ`
- Package-safe slug/scope: `phneakngar`, `@phneakngar/*`
- Environment prefix: `PHNEAKNGAR_*`
- Protocol identifiers such as HTTP headers, package names, domains, and binary names must stay ASCII.

## Parity honesty

- [parity-status.md](./parity-status.md) — Helio/OpenClaw claim ladder (full commercial parity **not** claimed)
- [enterprise-commercial-shell.md](./enterprise-commercial-shell.md) — Phase C scaffold only
- Gateway services: `src/web/src/lib/services/gateway-ingress.ts`, `gateway-outbound.ts`, `gateway-verify/`
- Gateway bindings queries: `src/shared/src/db/queries/gateway-binding.ts` (after `0053`)
