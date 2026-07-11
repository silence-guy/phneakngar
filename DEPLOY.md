# Production Deployment Guide

This runbook covers the Cloudflare deployment of ភ្នាក់ងារ. Cloudflare deployment is a manual operator action. GitHub Actions validates builds, creates releases, and publishes eligible npm packages, but it does not deploy the Workers.

## 1. Supported Toolchain

Use these repository-supported versions or newer compatible patch releases:

| Tool | Required version |
|---|---|
| Node.js | `>=20.19.0` |
| pnpm | `10.33.0` from `packageManager` |
| Bun | `1.3.14` |
| Wrangler | `4.103.x` |
| OpenNext Cloudflare adapter | `1.19.x` |

For desktop and mobile releases, also install the Rust, Tauri, Xcode, Android SDK, Java, and store-signing prerequisites documented by their official toolchains. They are not required for a Cloudflare-only deployment.

## 2. Deployment Architecture

The production control plane has three deployable Workers:

| Worker | Wrangler name | Public exposure | Dependencies |
|---|---|---|---|
| Next.js/OpenNext web | `phneakngar-web` | Custom web domain | D1, R2, KV, OpenNext cache resources, `phneakngar-ws-do`, `phneakngar-email-worker`, self-service binding |
| WebSocket Durable Object | `phneakngar-ws-do` | `workers_dev = false`; reached through web service binding | D1, `WebSocketDurableObject` |
| Email Worker | `phneakngar-email-worker` | `workers_dev = false`; reached through service binding and Cloudflare Email Routing | D1, R2, Send Email binding, `ImapPollerDO`, authenticated callback to the public web origin |

Durable application state belongs in D1, R2, or Durable Object storage. Live WebSocket connection objects are intentionally ephemeral.

## 3. Required Cloudflare Resources

The resource names and IDs in the three `wrangler.toml` files must belong to the target Cloudflare account.

| Resource | Name or binding |
|---|---|
| Application D1 | `phneakngar-app`, binding `DB` |
| OpenNext tag-cache D1 | `phneakngar-next-tags`, binding `NEXT_TAG_CACHE_D1` |
| Email and transcript R2 | `phneakngar-emails`, binding `EMAIL_BUCKET` |
| OpenNext incremental-cache R2 | `phneakngar-next-cache`, binding `NEXT_INC_CACHE_R2_BUCKET` |
| Rate-limit KV | binding `RATE_LIMIT_KV` |
| General cache KV | binding `CACHE_KV` |
| OpenNext queue Durable Object | `DOQueueHandler` |
| WebSocket Durable Object | `WebSocketDurableObject` |
| IMAP poller Durable Object | `ImapPollerDO` |
| Email send binding | `SEND_EMAIL` |

Create missing storage resources before editing the generated IDs into `src/web/wrangler.toml`, `src/email-worker/wrangler.toml`, and `src/ws-do/wrangler.toml`:

```bash
pnpm exec wrangler d1 create phneakngar-app
pnpm exec wrangler d1 create phneakngar-next-tags
pnpm exec wrangler r2 bucket create phneakngar-emails
pnpm exec wrangler r2 bucket create phneakngar-next-cache
pnpm exec wrangler kv namespace create RATE_LIMIT_KV
pnpm exec wrangler kv namespace create CACHE_KV
```

Durable Object classes and migrations are created by the corresponding Worker deployment. Configure Cloudflare Email Routing so inbound messages are delivered to `phneakngar-email-worker`. Configure the Send Email binding and sender authorization before testing outbound mail.

The committed resource IDs are deployment-account-specific identifiers, not credentials. Replace them only when deploying to a different Cloudflare account.

## 4. Production Variables and Secrets

Never commit `.dev.vars`, `.env`, or secret values. Generate independent random values with a cryptographically secure generator. A 32-byte random value encoded as base64url is suitable.

### Web Worker

Set these on `phneakngar-web`:

| Name | Requirement |
|---|---|
| `BETTER_AUTH_SECRET` | Unique session-signing secret |
| `BETTER_AUTH_URL` | Exact public HTTPS origin, without a path |
| `ENCRYPTION_KEY` | Must exactly match the Email Worker value |
| `EMAIL_NOTIFY_SECRET` | Must exactly match the Email Worker value; authenticates traffic in both directions |
| `WS_SERVICE_SECRET` | Must exactly match the WebSocket Worker value |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | Required when GitHub OAuth is enabled |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Required when Google OAuth is enabled |
| `DEVICE_CLIENT_IDS` | Comma-separated device OAuth client IDs allowed for CLI login. Must include `phneakngar-cli` for `phneakngar login` |
| `AUTH_OTP_RATE_LIMIT_MAX` | Optional positive integer override |
| `AUTH_OTP_RATE_LIMIT_WINDOW_SEC` | Optional positive integer override |
| `MIN_CLI_VERSION` | Minimum CLI permitted to receive tasks |
| `RUNTIME_MODEL_OPTIONS` | JSON model allowlist; currently committed as a non-secret Wrangler variable |

