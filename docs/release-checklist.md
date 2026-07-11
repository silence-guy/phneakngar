# Release Checklist

All release packages share one version. The supported release path is `pnpm bump`, followed by review and an explicit push by an authorized operator.

Cloudflare deployment is separate and manual.

## Before the Bump

Run from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm check:project
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm db:reset
pnpm db:migrate
# Client package smoke (pack + clean install) — does not publish
pnpm verify:cli-package
```

Client install docs: [INSTALL.md](../INSTALL.md)

Also verify:

- Every Drizzle schema change has an additive or explicitly reviewed D1 migration.
- The complete local migration chain applies from an empty database.
- No `.env`, `.dev.vars`, `.wrangler`, local D1 file, build output, coverage output, or credential is tracked.
- `src/web/wrangler.toml`, `src/email-worker/wrangler.toml`, and `src/ws-do/wrangler.toml` reference the intended Cloudflare account resources.
- `BETTER_AUTH_URL`, OAuth callbacks, the custom domain, and Email Worker `WEB_ORIGIN` use the same HTTPS origin.
- `EMAIL_NOTIFY_SECRET` matches between web and email Workers.
- `ENCRYPTION_KEY` matches between web and email Workers.
- `WS_SERVICE_SECRET` matches between web and WebSocket Workers.
- `MIN_CLI_VERSION` is raised only when the new server cannot safely serve an older CLI.
- Production dependency audit and workflow security checks have passed in a network-enabled environment.

Validate all Worker bundles without deploying:

```bash
pnpm --filter @phneakngar/ws-do exec wrangler deploy --dry-run --outdir /tmp/phneakngar-ws-do
pnpm --filter @phneakngar/email-worker exec wrangler deploy --dry-run --outdir /tmp/phneakngar-email-worker
pnpm --filter @phneakngar/web exec wrangler deploy --dry-run --outdir /tmp/phneakngar-web
```

## Test the Version Bump Without Writing

```bash
pnpm bump patch --desktop --mobile --min-cli --dry-run
```

The command must report success without changing the diff, staging files, creating a commit, or creating a tag.

## Create the Release Commit

```bash
pnpm bump patch
pnpm bump minor
pnpm bump major
pnpm bump 1.2.3
```

Optional flags:

```bash
pnpm bump patch --min-cli
pnpm bump patch --desktop
pnpm bump patch --mobile
```

Flag rules:

- `--min-cli`: use only when the server protocol or security boundary requires the new CLI. The web task poll endpoint will withhold tasks from lower or versionless clients.
- `--desktop`: use when desktop code, Tauri configuration, native assets, updater behavior, or desktop packaging changed.
- `--mobile`: use when mobile application behavior, native configuration, or store artifacts changed.

The script updates package, Tauri, and Cargo versions and creates a local `release: vX.Y.Z` commit. It does not push, tag, publish, or deploy.

## Review Before Push

```bash
git show --stat --oneline HEAD
git diff HEAD^ -- package.json src/*/package.json src/desktop/src-tauri/tauri.conf.json src/desktop/src-tauri/Cargo.toml src/desktop/src-tauri/Cargo.lock
git status --short
```

Confirm the release commit contains only intended version and marker changes. Then an authorized operator may push:

```bash
git push origin main
```

## What GitHub Actions Does

For a valid `release: vX.Y.Z` commit:

1. CI runs repository quality, tests, builds, E2E jobs where configured, and Worker dry-runs.
2. `Auto-Tag & Release` verifies tag consistency, creates the tag when absent, and creates or repairs the GitHub Release.
3. CLI and app publish workflows verify package versions, use npm trusted publishing, and skip versions already present in npm.
4. Desktop release runs only when the release commit contains `src/desktop/.deploy-version`, or when manually dispatched.
5. Mobile release validates that the release commit, package version, and mobile marker match.
6. Cloudflare Workers are not deployed by GitHub Actions.

A tag that already points to a different commit is a hard failure. Do not delete or move it without a reviewed release-recovery decision.

## Cloudflare Deployment

### Clean first deployment

```bash
pnpm deploy:ws-do
pnpm deploy:email
pnpm deploy:web
```

The web Worker is last because it has service bindings to both internal Workers.

### Rolling deployment for the internal-authentication release

For a deployment upgrading from a version that does not send the new service authentication headers:

```bash
pnpm deploy:web
pnpm deploy:ws-do
pnpm deploy:email
```

The new caller is deployed before stricter callees to avoid a temporary outage. For later releases, choose an order based on backward compatibility instead of copying an order blindly.

`pnpm deploy:web` applies remote D1 migrations before deploying the OpenNext Worker. Review the remote migration list first and ensure only one operator applies migrations.

## Post-Deployment Acceptance

- `https://<production-origin>/api/health` returns HTTP 200.
- OAuth login and session restoration succeed.
- Workspace isolation and R2 ownership checks reject cross-workspace access.
- A current CLI registers, reports health, authenticates WebSocket, receives one task, and reconnects without duplication.
- A CLI below `MIN_CLI_VERSION` receives no task and receives an update instruction.
- Email inbound, outbound, IMAP, attachment, duplicate-delivery, and recovery paths succeed.
- WebSocket event injection without the service secret is rejected.
- Cloudflare logs and traces show no new 5xx, retry storm, or authorization anomaly.

Keep previous Worker deployments available until these checks pass. Roll back Workers through Cloudflare deployment history and repair D1 forward with a new migration rather than reversing a production migration.
