# Deployment Guide

> **Ops note (structure-loop 2026-07-09):** Cloudflare Worker deploys are **manual** (`pnpm deploy:ws-do` → `pnpm deploy:email` → `pnpm deploy:web`). CI does not auto-deploy Workers.

This guide covers deploying ភ្នាក់ងារ to Cloudflare Workers.

## Prerequisites

### Required Accounts & Tools
- [Cloudflare account](https://dash.cloudflare.com/) with Workers & D1 enabled
- `wrangler` CLI installed and authenticated:
  ```bash
  npm install -g wrangler
  wrangler login
  ```
- Node.js 20+ and pnpm 10.33+
- Bun 1.3+

### Required Credentials

Create a `.dev.vars` file based on `.dev.vars.example`:

```bash
cp src/web/.dev.vars.example src/web/.dev.vars
cp src/email-worker/.dev.vars.example src/email-worker/.dev.vars
```

Fill in the required values:

| Variable | Description | How to Generate |
|----------|-------------|-----------------|
| `BETTER_AUTH_SECRET` | Session signing secret | `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | IMAP/SMTP credential encryption | `openssl rand -base64 32` |
| `EMAIL_NOTIFY_SECRET` | Internal API key for workers | `openssl rand -base64 32` |
| `GITHUB_CLIENT_ID` | GitHub OAuth App | [Create here](https://github.com/settings/developers) |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App secret | From OAuth App settings |
| `GOOGLE_CLIENT_ID` | Google OAuth | [Console](https://console.cloud.google.com/apis/credentials) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | From Google Console |

### Cloudflare Resources

The following resources are referenced in `wrangler.toml` files and must exist in your Cloudflare account:

| Resource | Type | Name |
|----------|------|------|
| D1 Database | SQLite | `phneakngar-app` |
| D1 Database | SQLite | `phneakngar-next-tags` |
| R2 Bucket | Storage | `phneakngar-emails` |
| R2 Bucket | Storage | `phneakngar-next-cache` |
| KV Namespace | KV | Rate limiting cache |
| KV Namespace | KV | General cache |
| Durable Objects | — | `ImapPollerDO`, `WebSocketDO`, `DOQueueHandler` |

#### Create Missing Resources

```bash
# D1 Databases
wrangler d1 create phneakngar-app
wrangler d1 create phneakngar-next-tags

# R2 Buckets
wrangler r2 bucket create phneakngar-emails
wrangler r2 bucket create phneakngar-next-cache

# KV Namespaces
wrangler kv:namespace create RATE_LIMIT_KV
wrangler kv:namespace create CACHE_KV
```

> **Note:** After creating resources, update the IDs in `wrangler.toml` files.

## Deployment Steps

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Run Database Migrations

Apply migrations to remote D1:

```bash
pnpm db:migrate:remote
```

### 3. Deploy Workers

Deploy each worker in the correct order:

```bash
# Deploy WebSocket Durable Object (no dependencies)
pnpm deploy:ws-do

# Deploy Email Worker (no dependencies)
pnpm deploy:email

# Deploy Web App (depends on other workers via service bindings)
pnpm deploy:web
```

Or deploy individually:

```bash
# Web App (includes Next.js)
cd src/web
npx opennextjs-cloudflare build && npx opennextjs-cloudflare deploy

# WebSocket Worker
cd src/ws-do
npx wrangler deploy

# Email Worker
cd src/email-worker
npx wrangler deploy
```

### 4. Configure OAuth Redirect URIs

After deployment, configure OAuth redirect URIs:

**GitHub OAuth App:**
```
https://your-domain.com/api/auth/callback/github
```

**Google OAuth:**
```
https://your-domain.com/api/auth/callback/google
```

### 5. Verify Deployment

Check the health endpoints:

```bash
curl https://your-web-worker.workers.dev/api/health
curl https://your-email-worker.workers.dev/health
curl https://your-ws-worker.workers.dev/health
# Note: email-worker and ws-do often set workers_dev=false — use your custom domain/routes if *.workers.dev fails
```

## Environment Variables (Production)

For production, set environment variables via Cloudflare Dashboard or CLI:

```bash
# Web app
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put ENCRYPTION_KEY
wrangler secret put EMAIL_NOTIFY_SECRET
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET

# Email worker (same values as web for shared secrets)
cd src/email-worker
wrangler secret put ENCRYPTION_KEY
wrangler secret put EMAIL_NOTIFY_SECRET
```

Also set production `BETTER_AUTH_URL` to the public web origin (required for OAuth/session callbacks):

```bash
# e.g. https://app.example.com
wrangler secret put BETTER_AUTH_URL --config src/web/wrangler.toml
# or set as a [vars] / Dashboard env for phneakngar-web
```

## Custom Domain (Optional)

To use a custom domain:

```bash
# In wrangler.toml, add:
routes = [
  { pattern = "app.example.com", zone_name = "example.com" }
]
```

## Troubleshooting

### Worker Not Starting
Check logs:
```bash
wrangler tail
```

### Database Connection Issues
Verify D1 binding IDs match in `wrangler.toml`:
```bash
wrangler d1 list
wrangler d1 execute phneakngar-app --remote --command "SELECT 1"
```

### Migration Failed
Reset local state and re-migrate:
```bash
pnpm db:reset
pnpm db:migrate:remote
```

### Service Binding Errors
Ensure workers are deployed in the correct order (dependencies first).

## CI/CD

GitHub Actions handles automatic deployment on `release: vX.Y.Z` commits:

1. **Typecheck & Lint** - `pnpm typecheck`, `pnpm lint`
2. **Tests** - `pnpm test` (bun test)
3. **Build** - Build all packages
4. **E2E Tests** - Integration tests on PRs
5. **Auto-Tag Release** - Creates git tags and GitHub releases
6. **Publish CLI** - Publishes `@phneakngar/cli` to npm
7. **Publish App** - Publishes `@phneakngar/app` to npm
8. **Cloudflare Deploy** - Manual only: `pnpm deploy:ws-do` → `pnpm deploy:email` → `pnpm deploy:web` (CI does not auto-deploy Workers)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Agent Machine                          │
│  ┌─────────────┐                                          │
│  │ CLI Daemon  │◄────── Poll ──────────────────────────┐  │
│  └─────────────┘                                        │  │
│       │                                                 │  │
│       ▼                                                 │  │
│  ┌─────────────┐     WebSocket      ┌────────────────┐   │  │
│  │   Agent     │◄──────────────────►│  WS Durable Obj │   │  │
│  │  Runtime    │                    └───────┬─────────┘   │  │
│  └─────────────┘                            │             │  │
└─────────────────────────────────────────────│─────────────┘  │
                                            │                │
┌─────────────────────────────────────────────│────────────────┐
│                   Cloudflare Workers         │                │
│                                            ▼                │
│  ┌────────────┐   ┌────────────────┐   ┌────────────────┐   │
│  │   Email    │   │     Web        │   │  WS Durable    │   │
│  │  Worker    │──►│   (Next.js)    │◄──│    Object      │   │
│  └────────────┘   └───────┬────────┘   └────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│                   ┌─────────────┐                          │
│                   │  D1 SQLite  │                          │
│                   └─────────────┘                          │
│                          │                                  │
│                          ▼                                  │
│                   ┌─────────────┐                          │
│                   │  R2 Storage │                          │
│                   └─────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```