Example secret commands:

```bash
pnpm exec wrangler secret put BETTER_AUTH_SECRET --config src/web/wrangler.toml
pnpm exec wrangler secret put BETTER_AUTH_URL --config src/web/wrangler.toml
pnpm exec wrangler secret put ENCRYPTION_KEY --config src/web/wrangler.toml
pnpm exec wrangler secret put EMAIL_NOTIFY_SECRET --config src/web/wrangler.toml
pnpm exec wrangler secret put WS_SERVICE_SECRET --config src/web/wrangler.toml
pnpm exec wrangler secret put GITHUB_CLIENT_ID --config src/web/wrangler.toml
pnpm exec wrangler secret put GITHUB_CLIENT_SECRET --config src/web/wrangler.toml
pnpm exec wrangler secret put GOOGLE_CLIENT_ID --config src/web/wrangler.toml
pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET --config src/web/wrangler.toml
printf '%s' 'phneakngar-cli' | pnpm exec wrangler secret put DEVICE_CLIENT_IDS --config src/web/wrangler.toml
```

### Email Worker

Set these on `phneakngar-email-worker`:

| Name | Requirement |
|---|---|
| `ENCRYPTION_KEY` | Same value as the web Worker |
| `EMAIL_NOTIFY_SECRET` | Same value as the web Worker |
| `WEB_ORIGIN` | Exact public HTTPS origin of the web Worker, for authenticated `/api/email/notify` callbacks |

```bash
pnpm exec wrangler secret put ENCRYPTION_KEY --config src/email-worker/wrangler.toml
pnpm exec wrangler secret put EMAIL_NOTIFY_SECRET --config src/email-worker/wrangler.toml
pnpm exec wrangler secret put WEB_ORIGIN --config src/email-worker/wrangler.toml
```

### WebSocket Worker

Set this on `phneakngar-ws-do`:

```bash
pnpm exec wrangler secret put WS_SERVICE_SECRET --config src/ws-do/wrangler.toml
```

The value must exactly match the web Worker value.

## 5. OAuth and Trusted Origins

Create OAuth applications for the exact production origin used by `BETTER_AUTH_URL`.

GitHub callback:

```text
https://app.example.com/api/auth/callback/github
```

Google callback:

```text
https://app.example.com/api/auth/callback/google
```

Use one canonical HTTPS origin. Do not add wildcard redirect URLs. Confirm that browser origins, OAuth callbacks, WebSocket URLs, and `WEB_ORIGIN` use the same production host.

## 6. Local Preflight

From the repository root:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm predev
pnpm check:project
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm db:reset
pnpm db:migrate
```

`pnpm predev` creates local-only variable files for web, email, and WebSocket Workers, synchronizes cross-Worker secrets, and refuses mismatched existing values. It does not create production secrets or OAuth credentials.

Validate Worker bundles without deploying:

```bash
pnpm --filter @phneakngar/ws-do exec wrangler deploy --dry-run --outdir /tmp/phneakngar-ws-do
pnpm --filter @phneakngar/email-worker exec wrangler deploy --dry-run --outdir /tmp/phneakngar-email-worker
pnpm --filter @phneakngar/web exec wrangler deploy --dry-run --outdir /tmp/phneakngar-web
```

Run E2E only against an explicitly selected, healthy local stack. The global preflight rejects a missing URL, an unrelated service, or a degraded dependency:

```bash
APP_URL=http://localhost:15210 pnpm test:e2e
```

Start the web app on port `15210` and the Email and WebSocket Workers on their documented local ports before running this command. CI uses the same check with `APP_URL=http://localhost:3000`.

## 7. Database Migrations

Never reset a remote production database. Review the pending migration list before applying it:

```bash
pnpm --filter @phneakngar/web exec wrangler d1 migrations list phneakngar-app --remote
pnpm db:migrate:remote
```

Migration filenames are immutable deployment identifiers. Some historical files share a numeric prefix; Wrangler tracks the complete filename, and the repository's clean local reset applies the full chain in filename order. Do not rename or reuse an existing filename.

Take an appropriate D1 backup or export before migrations that alter production data. Current migrations `0045_email_delivery_idempotency.sql` and `0046_machine_token_hash.sql` are additive and forward-safe. Existing active machine tokens migrate lazily to digests on their next successful use.

## 8. Deployment Order

### Clean first deployment

The validated clean-install order is:

```bash
pnpm deploy:ws-do
pnpm deploy:email
pnpm deploy:web
```

This works because `phneakngar-ws-do` has no service-binding dependency, `phneakngar-email-worker` no longer binds back to the web Worker, and the web Worker is deployed last after both service-binding targets exist.

`pnpm deploy:web` applies remote D1 migrations before the OpenNext deployment. Operators may instead run `pnpm db:migrate:remote` explicitly and then deploy from `src/web`, but migrations must not be applied twice by competing operators.

### Rolling update from an existing deployment

Choose the order from the compatibility boundary in the release. For the security changes that introduce authenticated internal calls, deploy the caller before the stricter callee:

```bash
pnpm deploy:web
pnpm deploy:ws-do
pnpm deploy:email
```

This avoids temporarily placing the new WebSocket and Email Workers behind an old web Worker that does not send the required authentication headers. Future releases may return to dependency-first order only when the old and new cross-service protocols are demonstrably compatible.

Keep the previous Worker versions available in Cloudflare deployment history until post-deployment smoke tests pass.

## 9. Custom Domain and Routing

Attach the public custom domain only to `phneakngar-web`. Keep the Email and WebSocket Workers private with `workers_dev = false`. WebSocket browser upgrades are proxied by the web Worker to the WebSocket service binding.

Configure the custom domain through Cloudflare Dashboard or a reviewed Wrangler route. Do not commit a domain belonging to another environment.

## 10. Health and Smoke Tests

The authoritative public readiness endpoint is:

```bash
curl --fail-with-body https://app.example.com/api/health
```

A healthy response has HTTP 200 and reports successful configuration, D1, Email Worker, and WebSocket Worker checks. A degraded dependency or missing required configuration returns HTTP 503. The response does not expose secret names or values.

The internal Worker `/health` endpoints are intended for service-binding checks. They are not expected to be accessible through `*.workers.dev` because both internal Workers set `workers_dev = false`.

After deployment, verify:

1. OAuth login completes and the session cookie is issued only on HTTPS.
2. A workspace can be created or loaded and a different workspace cannot retrieve its records.
3. A current CLI can register, start the daemon, report health, authenticate its WebSocket, and receive one task.
4. Reconnecting the daemon does not duplicate a task or its messages.
5. A CLI below `MIN_CLI_VERSION` receives no tasks and receives an update instruction.
6. Inbound email creates one D1 email row and deterministic R2 objects; redelivery does not duplicate the agent task.
7. IMAP account start, sync, status, and stop operations remain workspace scoped.
8. An attachment outside the draft/workspace scope is rejected.
9. Meeting callbacks persist a bounded transcript and generate at most one summary email.
10. `/api/health` remains HTTP 200 after all Workers are updated.

## 11. Logs and Monitoring

All Workers enable Cloudflare observability. The committed Wrangler files reference `grafana-logs` and `grafana-traces`; those destinations must exist in the target account or be changed before deployment.

Inspect live logs with the package-specific configuration:

```bash
pnpm exec wrangler tail phneakngar-web
pnpm exec wrangler tail phneakngar-email-worker
pnpm exec wrangler tail phneakngar-ws-do
```

Monitor at minimum:

- HTTP 5xx and `/api/health` degradation
- OAuth and OTP rate-limit failures
- D1 errors and migration failures
- WebSocket authentication failures, capacity rejections, reconnect storms, and message-size rejections
- Email parse failures, oversized-message rejection, duplicate delivery, IMAP backoff, and notification failure
- Daemon offline transitions, stale dispatches, update failures, and task retry exhaustion

Logs must never include raw Worker secrets, OAuth secrets, machine tokens, encrypted account credentials, or email attachment bodies.

## 12. Rollback and Recovery

1. Stop additional deployments and record the failed Worker version.
2. Use Cloudflare deployment history to roll back the affected Worker.
3. Roll back callers and callees together when the service authentication or message protocol changed.
4. Do not reverse a D1 migration by deleting remote state. Apply a reviewed forward repair migration.
5. If an email or WebSocket Worker is unhealthy, keep the web Worker returning HTTP 503 readiness until its binding is restored.
6. If `MIN_CLI_VERSION` was raised incorrectly, restore the previous compatible value before allowing task delivery.
7. If npm publication partially fails, rerun the release workflow. It checks the registry and skips versions that already exist.
8. If a tag exists but the GitHub Release is missing, rerun `Auto-Tag & Release`; it verifies tag consistency and creates the missing release.

## 13. CI, Releases, and Publishing

GitHub Actions performs repository validation and release packaging:

- CI installs the pinned pnpm, Node, and Bun toolchain.
- Typecheck, lint, tests, coverage, builds, E2E checks, and Cloudflare bundle dry-runs run where configured.
- A commit beginning `release: vX.Y.Z` is validated, tagged, and used to create the GitHub Release.
- CLI and app npm workflows verify that their package version matches the release commit, use npm trusted publishing, and skip an already-published version.
- Desktop artifacts run only when the release commit contains the desktop marker or when manually dispatched.
- Mobile release jobs verify that the mobile marker and package version match the release commit.
- Cloudflare deployment remains manual.

Use the release process in `docs/release-checklist.md`. Test version changes without writing or committing with:

```bash
pnpm bump patch --desktop --mobile --min-cli --dry-run
```
